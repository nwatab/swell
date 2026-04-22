import {
  getScaleDegree,
  romanNumeral,
  spellMidi,
  spelledPitchToString,
  spelledPitchToMidi,
  snapToDiatonic,
  keyAtBeat,
  getDiatonicChordIntervals,
  analyzeHarmony,
  chordDegreeLabel,
  inferChordFromNotes,
  computeBeatChordEntries,
} from './harmony';
import type { KeySignature, Note, Composition, Voice, SpelledPitch, ChordQuality, PitchClass } from '../types/song';
import { DEFAULT_COMPOSITION } from '../types/song';
import { genId } from './id';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const C_MAJOR:  KeySignature = { tonic: { letter: 'C', accidental:  0 }, mode: 'major' };
const G_MAJOR:  KeySignature = { tonic: { letter: 'G', accidental:  0 }, mode: 'major' };
const EB_MAJOR: KeySignature = { tonic: { letter: 'E', accidental: -1 }, mode: 'major' };
const C_MINOR:  KeySignature = { tonic: { letter: 'C', accidental:  0 }, mode: 'minor' };
const CS_MAJOR: KeySignature = { tonic: { letter: 'C', accidental:  1 }, mode: 'major' };

const BASE: Composition = { ...DEFAULT_COMPOSITION, keySignature: C_MAJOR };

const spNote = (id: string, midi: number, startBeat = 0): Note => ({
  id,
  spelledPitch: spellMidi(midi, C_MAJOR),
  startBeat,
  duration: 'quarter',
});

const makeVoice = (role: Voice['role'], notes: Note[]): Voice => ({
  id: genId(), role, notes,
});

// ── getScaleDegree ────────────────────────────────────────────────────────────

describe('getScaleDegree', () => {
  it('returns 0 for the tonic', () => {
    expect(getScaleDegree(60, C_MAJOR)).toBe(0);
    expect(getScaleDegree(67, G_MAJOR)).toBe(0);
  });

  it('returns correct degrees for C major', () => {
    const expected = [
      [60, 0], [62, 1], [64, 2], [65, 3], [67, 4], [69, 5], [71, 6],
    ] as const;
    for (const [midi, deg] of expected) {
      expect(getScaleDegree(midi, C_MAJOR)).toBe(deg);
    }
  });

  it('returns null for chromatic pitches', () => {
    expect(getScaleDegree(61, C_MAJOR)).toBeNull();
    expect(getScaleDegree(63, C_MAJOR)).toBeNull();
  });
});

// ── romanNumeral ─────────────────────────────────────────────────────────────

describe('romanNumeral', () => {
  it('returns null for chromatic pitch', () => expect(romanNumeral(61, C_MAJOR)).toBeNull());
  it('returns uppercase I for major tonic', () => expect(romanNumeral(60, C_MAJOR)).toBe('I'));
  it('returns lowercase i for minor tonic', () => expect(romanNumeral(60, C_MINOR)).toBe('i'));
  it('returns IV for subdominant of C major', () => expect(romanNumeral(65, C_MAJOR)).toBe('IV'));
  it('returns V for dominant of C major', () => expect(romanNumeral(67, C_MAJOR)).toBe('V'));
});

// ── spellMidi ─────────────────────────────────────────────────────────────────

