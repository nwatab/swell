import {
  isDiatonicPitch,
  getScaleDegree,
  romanNumeral,
  spellMidi,
  spelledPitchToString,
  snapToDiatonic,
  applyKeyTransform,
  keyAtBeat,
  getDiatonicChordIntervals,
  analyzeHarmony,
} from './harmony';
import type { KeySignature, Note, Composition } from '../types/song';
import { genId } from './id';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const C_MAJOR:  KeySignature = { root: 'C',  mode: 'major' };
const G_MAJOR:  KeySignature = { root: 'G',  mode: 'major' };
const EB_MAJOR: KeySignature = { root: 'D#', mode: 'major' }; // Eb
const C_MINOR:  KeySignature = { root: 'C',  mode: 'minor' };
const A_MINOR:  KeySignature = { root: 'A',  mode: 'minor' };
const CS_MAJOR: KeySignature = { root: 'C#', mode: 'major' };

const BASE_COMPOSITION: Composition = {
  id: genId(), version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], tracks: [],
  parts: [], globalKey: C_MAJOR,
};

const note = (
  id: string,
  pitch: number,
  startBeat: number,
  partId?: string,
  duration = 1,
): Note => ({ id, pitch, startBeat, durationBeats: duration, velocity: 100, partId });

// ── isDiatonicPitch ───────────────────────────────────────────────────────────

describe('isDiatonicPitch', () => {
  it('all 7 C-major degrees are diatonic', () => {
    // C D E F G A B
    for (const midi of [60, 62, 64, 65, 67, 69, 71]) {
      expect(isDiatonicPitch(midi, C_MAJOR)).toBe(true);
    }
  });

  it('the 5 chromatic pitches in C major are non-diatonic', () => {
    // C# D# F# G# A#
    for (const midi of [61, 63, 66, 68, 70]) {
      expect(isDiatonicPitch(midi, C_MAJOR)).toBe(false);
    }
  });

  it('works across octaves (C5=72 is diatonic in C major)', () => {
    expect(isDiatonicPitch(72, C_MAJOR)).toBe(true);
  });

  it('Eb (MIDI 63) is diatonic in C minor', () => {
    expect(isDiatonicPitch(63, C_MINOR)).toBe(true);
  });

  it('E natural (MIDI 64) is NOT diatonic in C minor', () => {
    expect(isDiatonicPitch(64, C_MINOR)).toBe(false);
  });

  it('all 7 A-natural-minor degrees are diatonic', () => {
    // A B C D E F G
    for (const midi of [69, 71, 60, 62, 64, 65, 67]) {
      expect(isDiatonicPitch(midi, A_MINOR)).toBe(true);
    }
  });
});

// ── getScaleDegree ────────────────────────────────────────────────────────────

describe('getScaleDegree', () => {
  it('returns 0 for the tonic', () => {
    expect(getScaleDegree(60, C_MAJOR)).toBe(0);
    expect(getScaleDegree(67, G_MAJOR)).toBe(0);
  });

  it('returns correct degrees for C major', () => {
    // C=0, D=1, E=2, F=3, G=4, A=5, B=6
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
    [60, 'C', 0, 4],  // C4
    [62, 'D', 0, 4],  // D4
    [64, 'E', 0, 4],  // E4
    [65, 'F', 0, 4],  // F4
    [67, 'G', 0, 4],  // G4
    [69, 'A', 0, 4],  // A4
    [71, 'B', 0, 4],  // B4
    [72, 'C', 0, 5],  // C5
    [59, 'B', 0, 3],  // B3
  ])('spells MIDI %i as %s%s%s in C major', (midi, letter, accidental, octave) => {
    expect(spellMidi(midi, C_MAJOR)).toEqual({ letter, accidental, octave });
  });

  it('spells C#4 (MIDI 61) as C#4 in C major', () => {
    expect(spellMidi(61, C_MAJOR)).toEqual({ letter: 'C', accidental: 1, octave: 4 });
  });

  it('spells D#4 (MIDI 63) as D#4 in C major (prefer sharp over Eb)', () => {
    expect(spellMidi(63, C_MAJOR)).toEqual({ letter: 'D', accidental: 1, octave: 4 });
  });

  it('spells Eb4 (MIDI 63) as Eb4 in Eb major (diatonic tonic)', () => {
    // root=D# (3), mode=major → spellings[3][0] = ['E', -1]
    expect(spellMidi(63, EB_MAJOR)).toEqual({ letter: 'E', accidental: -1, octave: 4 });
  });

  it('handles B# octave boundary: MIDI 60 spells as B#3 in C# major', () => {
    // In C# major, MIDI 60 (pc=0) is scale degree 6 (B#), octave rolls back by 1
    expect(spellMidi(60, CS_MAJOR)).toEqual({ letter: 'B', accidental: 1, octave: 3 });
  });

  it('spells Eb4 as Eb in C minor', () => {
    // C minor: degree 2 = Eb
    expect(spellMidi(63, C_MINOR)).toEqual({ letter: 'E', accidental: -1, octave: 4 });
  });
});

