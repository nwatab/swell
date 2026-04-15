import type { Note, Composition, KeySignature } from '../../types/song';
import { keyAtBeat, spellMidi } from '../harmony';
import { genId } from '../id';

export const MAX_PITCH = 84; // C6

/**
 * Compute the spelling annotation for a note in a key context.
 * isDiatonic (scale membership) is derivable from spelledPitch + key at any
 * time and is intentionally NOT stored on Note. See ADR-001, ADR-007.
 */
export const annotateNote = (
  pitch: number,
  key: KeySignature,
): { spelledPitch: ReturnType<typeof spellMidi> } =>
  ({ spelledPitch: spellMidi(pitch, key) });

// Find the nearest chord tone strictly above `abovePitch`
export const findNextChordTone = (
  abovePitch: number,
  intervals: readonly number[],
  rootPitch: number,
): number => {
  const rootClass = rootPitch % 12;
  for (let p = abovePitch + 1; p <= MAX_PITCH; p++) {
    const semitone = ((p % 12) - rootClass + 12) % 12;
    if ((intervals as number[]).includes(semitone)) return p;
  }
  return abovePitch + 12; // fallback: octave above
};

// Distribute chord tones across parts low → high.
// part[0] gets rootPitch; each subsequent part gets the next chord tone above.
export const spreadChordAcrossParts = (
  composition: Composition,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
): Composition => {
  const { parts } = composition;
  const pitches: number[] = [rootPitch];
  for (let i = 1; i < parts.length; i++) {
    pitches.push(findNextChordTone(pitches[i - 1], intervals, rootPitch));
  }
  return {
    ...composition,
    notes: [
      ...composition.notes,
      ...parts.map((part, i) => {
        const pitch = pitches[i];
        const key = keyAtBeat(composition, startBeat);
        return {
          id: genId(),
          pitch,
          ...annotateNote(pitch, key),
          startBeat,
          durationBeats,
          velocity: 100,
          partId: part.id,
        };
      }),
    ],
  };
};

export const addNote = (
  composition: Composition,
  pitch: number,
  startBeat: number,
  durationBeats = 1,
  partId?: string,
): Composition => {
  const key = keyAtBeat(composition, startBeat);
  return {
    ...composition,
    notes: [
      ...composition.notes,
      { id: genId(), pitch, ...annotateNote(pitch, key), startBeat, durationBeats, velocity: 100, partId },
    ],
  };
};

export const addChord = (
  composition: Composition,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
  partId?: string,
): Composition => {
  const key = keyAtBeat(composition, startBeat);
  return {
    ...composition,
    notes: [
      ...composition.notes,
      ...intervals.map(interval => {
        const pitch = rootPitch + interval;
        return {
          id: genId(),
          pitch,
          ...annotateNote(pitch, key),
          startBeat,
          durationBeats,
          velocity: 100,
          partId,
        };
      }),
    ],
  };
};

export const removeNote = (composition: Composition, id: string): Composition => ({
  ...composition,
  notes: composition.notes.filter(n => n.id !== id),
});

export const moveNote = (composition: Composition, id: string, startBeat: number, pitch: number): Composition => ({
  ...composition,
  notes: composition.notes.map(n => {
    if (n.id !== id) return n;
    const key = keyAtBeat(composition, startBeat);
    return { ...n, startBeat, pitch, ...annotateNote(pitch, key) };
  }),
});