describe('spellMidi', () => {
  it.each([
    [60, 'C', 0, 4],
    [62, 'D', 0, 4],
    [64, 'E', 0, 4],
    [65, 'F', 0, 4],
    [67, 'G', 0, 4],
    [69, 'A', 0, 4],
    [71, 'B', 0, 4],
    [72, 'C', 0, 5],
    [59, 'B', 0, 3],
  ])('spells MIDI %i in C major', (midi, letter, accidental, octave) => {
    expect(spellMidi(midi, C_MAJOR)).toEqual({ letter, accidental, octave });
  });

  it('spells C#4 (MIDI 61) in C major', () => {
    expect(spellMidi(61, C_MAJOR)).toEqual({ letter: 'C', accidental: 1, octave: 4 });
  });

  it('spells Eb4 as Eb in Eb major (diatonic tonic)', () => {
    expect(spellMidi(63, EB_MAJOR)).toEqual({ letter: 'E', accidental: -1, octave: 4 });
  });

  it('handles B# octave boundary in C# major', () => {
    expect(spellMidi(60, CS_MAJOR)).toEqual({ letter: 'B', accidental: 1, octave: 3 });
  });

  it('spells Eb4 as Eb in C minor', () => {
    expect(spellMidi(63, C_MINOR)).toEqual({ letter: 'E', accidental: -1, octave: 4 });
  });
});

// ── spelledPitchToString ──────────────────────────────────────────────────────

describe('spelledPitchToString', () => {
  it('natural note', () => expect(spelledPitchToString({ letter: 'C', accidental: 0, octave: 4 })).toBe('C4'));
  it('sharp', () => expect(spelledPitchToString({ letter: 'F', accidental: 1, octave: 3 })).toBe('F♯3'));
  it('flat', () => expect(spelledPitchToString({ letter: 'E', accidental: -1, octave: 4 })).toBe('E♭4'));
});

// ── spelledPitchToMidi ────────────────────────────────────────────────────────

describe('spelledPitchToMidi', () => {
  it('C4 → 60', () => expect(spelledPitchToMidi({ letter: 'C', accidental: 0, octave: 4 })).toBe(60));
  it('B3 → 59', () => expect(spelledPitchToMidi({ letter: 'B', accidental: 0, octave: 3 })).toBe(59));
  it('Eb4 → 63', () => expect(spelledPitchToMidi({ letter: 'E', accidental: -1, octave: 4 })).toBe(63));
  it('round-trips with spellMidi', () => {
    for (const midi of [48, 57, 60, 64, 67, 71, 72, 79]) {
      expect(spelledPitchToMidi(spellMidi(midi, C_MAJOR))).toBe(midi);
    }
  });
});

// ── snapToDiatonic ────────────────────────────────────────────────────────────

describe('snapToDiatonic', () => {
  it('returns pitch unchanged if already diatonic', () => {
    expect(snapToDiatonic(60, C_MAJOR)).toBe(60);
  });
  it('C# (61) → C (60)', () => expect(snapToDiatonic(61, C_MAJOR)).toBe(60));
  it('Eb (63) → D (62)', () => expect(snapToDiatonic(63, C_MAJOR)).toBe(62));
});

// ── keyAtBeat ─────────────────────────────────────────────────────────────────

describe('keyAtBeat', () => {
  it('returns keySignature for any beat', () => {
    expect(keyAtBeat(BASE, 0)).toEqual(C_MAJOR);
    expect(keyAtBeat(BASE, 32)).toEqual(C_MAJOR);
  });
});

// ── getDiatonicChordIntervals ─────────────────────────────────────────────────

describe('getDiatonicChordIntervals', () => {
  it('returns null for chromatic root', () => {
    expect(getDiatonicChordIntervals(61, C_MAJOR)).toBeNull();
  });
  it('C in C major → major triad [0, 4, 7]', () => {
    expect(getDiatonicChordIntervals(60, C_MAJOR)).toEqual([0, 4, 7]);
  });
  it('G in C major with seventh → V7 [0, 4, 7, 10]', () => {
    expect(getDiatonicChordIntervals(67, C_MAJOR, true)).toEqual([0, 4, 7, 10]);
  });
});

// ── analyzeHarmony — parallel fifths ─────────────────────────────────────────

