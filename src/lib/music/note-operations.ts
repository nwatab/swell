import type { Note, Song, KeySignature } from '../../types/song';
import { keyAtBeat, spellMidi, isDiatonicPitch } from '../harmony';
import { genId } from '../id';

export const MAX_PITCH = 84; // C6

export const annotateNote = (
  pitch: number,
  startBeat: number,
  key: KeySignature | null,
): { spelledPitch?: ReturnType<typeof spellMidi>; isDiatonic?: boolean } =>
  key
    ? { spelledPitch: spellMidi(pitch, key), isDiatonic: isDiatonicPitch(pitch, key) }
    : {};

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

// Distribute chord tones across streams low → high.
// stream[0] gets rootPitch; each subsequent stream gets the next chord tone above.
export const spreadChordAcrossStreams = (
  song: Song,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
): Song => {
  const { streams } = song;
  const pitches: number[] = [rootPitch];
  for (let i = 1; i < streams.length; i++) {
    pitches.push(findNextChordTone(pitches[i - 1], intervals, rootPitch));
  }
  return {
    ...song,
    notes: [
      ...song.notes,
      ...streams.map((stream, i) => {
        const pitch = pitches[i];
        const key = keyAtBeat(song, startBeat);
        return {
          id: genId(),
          pitch,
          ...annotateNote(pitch, startBeat, key),
          startBeat,
          durationBeats,
          velocity: 100,
          streamId: stream.id,
        };
      }),
    ],
  };
};

export const addNote = (
  song: Song,
  pitch: number,
  startBeat: number,
  durationBeats = 1,
  streamId?: string,
): Song => {
  const key = keyAtBeat(song, startBeat);
  return {
    ...song,
    notes: [
      ...song.notes,
      { id: genId(), pitch, ...annotateNote(pitch, startBeat, key), startBeat, durationBeats, velocity: 100, streamId },
    ],
  };
};

export const addChord = (
  song: Song,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
  streamId?: string,
): Song => {
  const key = keyAtBeat(song, startBeat);
  return {
    ...song,
    notes: [
      ...song.notes,
      ...intervals.map(interval => {
        const pitch = rootPitch + interval;
        return {
          id: genId(),
          pitch,
          ...annotateNote(pitch, startBeat, key),
          startBeat,
          durationBeats,
          velocity: 100,
          streamId,
        };
      }),
    ],
  };
};

export const removeNote = (song: Song, id: string): Song => ({
  ...song,
  notes: song.notes.filter(n => n.id !== id),
});

export const moveNote = (song: Song, id: string, startBeat: number, pitch: number): Song => ({
  ...song,
  notes: song.notes.map(n => {
    if (n.id !== id) return n;
    const key = keyAtBeat(song, startBeat);
    return { ...n, startBeat, pitch, ...annotateNote(pitch, startBeat, key) };
  }),
});