// ── spelledPitchToString ──────────────────────────────────────────────────────

describe('spelledPitchToString', () => {
  it('natural note', () => expect(spelledPitchToString({ letter: 'C', accidental: 0, octave: 4 })).toBe('C4'));
  it('sharp', () => expect(spelledPitchToString({ letter: 'F', accidental: 1, octave: 3 })).toBe('F♯3'));
  it('flat', () => expect(spelledPitchToString({ letter: 'E', accidental: -1, octave: 4 })).toBe('E♭4'));
  it('double sharp', () => expect(spelledPitchToString({ letter: 'G', accidental: 2, octave: 5 })).toBe('G𝄪5'));
  it('double flat', () => expect(spelledPitchToString({ letter: 'B', accidental: -2, octave: 3 })).toBe('B𝄫3'));
});

// ── snapToDiatonic ────────────────────────────────────────────────────────────

describe('snapToDiatonic', () => {
  it('returns pitch unchanged if already diatonic', () => {
    expect(snapToDiatonic(60, C_MAJOR)).toBe(60); // C
    expect(snapToDiatonic(67, C_MAJOR)).toBe(67); // G
  });

  it('C# (61) → C (60): prefer lower neighbour on equal distance', () => {
    // C=60 is 1 below, D=62 is 1 above — lower wins
    expect(snapToDiatonic(61, C_MAJOR)).toBe(60);
  });

  it('Eb (63) → D (62): lower diatonic neighbour is closer (d=1 below checked first)', () => {
    expect(snapToDiatonic(63, C_MAJOR)).toBe(62);
  });

  it('F# (66) → F (65): lower neighbour wins', () => {
    expect(snapToDiatonic(66, C_MAJOR)).toBe(65);
  });

  it('Ab (68) → G (67): lower neighbour wins', () => {
    expect(snapToDiatonic(68, C_MAJOR)).toBe(67);
  });

  it('Bb (70) → A (69): lower neighbour wins', () => {
    expect(snapToDiatonic(70, C_MAJOR)).toBe(69);
  });
});

// ── keyAtBeat ─────────────────────────────────────────────────────────────────

describe('keyAtBeat', () => {
  it('returns globalKey when no modulations', () => {
    const comp = { ...BASE_COMPOSITION, globalKey: C_MAJOR };
    expect(keyAtBeat(comp, 0)).toEqual(C_MAJOR);
    expect(keyAtBeat(comp, 16)).toEqual(C_MAJOR);
  });

  it('returns globalKey before first modulation', () => {
    const comp = {
      ...BASE_COMPOSITION,
      globalKey: C_MAJOR,
      modulations: [{ beat: 8, key: G_MAJOR }],
    };
    expect(keyAtBeat(comp, 0)).toEqual(C_MAJOR);
    expect(keyAtBeat(comp, 7)).toEqual(C_MAJOR);
  });

  it('returns modulation key from its beat onward', () => {
    const comp = {
      ...BASE_COMPOSITION,
      globalKey: C_MAJOR,
      modulations: [{ beat: 8, key: G_MAJOR }],
    };
    expect(keyAtBeat(comp, 8)).toEqual(G_MAJOR);
    expect(keyAtBeat(comp, 16)).toEqual(G_MAJOR);
  });

  it('picks the latest modulation when multiple exist', () => {
    const comp = {
      ...BASE_COMPOSITION,
      globalKey: C_MAJOR,
      modulations: [
        { beat: 4,  key: G_MAJOR },
        { beat: 16, key: C_MINOR },
      ],
    };
    expect(keyAtBeat(comp, 3)).toEqual(C_MAJOR);
    expect(keyAtBeat(comp, 4)).toEqual(G_MAJOR);
    expect(keyAtBeat(comp, 15)).toEqual(G_MAJOR);
    expect(keyAtBeat(comp, 16)).toEqual(C_MINOR);
  });
});

