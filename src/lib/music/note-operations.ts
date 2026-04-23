import type { Composition, Voice, Note, NoteRole, NoteBinding, PitchClass, SpelledPitch, NoteDuration, KeySignature } from '../../types/song';
import { VOICE_ORDER } from '../../types/song';
import { spellMidi, spelledPitchToMidi } from '../harmony';
import { genId } from '../id';
import { getPrevVoicePitches, resolveVoiceLeading } from './voiceLeadingResolver';

export const MAX_MIDI = 84; // C6
export const MIN_MIDI = 36; // C2

const INTERVAL_ROLES: readonly NoteRole[] = ['root', 'third', 'fifth', 'seventh', 'ninth'];

const roleForMidi = (midi: number, rootMidi: number, intervals: readonly number[]): NoteRole => {
  const semitone = ((midi % 12) - (rootMidi % 12) + 12) % 12;
  const idx = (intervals as number[]).indexOf(semitone);
  return INTERVAL_ROLES[idx] ?? 'root';
};

// Find the nearest chord tone strictly above `aboveMidi`
export const findNextChordTone = (
  aboveMidi: number,
  intervals: readonly number[],
  rootMidi: number,
): number => {
  const rootClass = rootMidi % 12;
  for (let p = aboveMidi + 1; p <= MAX_MIDI; p++) {
    const semitone = ((p % 12) - rootClass + 12) % 12;
    if ((intervals as number[]).includes(semitone)) return p;
  }
  return aboveMidi + 12;
};

/**
 * Distribute chord tones across voices (bass→soprano), one note per voice.
 * When all four voices have prior notes, uses voice-leading optimisation
 * (minimum total movement + SATB range penalties) to assign chord tones.
 * Falls back to sequential ascending assignment otherwise.
 */
export const spreadChordAcrossVoices = (
  composition: Composition,
  rootMidi: number,
  startBeat: number,
  duration: NoteDuration,
  intervals: readonly number[],
  key: KeySignature,
): Composition => {
  // Sort voices bass→soprano (VOICE_ORDER is already bass-first)
  const orderedVoices = [...composition.voices].sort(
    (a, b) => VOICE_ORDER.indexOf(a.role) - VOICE_ORDER.indexOf(b.role),
  );

  // Attempt voice-leading optimisation when previous positions are available
  const prevPitches = getPrevVoicePitches(composition, startBeat);
  const leading = prevPitches !== null
    ? resolveVoiceLeading(prevPitches, rootMidi, intervals, key)
    : null;

  const chordId = genId();

  let voiceNotes: Map<string, { spelledPitch: SpelledPitch; startBeat: number; duration: NoteDuration }>;

  if (leading !== null) {
    voiceNotes = new Map(
      orderedVoices.map(v => [v.id, { spelledPitch: leading[v.role], startBeat, duration }]),
    );
  } else {
    // Fallback: sequential ascending assignment
    const midiPitches: number[] = [rootMidi];
    for (let i = 1; i < orderedVoices.length; i++) {
      midiPitches.push(findNextChordTone(midiPitches[i - 1], intervals, rootMidi));
    }
    voiceNotes = new Map(
      orderedVoices.map((v, i) => [
        v.id,
        { spelledPitch: spellMidi(midiPitches[i], key), startBeat, duration },
      ]),
    );
  }

  return {
    ...composition,
    voices: composition.voices.map(v => {
      const entry = voiceNotes.get(v.id);
      if (!entry) return v;
      const midi = spelledPitchToMidi(entry.spelledPitch);
      const binding = { kind: 'chord_tone' as const, chordId, role: roleForMidi(midi, rootMidi, intervals) };
      return { ...v, notes: [...v.notes, { id: genId(), ...entry, binding }] };
    }),
  };
};

/** Add a single note to a specific voice. */
export const addNote = (
  composition: Composition,
  voiceId: string,
  spelledPitch: SpelledPitch,
  startBeat: number,
  duration: NoteDuration,
  binding?: NoteBinding,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v =>
    v.id !== voiceId ? v : {
      ...v,
      notes: [...v.notes, { id: genId(), spelledPitch, startBeat, duration, ...(binding ? { binding } : {}) }],
    }
  ),
});

/** Add multiple notes to a single voice (chord within one voice). */
export const addChordToVoice = (
  composition: Composition,
  voiceId: string,
  rootMidi: number,
  startBeat: number,
  duration: NoteDuration,
  intervals: readonly number[],
  key: KeySignature,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v =>
    v.id !== voiceId ? v : {
      ...v,
      notes: [
        ...v.notes,
        ...intervals.map(interval => ({
          id: genId(),
          spelledPitch: spellMidi(rootMidi + interval, key),
          startBeat,
          duration,
        })),
      ],
    }
  ),
});

/** Remove a note (searches all voices). */
export const removeNote = (composition: Composition, noteId: string): Composition => ({
  ...composition,
  voices: composition.voices.map(v => ({
    ...v,
    notes: v.notes.filter(n => n.id !== noteId),
  })),
});

/** Remove all notes belonging to a chord group (identified by chordId in their binding). */
export const removeChord = (composition: Composition, chordId: string): Composition => ({
  ...composition,
  voices: composition.voices.map(v => ({
    ...v,
    notes: v.notes.filter(n => !(n.binding?.kind === 'chord_tone' && n.binding.chordId === chordId)),
  })),
});

/**
 * Transpose all notes and chord declaration roots by the chromatic distance
 * between the old and new key roots. Notes are re-spelled in the new key context.
 * Delta is clamped to [-6, +6] to minimise register displacement.
 */
export const transposeComposition = (
  composition: Composition,
  newKey: KeySignature,
): Composition => {
  const pcOf = (p: PitchClass): number =>
    spelledPitchToMidi({ letter: p.letter, accidental: p.accidental, octave: 4 }) % 12;

  const raw = ((pcOf(newKey.tonic) - pcOf(composition.keySignature.tonic)) + 12) % 12;
  const delta = raw > 6 ? raw - 12 : raw;

  if (delta === 0) return { ...composition, keySignature: newKey };

  const transposeNote = (n: Note): Note => ({
    ...n,
    spelledPitch: spellMidi(spelledPitchToMidi(n.spelledPitch) + delta, newKey),
  });

  return {
    ...composition,
    keySignature: newKey,
    voices: composition.voices.map(v => ({ ...v, notes: v.notes.map(transposeNote) })),
  };
};

/** Find which voice contains a given note ID. */
export const findVoiceForNote = (composition: Composition, noteId: string): Voice | undefined =>
  composition.voices.find(v => v.notes.some(n => n.id === noteId));

/** Move a note to a new beat/pitch. spelledPitch is derived from MIDI drag position. */
export const moveNote = (
  composition: Composition,
  noteId: string,
  startBeat: number,
  spelledPitch: SpelledPitch,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v => ({
    ...v,
    notes: v.notes.map(n =>
      n.id !== noteId ? n : { ...n, startBeat, spelledPitch }
    ),
  })),
});