describe('analyzeHarmony — parallel fifths', () => {
  it('detects parallel fifths between two separate voices', () => {
    // Bass: C4→G4, Soprano: G4→D5 — both move up a fifth in parallel
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
        makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 74, 1)]),
      ],
    };
    const p5 = analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth');
    expect(p5).toHaveLength(1);
    expect(p5[0].severity).toBe('error');
  });

  it('detects parallel fifths within a single voice (polyphonic)', () => {
    // Soprano alone: [C4+G4] → [D4+A4] — same voice, both pairs are P5, parallel upward
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('soprano', [
          spNote('s1', 60, 0), spNote('s2', 67, 0),  // C4 + G4 at beat 0
          spNote('s3', 62, 1), spNote('s4', 69, 1),  // D4 + A4 at beat 1
        ]),
      ],
    };
    const p5 = analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth');
    expect(p5).toHaveLength(1);
    expect(p5[0].severity).toBe('error');
  });

  it('detects parallel fifths with compound interval (>12 semitones)', () => {
    // Bass: C3(48)+G4(67) [19st = compound P5] → D3(50)+A4(69) same direction
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass', [
          spNote('b1', 48, 0), spNote('b2', 67, 0),
          spNote('b3', 50, 1), spNote('b4', 69, 1),
        ]),
      ],
    };
    const p5 = analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth');
    expect(p5).toHaveLength(1);
  });

  it('no parallel fifths when motion is contrary', () => {
    // Bass up, Soprano down — contrary motion
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
        makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 60, 1)]),
      ],
    };
    expect(analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth')).toHaveLength(0);
  });

  it('no parallel fifths when motion is oblique (one voice stationary)', () => {
    // Bass stays on C4, Soprano moves G4→D5 — oblique motion, no violation
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 60, 1)]),
        makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 74, 1)]),
      ],
    };
    expect(analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth')).toHaveLength(0);
  });

  it('no parallel fifths when interval changes (P5 → non-P5)', () => {
    // Bass: C4→D4, Soprano: G4→A4 but soprano jumps differently so interval breaks
    // Bass C4(60)→E4(64), Soprano G4(67)→B4(71): interval was 7, becomes 7 — wait, same
    // Use: Bass C4(60)→D4(62), Soprano G4(67)→B4(71): interval 7→9, no parallel
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 62, 1)]),
        makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 71, 1)]),
      ],
    };
    expect(analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth')).toHaveLength(0);
  });
});

// ── analyzeHarmony — parallel octaves ────────────────────────────────────────

describe('analyzeHarmony — parallel octaves', () => {
  it('detects parallel octaves between two separate voices', () => {
    // Bass: C4(60)→G4(67), Soprano: C5(72)→G5(79) — both octaves, same direction
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
        makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 79, 1)]),
      ],
    };
    const p8 = analyzeHarmony(comp).filter(d => d.type === 'parallel-octave');
    expect(p8).toHaveLength(1);
    expect(p8[0].severity).toBe('error');
  });

  it('detects parallel octaves within a single voice (polyphonic)', () => {
    // Soprano alone: [C4(60)+C5(72)] → [D4(62)+D5(74)]
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('soprano', [
          spNote('s1', 60, 0), spNote('s2', 72, 0),
          spNote('s3', 62, 1), spNote('s4', 74, 1),
        ]),
      ],
    };
    const p8 = analyzeHarmony(comp).filter(d => d.type === 'parallel-octave');
    expect(p8).toHaveLength(1);
    expect(p8[0].severity).toBe('error');
  });

  it('no parallel octaves when motion is contrary', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
        makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 65, 1)]),
      ],
    };
    expect(analyzeHarmony(comp).filter(d => d.type === 'parallel-octave')).toHaveLength(0);
  });

  it('no parallel octaves when motion is oblique', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 60, 1)]),
        makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 79, 1)]),
      ],
    };
    expect(analyzeHarmony(comp).filter(d => d.type === 'parallel-octave')).toHaveLength(0);
  });
});

// ── analyzeHarmony — voice crossing ──────────────────────────────────────────