// ── applyKeyTransform ─────────────────────────────────────────────────────────

describe('applyKeyTransform', () => {
  it('returns notes unchanged for identical key', () => {
    const notes = [note('a', 60, 0)];
    expect(applyKeyTransform(notes, C_MAJOR, C_MAJOR)).toEqual(notes);
  });

  it('C major → C minor: lowers E→Eb, A→Ab, B→Bb', () => {
    const input = [
      note('e', 64, 0), // E4 → Eb4
      note('a', 69, 0), // A4 → Ab4
      note('b', 71, 0), // B4 → Bb4
    ];
    const result = applyKeyTransform(input, C_MAJOR, C_MINOR);
    expect(result.find(n => n.id === 'e')!.pitch).toBe(63); // Eb4
    expect(result.find(n => n.id === 'a')!.pitch).toBe(68); // Ab4
    expect(result.find(n => n.id === 'b')!.pitch).toBe(70); // Bb4
  });

  it('C major → C minor: leaves C, D, F, G unchanged', () => {
    const input = [
      note('c', 60, 0),
      note('d', 62, 0),
      note('f', 65, 0),
      note('g', 67, 0),
    ];
    const result = applyKeyTransform(input, C_MAJOR, C_MINOR);
    for (const n of result) {
      expect(n.pitch).toBe(input.find(i => i.id === n.id)!.pitch);
    }
  });

  it('C major → G major: tonic moves by minimal delta (C4→G3, -5 semitones)', () => {
    const input = [note('c', 60, 0)]; // C4, degree 0
    const result = applyKeyTransform(input, C_MAJOR, G_MAJOR);
    // newPc=7, oldPc=0, delta=(7-0)%12=7 >6 → -5 → 60-5=55 (G3)
    expect(result[0].pitch).toBe(55);
  });

  it('chromatic notes are left unchanged', () => {
    const input = [note('cs', 61, 0)]; // C# — not in C major
    const result = applyKeyTransform(input, C_MAJOR, G_MAJOR);
    expect(result[0].pitch).toBe(61);
  });

  it('sets originalMidi on the first transform', () => {
    const input = [note('e', 64, 0)];
    const result = applyKeyTransform(input, C_MAJOR, C_MINOR);
    expect(result[0].originalMidi).toBe(64);
  });

  it('preserves existing originalMidi on subsequent transforms', () => {
    const alreadyTransformed = [{ ...note('e', 63, 0), originalMidi: 64 }]; // Eb, original was E
    const result = applyKeyTransform(alreadyTransformed, C_MINOR, C_MAJOR);
    expect(result[0].originalMidi).toBe(64); // unchanged
  });
});

// ── getDiatonicChordIntervals ─────────────────────────────────────────────────

describe('getDiatonicChordIntervals', () => {
  it('returns null for chromatic root', () => {
    expect(getDiatonicChordIntervals(61, C_MAJOR)).toBeNull(); // C#
  });

  it('C in C major → major triad [0, 4, 7]', () => {
    expect(getDiatonicChordIntervals(60, C_MAJOR)).toEqual([0, 4, 7]);
  });

  it('D in C major → minor triad [0, 3, 7]', () => {
    expect(getDiatonicChordIntervals(62, C_MAJOR)).toEqual([0, 3, 7]);
  });

  it('B in C major → diminished triad [0, 3, 6]', () => {
    expect(getDiatonicChordIntervals(71, C_MAJOR)).toEqual([0, 3, 6]);
  });

  it('C in C major with seventh → Imaj7 [0, 4, 7, 11]', () => {
    expect(getDiatonicChordIntervals(60, C_MAJOR, true)).toEqual([0, 4, 7, 11]);
  });

  it('G in C major with seventh → V7 [0, 4, 7, 10]', () => {
    expect(getDiatonicChordIntervals(67, C_MAJOR, true)).toEqual([0, 4, 7, 10]);
  });

  it('A in C minor → VI major triad [0, 4, 7]', () => {
    // C minor: degrees i ii° III iv v VI VII → A is degree 5 → VI major
    expect(getDiatonicChordIntervals(68, C_MINOR)).toEqual([0, 4, 7]); // Ab in C minor
  });
});

