import type { Composition, Voice, Note, PitchClass, SpelledPitch, NoteDuration, KeySignature } from '../../types/song';
import { VOICE_ORDER } from '../../types/song';
import { spellMidi, spelledPitchToMidi } from '../harmony';
import { genId } from '../id';

export const MAX_MIDI = 84; // C6
export const MIN_MIDI = 36; // C2

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
 * rootMidi is the MIDI pitch of the root (used only as scratch for arithmetic).
 * All stored notes use SpelledPitch.
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

  const midiPitches: number[] = [rootMidi];
  for (let i = 1; i < orderedVoices.length; i++) {
    midiPitches.push(findNextChordTone(midiPitches[i - 1], intervals, rootMidi));
  }

  const voiceNotes = new Map(
    orderedVoices.map((v, i) => [
      v.id,
      { spelledPitch: spellMidi(midiPitches[i], key), startBeat, duration },
    ]),
  );

  return {
    ...composition,
    voices: composition.voices.map(v => {
      const entry = voiceNotes.get(v.id);
      if (!entry) return v;
      return { ...v, notes: [...v.notes, { id: genId(), ...entry }] };
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
): Composition => ({
  ...composition,
  voices: composition.voices.map(v =>
    v.id !== voiceId ? v : {
      ...v,
      notes: [...v.notes, { id: genId(), spelledPitch, startBeat, duration }],
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

  const transposePc = (pc: PitchClass): PitchClass => {
    const { letter, accidental } = spellMidi(
      spelledPitchToMidi({ letter: pc.letter, accidental: pc.accidental, octave: 4 }) + delta,
      newKey,
    );
    return { letter, accidental };
  };

  return {
    ...composition,
    keySignature: newKey,
    voices: composition.voices.map(v => ({ ...v, notes: v.notes.map(transposeNote) })),
    measures: composition.measures.map(m => ({ ...m, root: transposePc(m.root) })),
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