describe('analyzeHarmony — voice crossing', () => {
  it('detects voice crossing when bass rises above soprano', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 74, 4)]),
        makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 65, 4)]),
      ],
    };
    const vc = analyzeHarmony(comp).filter(d => d.type === 'voice-crossing');
    expect(vc).toHaveLength(1);
    expect(vc[0].severity).toBe('warning');
  });
});

// ── chordDegreeLabel ──────────────────────────────────────────────────────────

const mkDecl = (letter: string, accidental: number, quality: string): { root: PitchClass; quality: ChordQuality } =>
  ({ root: { letter, accidental } as PitchClass, quality: quality as ChordQuality });

describe('chordDegreeLabel', () => {
  describe('C major — diatonic triads', () => {
    it.each([
      ['C',  0, 'maj', 'I'],
      ['D',  0, 'min', 'ii'],
      ['E',  0, 'min', 'iii'],
      ['F',  0, 'maj', 'IV'],
      ['G',  0, 'maj', 'V'],
      ['A',  0, 'min', 'vi'],
      ['B',  0, 'dim', 'vii°'],
    ] as const)('%s%s %s → %s', (l, a, q, expected) => {
      expect(chordDegreeLabel(mkDecl(l, a, q), C_MAJOR)).toBe(expected);
    });
  });

  describe('C major — seventh chords', () => {
    it.each([
      ['C', 0, 'maj7',  'IM7'],
      ['D', 0, 'min7',  'ii7'],
      ['G', 0, 'dom7',  'V7'],
      ['B', 0, 'hdim7', 'viiø7'],
      ['B', 0, 'dim7',  'vii°7'],
    ] as const)('%s%s %s → %s', (l, a, q, expected) => {
      expect(chordDegreeLabel(mkDecl(l, a, q), C_MAJOR)).toBe(expected);
    });
  });

  describe('C major — chromatic (borrowed) roots', () => {
    it.each([
      ['B', -1, 'maj',  '♭VII'],
      ['B', -1, 'dom7', '♭VII7'],
      ['E', -1, 'maj',  '♭III'],
      ['A', -1, 'maj',  '♭VI'],
      ['D', -1, 'maj',  '♭II'],
    ] as const)('%s%s %s → %s', (l, a, q, expected) => {
      expect(chordDegreeLabel(mkDecl(l, a, q), C_MAJOR)).toBe(expected);
    });
  });

  describe('C minor — diatonic triads', () => {
    it.each([
      ['C',  0,  'min', 'i'],
      ['D',  0,  'dim', 'ii°'],
      ['E', -1,  'maj', 'III'],
      ['F',  0,  'min', 'iv'],
      ['G',  0,  'maj', 'V'],
      ['A', -1,  'maj', 'VI'],
      ['B', -1,  'maj', 'VII'],
    ] as const)('%s%s %s → %s', (l, a, q, expected) => {
      expect(chordDegreeLabel(mkDecl(l, a, q), C_MINOR)).toBe(expected);
    });
  });

  it('G major: D is V', () => expect(chordDegreeLabel(mkDecl('D', 0, 'maj'), G_MAJOR)).toBe('V'));
  it('Eb major: Ab is IV', () => expect(chordDegreeLabel(mkDecl('A', -1, 'maj'), EB_MAJOR)).toBe('IV'));
});

// ── inferChordFromNotes ───────────────────────────────────────────────────────

const ns = (midi: number, key: KeySignature = C_MAJOR): { spelledPitch: SpelledPitch } =>
  ({ spelledPitch: spellMidi(midi, key) });

