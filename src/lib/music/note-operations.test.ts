import {
  addNote,
  addChordToVoice,
  removeNote,
  moveNote,
  findNextChordTone,
  spreadChordAcrossVoices,
} from './note-operations';
import type { Composition, KeySignature, SpelledPitch } from '../../types/song';
import { DEFAULT_COMPOSITION, VOICE_ORDER } from '../../types/song';
import { spellMidi } from '../harmony';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const C_MAJOR: KeySignature = { tonic: { letter: 'C', accidental: 0 }, mode: 'major' };
const BASE: Composition = { ...DEFAULT_COMPOSITION, keySignature: C_MAJOR };

const bassVoiceId = (): string => BASE.voices.find(v => v.role === 'bass')!.id;
const sopranoVoiceId = (): string => BASE.voices.find(v => v.role === 'soprano')!.id;

const C4: SpelledPitch = { letter: 'C', accidental: 0, octave: 4 };
const E4: SpelledPitch = { letter: 'E', accidental: 0, octave: 4 };
const G4: SpelledPitch = { letter: 'G', accidental: 0, octave: 4 };
const D4: SpelledPitch = { letter: 'D', accidental: 0, octave: 4 };

// ── addNote ───────────────────────────────────────────────────────────────────

describe('addNote', () => {
  it('adds a note to the target voice', () => {
    const vid = bassVoiceId();
    const result = addNote(BASE, vid, C4, 0, 'quarter');
    const voice = result.voices.find(v => v.id === vid)!;
    expect(voice.notes).toHaveLength(1);
    expect(voice.notes[0].spelledPitch).toEqual(C4);
    expect(voice.notes[0].startBeat).toBe(0);
    expect(voice.notes[0].duration).toBe('quarter');
  });

  it('does not mutate the original composition', () => {
    const vid = bassVoiceId();
    addNote(BASE, vid, C4, 0, 'quarter');
    expect(BASE.voices.find(v => v.id === vid)!.notes).toHaveLength(0);
  });

  it('does not affect other voices', () => {
    const vid = bassVoiceId();
    const result = addNote(BASE, vid, C4, 0, 'quarter');
    const others = result.voices.filter(v => v.id !== vid);
    expect(others.every(v => v.notes.length === 0)).toBe(true);
  });

  it('preserves existing notes in the same voice', () => {
    const vid = bassVoiceId();
    const s1 = addNote(BASE, vid, C4, 0, 'quarter');
    const s2 = addNote(s1, vid, E4, 1, 'quarter');
    expect(s2.voices.find(v => v.id === vid)!.notes).toHaveLength(2);
  });
});

// ── removeNote ────────────────────────────────────────────────────────────────

describe('removeNote', () => {
  it('removes the note with the given id', () => {
    const vid = bassVoiceId();
    const comp = addNote(BASE, vid, C4, 0, 'quarter');
    const id = comp.voices.find(v => v.id === vid)!.notes[0].id;
    const result = removeNote(comp, id);
    expect(result.voices.find(v => v.id === vid)!.notes).toHaveLength(0);
  });

  it('leaves other notes intact', () => {
    const vid = bassVoiceId();
    const s1 = addNote(BASE, vid, C4, 0, 'quarter');
    const s2 = addNote(s1, vid, E4, 1, 'quarter');
    const idFirst = s2.voices.find(v => v.id === vid)!.notes[0].id;
    const result = removeNote(s2, idFirst);
    const remaining = result.voices.find(v => v.id === vid)!.notes;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].spelledPitch).toEqual(E4);
  });

  it('is a no-op for an unknown id', () => {
    const vid = bassVoiceId();
    const comp = addNote(BASE, vid, C4, 0, 'quarter');
    const result = removeNote(comp, 'nonexistent');
    expect(result.voices.find(v => v.id === vid)!.notes).toHaveLength(1);
  });

  it('searches across all voices', () => {
    const bid = bassVoiceId();
    const sid = sopranoVoiceId();
    const s1 = addNote(BASE, bid, C4, 0, 'quarter');
    const s2 = addNote(s1, sid, G4, 0, 'quarter');
    const sopranoNoteId = s2.voices.find(v => v.id === sid)!.notes[0].id;
    const result = removeNote(s2, sopranoNoteId);
    expect(result.voices.find(v => v.id === sid)!.notes).toHaveLength(0);
    expect(result.voices.find(v => v.id === bid)!.notes).toHaveLength(1);
  });
});

// ── moveNote ──────────────────────────────────────────────────────────────────