// ── analyzeHarmony ────────────────────────────────────────────────────────────

describe('analyzeHarmony — out-of-scale', () => {
  it('emits info for a chromatic note', () => {
    const comp = {
      ...BASE_COMPOSITION,
      notes: [note('cs', 61, 0)], // C# — not in C major
    };
    const diags = analyzeHarmony(comp);
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe('info');
    expect(diags[0].type).toBe('out-of-scale');
    expect(diags[0].noteIds).toContain('cs');
  });

  it('emits no diagnostics for all-diatonic notes', () => {
    const comp = {
      ...BASE_COMPOSITION,
      notes: [note('c', 60, 0), note('e', 64, 0), note('g', 67, 0)],
    };
    expect(analyzeHarmony(comp)).toHaveLength(0);
  });
});

describe('analyzeHarmony — parallel fifths', () => {
  const PART_A = 'pa';
  const PART_B = 'pb';

  it('detects parallel fifths between two voices', () => {
    // Voice A: C4→G4 (+7), Voice B: G4→D5 (+7) — both move up a fifth in parallel
    const comp: Composition = {
      ...BASE_COMPOSITION,
      notes: [
        note('a1', 60, 0, PART_A),  // C4
        note('b1', 67, 0, PART_B),  // G4   interval = 7 (fifth)
        note('a2', 67, 1, PART_A),  // G4
        note('b2', 74, 1, PART_B),  // D5   interval = 7 (fifth) — parallel
      ],
    };
    const diags = analyzeHarmony(comp);
    const p5 = diags.filter(d => d.type === 'parallel-fifth');
    expect(p5).toHaveLength(1);
    expect(p5[0].severity).toBe('error');
  });

  it('no parallel fifths when motion is contrary', () => {
    const comp: Composition = {
      ...BASE_COMPOSITION,
      notes: [
        note('a1', 60, 0, PART_A),  // C4
        note('b1', 67, 0, PART_B),  // G4
        note('a2', 67, 1, PART_A),  // G4  (up)
        note('b2', 60, 1, PART_B),  // C4  (down) — contrary motion
      ],
    };
    const diags = analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth');
    expect(diags).toHaveLength(0);
  });

  it('no false positive when one voice is static', () => {
    const comp: Composition = {
      ...BASE_COMPOSITION,
      notes: [
        note('a1', 60, 0, PART_A),
        note('b1', 67, 0, PART_B),
        note('a2', 67, 1, PART_A),  // moves
        note('b2', 67, 1, PART_B),  // static
      ],
    };
    const diags = analyzeHarmony(comp).filter(d => d.type === 'parallel-fifth');
    expect(diags).toHaveLength(0);
  });
});

describe('analyzeHarmony — parallel octaves', () => {
  const PA = 'pa', PB = 'pb';

  it('detects parallel octaves', () => {
    const comp: Composition = {
      ...BASE_COMPOSITION,
      notes: [
        note('a1', 60, 0, PA),   // C4
        note('b1', 72, 0, PB),   // C5  interval = 12 (octave)
        note('a2', 67, 1, PA),   // G4
        note('b2', 79, 1, PB),   // G5  interval = 12 — parallel
      ],
    };
    const p8 = analyzeHarmony(comp).filter(d => d.type === 'parallel-octave');
    expect(p8).toHaveLength(1);
    expect(p8[0].severity).toBe('error');
  });
});

describe('analyzeHarmony — voice crossing', () => {
  const PA = 'pa', PB = 'pb';

  it('detects voice crossing when lower voice rises above upper', () => {
    // Voice A avg < Voice B avg → A is "lower", B is "upper"
    // At beat 4: A (high) > B (low) → crossing
    const comp: Composition = {
      ...BASE_COMPOSITION,
      notes: [
        note('a1', 60, 0, PA),   // C4 (low) — sets avg for A
        note('b1', 72, 0, PB),   // C5 (high) — sets avg for B
        note('a2', 74, 4, PA),   // D5 — A crosses above B
        note('b2', 65, 4, PB),   // F4
      ],
    };
    const vc = analyzeHarmony(comp).filter(d => d.type === 'voice-crossing');
    expect(vc).toHaveLength(1);
    expect(vc[0].severity).toBe('warning');
  });
});