describe('inferChordFromNotes', () => {
  it('I — C major triad, root doubled (C E G C)', () => {
    expect(inferChordFromNotes([ns(60), ns(64), ns(67), ns(72)], C_MAJOR))
      .toEqual({ root: { letter: 'C', accidental: 0 }, quality: 'maj' });
  });

  it('I — C major triad in first inversion (E G C E) — root still C', () => {
    expect(inferChordFromNotes([ns(64), ns(67), ns(72), ns(76)], C_MAJOR))
      .toEqual({ root: { letter: 'C', accidental: 0 }, quality: 'maj' });
  });

  it('V7 — G dominant 7th (G B D F)', () => {
    expect(inferChordFromNotes([ns(55), ns(59), ns(62), ns(65)], C_MAJOR))
      .toEqual({ root: { letter: 'G', accidental: 0 }, quality: 'dom7' });
  });

  it('ii — D minor triad, root doubled (D F A D)', () => {
    expect(inferChordFromNotes([ns(62), ns(65), ns(69), ns(74)], C_MAJOR))
      .toEqual({ root: { letter: 'D', accidental: 0 }, quality: 'min' });
  });

  it('viiø7 — B half-diminished 7th (B D F A)', () => {
    expect(inferChordFromNotes([ns(59), ns(62), ns(65), ns(69)], C_MAJOR))
      .toEqual({ root: { letter: 'B', accidental: 0 }, quality: 'hdim7' });
  });

  it('i — C minor triad in C minor (C Eb G C)', () => {
    expect(inferChordFromNotes([ns(60, C_MINOR), ns(63, C_MINOR), ns(67, C_MINOR), ns(72, C_MINOR)], C_MINOR))
      .toEqual({ root: { letter: 'C', accidental: 0 }, quality: 'min' });
  });

  it('I — G major triad in G major (G B D G)', () => {
    expect(inferChordFromNotes([ns(55, G_MAJOR), ns(59, G_MAJOR), ns(62, G_MAJOR), ns(67, G_MAJOR)], G_MAJOR))
      .toEqual({ root: { letter: 'G', accidental: 0 }, quality: 'maj' });
  });

  it('returns null for non-diatonic chord (F# A C in C major)', () => {
    const chromatic = [
      { spelledPitch: { letter: 'F', accidental: 1, octave: 4 } as SpelledPitch },
      { spelledPitch: { letter: 'A', accidental: 0, octave: 4 } as SpelledPitch },
      { spelledPitch: { letter: 'C', accidental: 0, octave: 5 } as SpelledPitch },
      { spelledPitch: { letter: 'F', accidental: 1, octave: 5 } as SpelledPitch },
    ];
    expect(inferChordFromNotes(chromatic, C_MAJOR)).toBeNull();
  });
});

// ── chordDegreeLabel ──────────────────────────────────────────────────────────

describe('chordDegreeLabel (second suite)', () => {
  const decl = (letter: PitchClass['letter'], acc: PitchClass['accidental'], quality: ChordQuality): { root: PitchClass; quality: ChordQuality } =>
    ({ root: { letter, accidental: acc }, quality });

  it('I — C major in C major', () => {
    expect(chordDegreeLabel(decl('C', 0, 'maj'), C_MAJOR)).toBe('I');
  });

  it('ii — D minor in C major', () => {
    expect(chordDegreeLabel(decl('D', 0, 'min'), C_MAJOR)).toBe('ii');
  });

  it('V7 — G dominant 7th in C major', () => {
    expect(chordDegreeLabel(decl('G', 0, 'dom7'), C_MAJOR)).toBe('V7');
  });

  it('vii° — B diminished in C major', () => {
    expect(chordDegreeLabel(decl('B', 0, 'dim'), C_MAJOR)).toBe('vii°');
  });

  it('♭VII — Bb major in C major (borrowed)', () => {
    expect(chordDegreeLabel(decl('B', -1, 'maj'), C_MAJOR)).toBe('♭VII');
  });

  it('iv — F minor in C major (borrowed)', () => {
    expect(chordDegreeLabel(decl('F', 0, 'min'), C_MAJOR)).toBe('iv');
  });

  it('i — C minor in C minor', () => {
    expect(chordDegreeLabel(decl('C', 0, 'min'), C_MINOR)).toBe('i');
  });

  it('V — G major in C minor (harmonic V)', () => {
    expect(chordDegreeLabel(decl('G', 0, 'maj'), C_MINOR)).toBe('V');
  });

  it('IVmaj7 — F major 7th in C major', () => {
    expect(chordDegreeLabel(decl('F', 0, 'maj7'), C_MAJOR)).toBe('IVM7');
  });

  it('II — D major in C major (secondary dominant root)', () => {
    expect(chordDegreeLabel(decl('D', 0, 'maj'), C_MAJOR)).toBe('II');
  });
});

