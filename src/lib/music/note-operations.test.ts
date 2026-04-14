import {
  addNote,
  addChord,
  removeNote,
  moveNote,
  findNextChordTone,
  spreadChordAcrossStreams,
} from './note-operations';
import type { Song, KeySignature } from '../../types/song';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const C_MAJOR: KeySignature = { root: 'C', mode: 'major' };
const BASE: Song = {
  version: '1.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], streams: [],
  globalKey: C_MAJOR,
};

// ── addNote ───────────────────────────────────────────────────────────────────

describe('addNote', () => {
  it('adds a note to an empty song', () => {
    const result = addNote(BASE, 60, 0);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pitch).toBe(60);
    expect(result.notes[0].startBeat).toBe(0);
    expect(result.notes[0].durationBeats).toBe(1);
  });

  it('does not mutate the original song', () => {
    addNote(BASE, 60, 0);
    expect(BASE.notes).toHaveLength(0);
  });

  it('always assigns spelledPitch', () => {
    const result = addNote(BASE, 60, 0);
    expect(result.notes[0].spelledPitch).toEqual({ letter: 'C', accidental: 0, octave: 4 });
  });

  it('assigns the given streamId', () => {
    const result = addNote(BASE, 60, 0, 1, 'stream1');
    expect(result.notes[0].streamId).toBe('stream1');
  });

  it('uses provided durationBeats', () => {
    const result = addNote(BASE, 60, 0, 2);
    expect(result.notes[0].durationBeats).toBe(2);
  });

  it('preserves existing notes', () => {
    const withOne = addNote(BASE, 60, 0);
    const withTwo = addNote(withOne, 64, 1);
    expect(withTwo.notes).toHaveLength(2);
  });
});

// ── removeNote ────────────────────────────────────────────────────────────────

describe('removeNote', () => {
  it('removes the note with the given id', () => {
    const song = addNote(BASE, 60, 0);
    const id = song.notes[0].id;
    const result = removeNote(song, id);
    expect(result.notes).toHaveLength(0);
  });

  it('leaves other notes intact', () => {
    const s1 = addNote(BASE, 60, 0);
    const s2 = addNote(s1, 64, 1);
    const idFirst = s2.notes[0].id;
    const result = removeNote(s2, idFirst);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pitch).toBe(64);
  });

  it('is a no-op for an unknown id', () => {
    const song = addNote(BASE, 60, 0);
    const result = removeNote(song, 'nonexistent');
    expect(result.notes).toHaveLength(1);
  });
});

// ── moveNote ──────────────────────────────────────────────────────────────────

describe('moveNote', () => {
  it('updates startBeat and pitch', () => {
    const song = addNote(BASE, 60, 0);
    const id = song.notes[0].id;
    const result = moveNote(song, id, 4, 67);
    expect(result.notes[0].startBeat).toBe(4);
    expect(result.notes[0].pitch).toBe(67);
  });

  it('re-annotates spelledPitch on move', () => {
    const song = addNote(BASE, 60, 0);
    const id = song.notes[0].id;
    const result = moveNote(song, id, 0, 62); // D4
    expect(result.notes[0].spelledPitch).toEqual({ letter: 'D', accidental: 0, octave: 4 });
  });

  it('does not affect other notes', () => {
    const s1 = addNote(BASE, 60, 0);
    const s2 = addNote(s1, 64, 1);
    const id = s2.notes[0].id;
    const result = moveNote(s2, id, 8, 72);
    expect(result.notes.find(n => n.pitch === 64)?.startBeat).toBe(1);
  });
});

// ── addChord ──────────────────────────────────────────────────────────────────

describe('addChord', () => {
  const MAJ_INTERVALS = [0, 4, 7];

  it('adds one note per interval', () => {
    const result = addChord(BASE, 60, 0, 1, MAJ_INTERVALS);
    expect(result.notes).toHaveLength(3);
  });

  it('pitches are root + each interval', () => {
    const result = addChord(BASE, 60, 0, 1, MAJ_INTERVALS);
    const pitches = result.notes.map(n => n.pitch).sort((a, b) => a - b);
    expect(pitches).toEqual([60, 64, 67]);
  });

  it('single-element interval [0] adds one note at root', () => {
    const result = addChord(BASE, 60, 0, 1, [0]);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pitch).toBe(60);
  });

  it('always assigns spelledPitch', () => {
    const result = addChord(BASE, 60, 0, 1, MAJ_INTERVALS);
    expect(result.notes.every(n => n.spelledPitch !== undefined)).toBe(true);
  });

  it('assigns streamId to all notes', () => {
    const result = addChord(BASE, 60, 0, 1, MAJ_INTERVALS, 'sid');
    expect(result.notes.every(n => n.streamId === 'sid')).toBe(true);
  });
});

// ── findNextChordTone ─────────────────────────────────────────────────────────

describe('findNextChordTone', () => {
  const MAJ_INTERVALS = [0, 4, 7]; // major triad

  it('finds the next chord tone strictly above', () => {
    // Root=60 (C), above=60: next chord tone is E4 (64)
    expect(findNextChordTone(60, MAJ_INTERVALS, 60)).toBe(64);
  });

  it('skips non-chord pitches', () => {
    // Root=60, above=64 (E): next chord tone is G4 (67)
    expect(findNextChordTone(64, MAJ_INTERVALS, 60)).toBe(67);
  });

  it('wraps to the next octave after the 5th', () => {
    // Root=60, above=67 (G): next chord tone is C5 (72)
    expect(findNextChordTone(67, MAJ_INTERVALS, 60)).toBe(72);
  });
});

// ── spreadChordAcrossStreams ───────────────────────────────────────────────────

describe('spreadChordAcrossStreams', () => {
  const streams = [
    { id: 'sa', name: 'A', color: '#fff' },
    { id: 'sb', name: 'B', color: '#000' },
    { id: 'sc', name: 'C', color: '#aaa' },
  ];
  const song: Song = { ...BASE, streams };
  const MAJ_INTERVALS = [0, 4, 7];

  it('assigns one note per stream', () => {
    const result = spreadChordAcrossStreams(song, 60, 0, 1, MAJ_INTERVALS);
    expect(result.notes).toHaveLength(3);
  });

  it('distributes pitches low to high across streams', () => {
    const result = spreadChordAcrossStreams(song, 60, 0, 1, MAJ_INTERVALS);
    const pitchesByStream = streams.map(s => result.notes.find(n => n.streamId === s.id)!.pitch);
    // stream[0]=root(60), stream[1]=next above 60 (E4=64), stream[2]=next above 64 (G4=67)
    expect(pitchesByStream).toEqual([60, 64, 67]);
  });
});
