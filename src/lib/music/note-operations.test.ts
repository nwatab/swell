import {
  addNote,
  addChord,
  removeNote,
  moveNote,
  findNextChordTone,
  spreadChordAcrossParts,
} from './note-operations';
import type { Composition, KeySignature } from '../../types/song';
import { genId } from '../id';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const C_MAJOR: KeySignature = { root: 'C', mode: 'major' };
const BASE: Composition = {
  id: genId(), version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], tracks: [],
  parts: [], globalKey: C_MAJOR,
};

// ── addNote ───────────────────────────────────────────────────────────────────

describe('addNote', () => {
  it('adds a note to an empty composition', () => {
    const result = addNote(BASE, 60, 0);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].pitch).toBe(60);
    expect(result.notes[0].startBeat).toBe(0);
    expect(result.notes[0].durationBeats).toBe(1);
  });

  it('does not mutate the original composition', () => {
    addNote(BASE, 60, 0);
    expect(BASE.notes).toHaveLength(0);
  });

  it('always assigns spelledPitch', () => {
    const result = addNote(BASE, 60, 0);
    expect(result.notes[0].spelledPitch).toEqual({ letter: 'C', accidental: 0, octave: 4 });
  });

  it('assigns the given partId', () => {
    const result = addNote(BASE, 60, 0, 1, 'part1');
    expect(result.notes[0].partId).toBe('part1');
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
    const comp = addNote(BASE, 60, 0);
    const id = comp.notes[0].id;
    const result = removeNote(comp, id);
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
    const comp = addNote(BASE, 60, 0);
    const result = removeNote(comp, 'nonexistent');
    expect(result.notes).toHaveLength(1);
  });
});

// ── moveNote ──────────────────────────────────────────────────────────────────

describe('moveNote', () => {
  it('updates startBeat and pitch', () => {
    const comp = addNote(BASE, 60, 0);
    const id = comp.notes[0].id;
    const result = moveNote(comp, id, 4, 67);
    expect(result.notes[0].startBeat).toBe(4);
    expect(result.notes[0].pitch).toBe(67);
  });

  it('re-annotates spelledPitch on move', () => {
    const comp = addNote(BASE, 60, 0);
    const id = comp.notes[0].id;
    const result = moveNote(comp, id, 0, 62); // D4
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

  it('assigns partId to all notes', () => {
    const result = addChord(BASE, 60, 0, 1, MAJ_INTERVALS, 'pid');
    expect(result.notes.every(n => n.partId === 'pid')).toBe(true);
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

// ── spreadChordAcrossParts ───────────────────────────────────────────────────

describe('spreadChordAcrossParts', () => {
  const parts = [
    { id: 'pa', trackId: 't1' },
    { id: 'pb', trackId: 't2' },
    { id: 'pc', trackId: 't3' },
  ];
  const comp: Composition = { ...BASE, parts };
  const MAJ_INTERVALS = [0, 4, 7];

  it('assigns one note per part', () => {
    const result = spreadChordAcrossParts(comp, 60, 0, 1, MAJ_INTERVALS);
    expect(result.notes).toHaveLength(3);
  });

  it('distributes pitches low to high across parts', () => {
    const result = spreadChordAcrossParts(comp, 60, 0, 1, MAJ_INTERVALS);
    const pitchesByPart = parts.map(p => result.notes.find(n => n.partId === p.id)!.pitch);
    // part[0]=root(60), part[1]=next above 60 (E4=64), part[2]=next above 64 (G4=67)
    expect(pitchesByPart).toEqual([60, 64, 67]);
  });
});