// ── analyzeHarmony — diagnostic message format ───────────────────────────────
//
// These tests verify that every violation type produces:
//   message: "RuleName — VoicePair/VoiceInfo, beat X" or "...beat X→Y"
//   detail:  pitch movement + interval context
//
// They complement the detection-correctness tests above.

describe('analyzeHarmony — parallel-fifth message format', () => {
  // Bass: C4(60)→G4(67), Soprano: G4(67)→D5(74)
  // C4–G4 = 7st → P5; G4–D5 = 7st → P5; both ascending
  const comp: Composition = {
    ...BASE,
    voices: [
      makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 74, 1)]),
      makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
    ],
  };

  it('message names both voices and uses beat X→Y format', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'parallel-fifth')!;
    expect(d.message).toMatch(/Soprano/);
    expect(d.message).toMatch(/Bass/);
    expect(d.message).toMatch(/beat 1→2/);
  });

  it('detail shows pitch movement on both voices and P5→P5 label', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'parallel-fifth')!;
    // G4→D5 (soprano) and C4→G4 (bass) — order depends on voice declaration order
    expect(d.detail).toMatch(/G4.*D5|C4.*G4/);
    expect(d.detail).toContain('P5→P5');
  });
});

describe('analyzeHarmony — parallel-octave message format', () => {
  // Bass: C4(60)→G4(67), Soprano: C5(72)→G5(79) — P8 apart, both ascending
  const comp: Composition = {
    ...BASE,
    voices: [
      makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 79, 1)]),
      makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 67, 1)]),
    ],
  };

  it('message names both voices and uses beat X→Y format', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'parallel-octave')!;
    expect(d.message).toMatch(/Soprano/);
    expect(d.message).toMatch(/Bass/);
    expect(d.message).toMatch(/beat 1→2/);
  });

  it('detail contains P8→P8 label', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'parallel-octave')!;
    expect(d.detail).toContain('P8→P8');
  });
});

describe('analyzeHarmony — hidden-fifth message format', () => {
  // Bass (outerLow): C3(48)→E3(52), Soprano (outerHigh): G4(67)→B4(71)
  // Similar motion, soprano leaps (+4st > 2), arrival E3–B4 = 19st → P5
  const comp: Composition = {
    ...BASE,
    voices: [
      makeVoice('soprano', [spNote('s1', 67, 0), spNote('s2', 71, 1)]),
      makeVoice('bass',    [spNote('b1', 48, 0), spNote('b2', 52, 1)]),
    ],
  };

  it('message names outer voices and uses beat X→Y format', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'hidden-fifth')!;
    expect(d.message).toMatch(/Soprano/);
    expect(d.message).toMatch(/Bass/);
    expect(d.message).toMatch(/beat 1→2/);
  });

  it('detail shows pitch movement and "similar motion to P5"', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'hidden-fifth')!;
    expect(d.detail).toContain('similar motion to P5');
    // Bass movement: C3→E3
    expect(d.detail).toMatch(/C3.*E3/);
    // Soprano movement: G4→B4
    expect(d.detail).toMatch(/G4.*B4/);
  });
});