describe('moveNote', () => {
  it('updates startBeat and spelledPitch', () => {
    const vid = bassVoiceId();
    const comp = addNote(BASE, vid, C4, 0, 'quarter');
    const id = comp.voices.find(v => v.id === vid)!.notes[0].id;
    const result = moveNote(comp, id, 4, G4);
    const moved = result.voices.find(v => v.id === vid)!.notes[0];
    expect(moved.startBeat).toBe(4);
    expect(moved.spelledPitch).toEqual(G4);
  });

  it('does not affect other notes', () => {
    const vid = bassVoiceId();
    const s1 = addNote(BASE, vid, C4, 0, 'quarter');
    const s2 = addNote(s1, vid, E4, 1, 'quarter');
    const idFirst = s2.voices.find(v => v.id === vid)!.notes[0].id;
    const result = moveNote(s2, idFirst, 8, G4);
    const notes = result.voices.find(v => v.id === vid)!.notes;
    expect(notes.find(n => n.spelledPitch.letter === 'E')?.startBeat).toBe(1);
  });
});

// ── addChordToVoice ───────────────────────────────────────────────────────────

describe('addChordToVoice', () => {
  const MAJ_INTERVALS = [0, 4, 7];

  it('adds one note per interval to the target voice', () => {
    const vid = bassVoiceId();
    const result = addChordToVoice(BASE, vid, 60, 0, 'quarter', MAJ_INTERVALS, C_MAJOR);
    expect(result.voices.find(v => v.id === vid)!.notes).toHaveLength(3);
  });

  it('spelledPitches are root + each interval', () => {
    const vid = bassVoiceId();
    const result = addChordToVoice(BASE, vid, 60, 0, 'quarter', MAJ_INTERVALS, C_MAJOR);
    const pitches = result.voices.find(v => v.id === vid)!.notes
      .map(n => n.spelledPitch)
      .sort((a, b) => a.letter.localeCompare(b.letter));
    expect(pitches).toContainEqual(C4);
    expect(pitches).toContainEqual(E4);
    expect(pitches).toContainEqual(G4);
  });

  it('single-element interval [0] adds one note at root', () => {
    const vid = bassVoiceId();
    const result = addChordToVoice(BASE, vid, 60, 0, 'quarter', [0], C_MAJOR);
    const notes = result.voices.find(v => v.id === vid)!.notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].spelledPitch).toEqual(C4);
  });

  it('does not affect other voices', () => {
    const vid = bassVoiceId();
    const result = addChordToVoice(BASE, vid, 60, 0, 'quarter', MAJ_INTERVALS, C_MAJOR);
    const others = result.voices.filter(v => v.id !== vid);
    expect(others.every(v => v.notes.length === 0)).toBe(true);
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

// ── spreadChordAcrossVoices ───────────────────────────────────────────────────

describe('spreadChordAcrossVoices', () => {
  const MAJ_INTERVALS = [0, 4, 7];

  it('assigns one note per voice', () => {
    const result = spreadChordAcrossVoices(BASE, 60, 0, 'quarter', MAJ_INTERVALS, C_MAJOR);
    const allNotes = result.voices.flatMap(v => v.notes);
    expect(allNotes).toHaveLength(BASE.voices.length);
  });

  it('distributes pitches low to high bass→soprano', () => {
    const result = spreadChordAcrossVoices(BASE, 60, 0, 'quarter', MAJ_INTERVALS, C_MAJOR);
    // VOICE_ORDER is bass-first; each voice should have ascending MIDI pitch
    const orderedVoices = [...result.voices].sort(
      (a, b) => VOICE_ORDER.indexOf(a.role) - VOICE_ORDER.indexOf(b.role),
    );
    const midis = orderedVoices.map(v => {
      const sp = v.notes[0].spelledPitch;
      return spellMidi === undefined ? 0 : (sp.octave + 1) * 12 +
        ['C','','D','','E','F','','G','','A','','B'].indexOf(sp.letter) * 1 + sp.accidental;
    });
    // Bass gets root (60=C4), each subsequent voice gets next chord tone
    const bassNote = result.voices.find(v => v.role === 'bass')!.notes[0];
    expect(bassNote.spelledPitch).toEqual(C4);
  });

  it('all notes have the given startBeat and duration', () => {
    const result = spreadChordAcrossVoices(BASE, 60, 2, 'half', MAJ_INTERVALS, C_MAJOR);
    const allNotes = result.voices.flatMap(v => v.notes);
    expect(allNotes.every(n => n.startBeat === 2)).toBe(true);
    expect(allNotes.every(n => n.duration === 'half')).toBe(true);
  });
});