describe('analyzeHarmony — voice-crossing message format', () => {
  // Bass: D5(74) at beat 4, Soprano: A4(69) at beat 4 — bass above soprano (MIDI 74 > 69)
  const comp: Composition = {
    ...BASE,
    voices: [
      makeVoice('bass',    [spNote('b1', 60, 0), spNote('b2', 74, 4)]),
      makeVoice('soprano', [spNote('s1', 72, 0), spNote('s2', 69, 4)]),
    ],
  };

  it('message says "X above Y" with beat number', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'voice-crossing')!;
    expect(d.message).toMatch(/Bass above Soprano/);
    expect(d.message).toMatch(/beat 5/);
  });

  it('detail shows both pitches with voice labels', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'voice-crossing')!;
    expect(d.detail).toMatch(/Bass/);
    expect(d.detail).toMatch(/Soprano/);
  });
});

describe('analyzeHarmony — range-violation message format', () => {
  // Bass B1 (MIDI 35) < min 40 → too low
  it('message uses "Out of range — Voice, beat N" format', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass', [{
          id: 'b1',
          spelledPitch: { letter: 'B', accidental: 0, octave: 1 },
          startBeat: 0,
          duration: 'quarter',
        }]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'range-violation')!;
    expect(d.message).toBe('Out of range — Bass, beat 1');
  });

  it('detail names the pitch and direction', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('bass', [{
          id: 'b1',
          spelledPitch: { letter: 'B', accidental: 0, octave: 1 },
          startBeat: 0,
          duration: 'quarter',
        }]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'range-violation')!;
    expect(d.detail).toMatch(/B1/);
    expect(d.detail).toMatch(/too low/);
  });
});

describe('analyzeHarmony — augmented-melodic-interval message format', () => {
  // Tenor: F3(MIDI 53) → G#3(MIDI 56) — augmented 2nd (3 semitones, generic 2nd)
  it('message uses "Aug. interval — Voice, beat X→Y" format', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('tenor', [spNote('t1', 53, 0), spNote('t2', 56, 1)]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'augmented-melodic-interval')!;
    expect(d.message).toBe('Aug. interval — Tenor, beat 1→2');
  });

  it('detail shows the pitch movement', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('tenor', [spNote('t1', 53, 0), spNote('t2', 56, 1)]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'augmented-melodic-interval')!;
    // F3 → G♯3 (spelledPitchToString uses ♯ symbol)
    expect(d.detail).toMatch(/F3/);
    expect(d.detail).toMatch(/G♯3/);
  });
});

describe('analyzeHarmony — leading-tone-descent message format', () => {
  // Soprano: B4(71) → A4(69) in C major — leading tone descends to non-dominant
  it('message uses "Leading tone descent — Voice, beat X→Y" format', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('soprano', [spNote('s1', 71, 0), spNote('s2', 69, 1)]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'leading-tone-descent')!;
    expect(d.message).toBe('Leading tone descent — Soprano, beat 1→2');
  });

  it('detail shows pitch movement and resolution hint', () => {
    const comp: Composition = {
      ...BASE,
      voices: [
        makeVoice('soprano', [spNote('s1', 71, 0), spNote('s2', 69, 1)]),
      ],
    };
    const d = analyzeHarmony(comp).find(d => d.type === 'leading-tone-descent')!;
    expect(d.detail).toMatch(/B4.*A4/);
    expect(d.detail).toContain('should rise to tonic');
  });
});

describe('analyzeHarmony — voice-overlap message format', () => {
  // Tenor beat 0: E3(52 quarter), Bass beat 1: F3(53 quarter)
  // Bass's current note (F3=53) > Tenor's previous note (E3=52) → overlap
  const comp: Composition = {
    ...BASE,
    voices: [
      makeVoice('bass',  [spNote('b1', 53, 1)]),
      makeVoice('tenor', [spNote('t1', 52, 0), spNote('t2', 52, 1)]),
    ],
  };

  it('message names both voices and uses beat X→Y format', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'voice-overlap')!;
    expect(d.message).toMatch(/Bass/);
    expect(d.message).toMatch(/Tenor/);
    expect(d.message).toMatch(/beat \d+→\d+/);
  });

  it('detail is present', () => {
    const d = analyzeHarmony(comp).find(d => d.type === 'voice-overlap')!;
    expect(d.detail).toBeTruthy();
  });
});

// ── computeBeatChordEntries ───────────────────────────────────────────────────

describe('computeBeatChordEntries', () => {
  const mkNote = (midi: number, start: number, duration: Note['duration'] = 'quarter'): Note => ({
    id: genId(),
    spelledPitch: spellMidi(midi, C_MAJOR),
    startBeat: start,
    duration,
  });

  const soprano = (notes: Note[]): Voice => makeVoice('soprano', notes);
  const alto    = (notes: Note[]): Voice => makeVoice('alto', notes);
  const tenor   = (notes: Note[]): Voice => makeVoice('tenor', notes);
  const bass    = (notes: Note[]): Voice => makeVoice('bass', notes);

  it('empty voices → all entries empty', () => {
    const entries = computeBeatChordEntries([], [], -1, 4, 4, C_MAJOR);
    expect(entries.every(e => e.degree === '' && e.chord === '')).toBe(true);
  });

  it('C major triad whole note shows I / C only on beat 0 (startBeat)', () => {
    const voices = [
      soprano([mkNote(64, 0, 'whole')]),
      alto   ([mkNote(60, 0, 'whole')]),
      tenor  ([mkNote(67, 0, 'whole')]),
    ];
    const entries = computeBeatChordEntries(voices, [], -1, 4, 4, C_MAJOR);
    expect(entries[0]).toMatchObject({ degree: 'I', chord: 'C' });
    expect(entries[1]).toMatchObject({ degree: '', chord: '' });
    expect(entries[2]).toMatchObject({ degree: '', chord: '' });
    expect(entries[3]).toMatchObject({ degree: '', chord: '' });
  });

  it('chord change mid-measure: I at beat 0, V at beat 2', () => {
    // C major (C4=60, E4=64, G4=67) → G major (G3=55, B3=59, D4=62)
    const voices = [
      soprano([mkNote(64, 0, 'half'), mkNote(62, 2, 'half')]),
      alto   ([mkNote(60, 0, 'half'), mkNote(59, 2, 'half')]),
      tenor  ([mkNote(67, 0, 'half'), mkNote(55, 2, 'half')]),
    ];
    const entries = computeBeatChordEntries(voices, [], -1, 4, 4, C_MAJOR);
    expect(entries[0]).toMatchObject({ degree: 'I',  chord: 'C' });
    expect(entries[1]).toMatchObject({ degree: '',   chord: '' });
    expect(entries[2]).toMatchObject({ degree: 'V',  chord: 'G' });
    expect(entries[3]).toMatchObject({ degree: '',   chord: '' });
  });

  it('unrecognized notes show ? on onset only', () => {
    const voices = [
      bass([
        { id: genId(), spelledPitch: { letter: 'F', accidental: 1, octave: 3 }, startBeat: 0, duration: 'whole' },
      ]),
      tenor([
        { id: genId(), spelledPitch: { letter: 'A', accidental: 0, octave: 3 }, startBeat: 0, duration: 'whole' },
      ]),
    ];
    const entries = computeBeatChordEntries(voices, [], -1, 4, 4, C_MAJOR);
    expect(entries[0]).toMatchObject({ degree: '?', chord: '?' });
    expect(entries[1]).toMatchObject({ degree: '', chord: '' });
  });

  it('beats before notes start are empty', () => {
    // chord starts at beat 2; beats 0 and 1 have no notes → empty
    const voices = [
      soprano([mkNote(64, 2, 'half')]),
      alto   ([mkNote(60, 2, 'half')]),
      tenor  ([mkNote(67, 2, 'half')]),
    ];
    const entries = computeBeatChordEntries(voices, [], -1, 4, 4, C_MAJOR);
    expect(entries[0]).toMatchObject({ degree: '', chord: '' });
    expect(entries[1]).toMatchObject({ degree: '', chord: '' });
    expect(entries[2]).toMatchObject({ degree: 'I', chord: 'C' });
  });
});
