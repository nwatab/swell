/**
 * Harmony analysis: pitch spelling, key utilities, and voice-leading diagnostics.
 *
 * Design:
 *   - spelledPitchToMidi(sp)  — canonical SpelledPitch → MIDI integer (for rendering/audio)
 *   - spellMidi(midi, key)    — maps a MIDI integer to an enharmonically unambiguous SpelledPitch
 *   - keyAtBeat(composition, beat) — returns the composition's KeySignature
 *   - analyzeHarmony(composition)  — returns Diagnostic[] (errors / warnings / infos)
 */

import type {
  Composition,
  Note,
  KeySignature,
  SpelledPitch,
  NoteLetter,
  Accidental,
  VoiceRole,
  HarmonicDeclaration,
  ChordQuality,
  PitchClass,
} from '../types/song';
import { DURATION_BEATS } from '../types/song';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

const ROMAN_NUMERALS_MAJOR = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
const ROMAN_NUMERALS_MINOR = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] as const;

/** Semitone offset of each letter within an octave (C=0 .. B=11). */
const LETTER_SEMITONES: Record<NoteLetter, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// ── Degree spelling tables ────────────────────────────────────────────────────
// For each root pitch class (0–11) and each of the 7 scale degrees,
// the preferred [letter, accidental] spelling.
//
// Flat-key enharmonics (3=Eb, 8=Ab, 10=Bb) use flats for cleaner notation;
// sharp-key enharmonics (1=C#, 6=F#) use sharps.

const MAJOR_DEGREE_SPELLINGS: readonly (readonly [NoteLetter, Accidental][])[] = [
  /* 0 C  */ [['C',0],['D',0],['E',0],['F',0],['G',0],['A',0],['B',0]],
  /* 1 C# */ [['C',1],['D',1],['E',1],['F',1],['G',1],['A',1],['B',1]],
  /* 2 D  */ [['D',0],['E',0],['F',1],['G',0],['A',0],['B',0],['C',1]],
  /* 3 Eb */ [['E',-1],['F',0],['G',0],['A',-1],['B',-1],['C',0],['D',0]],
  /* 4 E  */ [['E',0],['F',1],['G',1],['A',0],['B',0],['C',1],['D',1]],
  /* 5 F  */ [['F',0],['G',0],['A',0],['B',-1],['C',0],['D',0],['E',0]],
  /* 6 F# */ [['F',1],['G',1],['A',1],['B',0],['C',1],['D',1],['E',1]],
  /* 7 G  */ [['G',0],['A',0],['B',0],['C',0],['D',0],['E',0],['F',1]],
  /* 8 Ab */ [['A',-1],['B',-1],['C',0],['D',-1],['E',-1],['F',0],['G',0]],
  /* 9 A  */ [['A',0],['B',0],['C',1],['D',0],['E',0],['F',1],['G',1]],
  /* 10 Bb*/ [['B',-1],['C',0],['D',0],['E',-1],['F',0],['G',0],['A',0]],
  /* 11 B */ [['B',0],['C',1],['D',1],['E',0],['F',1],['G',1],['A',1]],
];

const MINOR_DEGREE_SPELLINGS: readonly (readonly [NoteLetter, Accidental][])[] = [
  /* 0 C  */ [['C',0],['D',0],['E',-1],['F',0],['G',0],['A',-1],['B',-1]],
  /* 1 C# */ [['C',1],['D',1],['E',0],['F',1],['G',1],['A',0],['B',0]],
  /* 2 D  */ [['D',0],['E',0],['F',0],['G',0],['A',0],['B',-1],['C',0]],
  /* 3 D# */ [['D',1],['E',1],['F',1],['G',1],['A',1],['B',0],['C',1]],
  /* 4 E  */ [['E',0],['F',1],['G',0],['A',0],['B',0],['C',0],['D',0]],
  /* 5 F  */ [['F',0],['G',0],['A',-1],['B',-1],['C',0],['D',-1],['E',-1]],
  /* 6 F# */ [['F',1],['G',1],['A',0],['B',0],['C',1],['D',0],['E',0]],
  /* 7 G  */ [['G',0],['A',0],['B',-1],['C',0],['D',0],['E',-1],['F',0]],
  /* 8 G# */ [['G',1],['A',1],['B',0],['C',1],['D',1],['E',0],['F',1]],
  /* 9 A  */ [['A',0],['B',0],['C',0],['D',0],['E',0],['F',0],['G',0]],
  /* 10 A#*/ [['A',1],['B',1],['C',1],['D',1],['E',1],['F',1],['G',1]],
  /* 11 B */ [['B',0],['C',1],['D',0],['E',0],['F',1],['G',0],['A',0]],
];

// ── Key utilities ─────────────────────────────────────────────────────────────

/** Returns the active key. Modulations are not supported in MVP — always returns keySignature. */
export const keyAtBeat = (song: Composition, _: number): KeySignature =>
  song.keySignature;

/** Root pitch class index (0–11) for a key. */
const rootPc = (key: KeySignature): number =>
  (LETTER_SEMITONES[key.tonic.letter] + key.tonic.accidental + 12) % 12;

/** Scale intervals for a mode. */
const modeIntervals = (key: KeySignature): readonly number[] =>
  key.mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;

/** Degree spellings table for a mode. */
const modeSpellings = (key: KeySignature) =>
  key.mode === 'major' ? MAJOR_DEGREE_SPELLINGS : MINOR_DEGREE_SPELLINGS;

/**
 * Scale degree index (0–6) of a pitch class in the given key, or -1 if not diatonic.
 */
const scaleDegreeIndex = (pc: number, key: KeySignature): number => {
  const rel = ((pc - rootPc(key)) + 12) % 12;
  return (modeIntervals(key) as readonly number[]).indexOf(rel);
};

/** True when the MIDI pitch is diatonic in key. */
const isDiatonicPitch = (midi: number, key: KeySignature): boolean =>
  scaleDegreeIndex(((midi % 12) + 12) % 12, key) !== -1;

/**
 * Scale degree (0-based) of the MIDI pitch in the key, or null if chromatic.
 * Used for Roman numeral display on the piano keyboard.
 */
export const getScaleDegree = (midi: number, key: KeySignature): number | null => {
  const idx = scaleDegreeIndex(((midi % 12) + 12) % 12, key);
  return idx === -1 ? null : idx;
};

/** Roman numeral label for the scale degree, or null if chromatic. */
export const romanNumeral = (midi: number, key: KeySignature): string | null => {
  const deg = getScaleDegree(midi, key);
  if (deg === null) return null;
  return key.mode === 'major'
    ? ROMAN_NUMERALS_MAJOR[deg]
    : ROMAN_NUMERALS_MINOR[deg];
};

// Roman numeral base (always uppercase; cased by quality below)
const BASE_ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

const QUALITY_IS_MAJOR: Record<ChordQuality, boolean> = {
  maj: true, aug: true, dom7: true, maj7: true,
  min: false, dim: false, min7: false, hdim7: false, dim7: false,
};

const DEGREE_QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '', min: '', dim: '°', aug: '+',
  dom7: '7', maj7: 'M7', min7: '7', hdim7: 'ø7', dim7: '°7',
};

/**
 * Roman numeral degree label for a chord in a key context.
 * Diatonic roots → "V7", "ii°", "IM7"; chromatic roots → "♭VII7", "♯IV°".
 * Prefers ♭ prefix over ♯ for chromatic roots (borrowed chords are more common).
 */
export const chordDegreeLabel = (decl: HarmonicDeclaration, key: KeySignature): string => {
  const pc = ((LETTER_SEMITONES[decl.root.letter] + decl.root.accidental) + 12) % 12;
  const rel = ((pc - rootPc(key)) + 12) % 12;
  const intervals = modeIntervals(key) as readonly number[];

  let degIdx = intervals.indexOf(rel);
  let accPrefix = '';

  if (degIdx === -1) {
    const flatTarget = (rel + 1) % 12;
    const sharpTarget = (rel - 1 + 12) % 12;
    const flatDeg = intervals.indexOf(flatTarget);
    const sharpDeg = intervals.indexOf(sharpTarget);
    if (flatDeg !== -1) { degIdx = flatDeg; accPrefix = '♭'; }
    else if (sharpDeg !== -1) { degIdx = sharpDeg; accPrefix = '♯'; }
    else return `${decl.root.letter}${DEGREE_QUALITY_SUFFIX[decl.quality]}`; // fallback
  }

  const base = BASE_ROMANS[degIdx];
  const cased = QUALITY_IS_MAJOR[decl.quality] ? base : base.toLowerCase();
  return accPrefix + cased + DEGREE_QUALITY_SUFFIX[decl.quality];
};

// ── Diatonic chord intervals ──────────────────────────────────────────────────
//
// Semitone intervals for the triad / seventh chord built on each scale degree.
// These are chromatic (semitone) intervals, which is correct: the triad built
// on, e.g., the ii degree of any major key is always [0, 3, 7] semitones.

const DIATONIC_TRIADS: Record<string, readonly (readonly number[])[]> = {
  major: [
    [0, 4, 7],  // I   major
    [0, 3, 7],  // ii  minor
    [0, 3, 7],  // iii minor
    [0, 4, 7],  // IV  major
    [0, 4, 7],  // V   major
    [0, 3, 7],  // vi  minor
    [0, 3, 6],  // vii° diminished
  ],
  minor: [
    [0, 3, 7],  // i   minor
    [0, 3, 6],  // ii° diminished
    [0, 4, 7],  // III major
    [0, 3, 7],  // iv  minor
    [0, 3, 7],  // v   minor  (natural minor; use V major in harmonic context)
    [0, 4, 7],  // VI  major
    [0, 4, 7],  // VII major
  ],
};

const DIATONIC_SEVENTHS: Record<string, readonly (readonly number[])[]> = {
  major: [
    [0, 4, 7, 11], // Imaj7
    [0, 3, 7, 10], // ii7
    [0, 3, 7, 10], // iii7
    [0, 4, 7, 11], // IVmaj7
    [0, 4, 7, 10], // V7  (dominant)
    [0, 3, 7, 10], // vi7
    [0, 3, 6, 10], // viiø7 (half-diminished)
  ],
  minor: [
    [0, 3, 7, 10], // i7
    [0, 3, 6, 10], // iiø7  (half-diminished)
    [0, 4, 7, 11], // IIImaj7
    [0, 3, 7, 10], // iv7
    [0, 3, 7, 10], // v7
    [0, 4, 7, 11], // VImaj7
    [0, 4, 7, 10], // VII7
  ],
};

const DIATONIC_TRIAD_QUALITY: Record<string, readonly ChordQuality[]> = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
};

const DIATONIC_SEVENTH_QUALITY: Record<string, readonly ChordQuality[]> = {
  major: ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'hdim7'],
  minor: ['min7', 'hdim7', 'maj7', 'min7', 'min7', 'maj7', 'dom7'],
};

/**
 * Returns the diatonic chord intervals (semitones from root) for a pitch in a key,
 * or null if the pitch is not diatonic.
 *
 * @param withSeventh  true → four-note seventh chord; false → triad
 */
export const getDiatonicChordIntervals = (
  midi: number,
  key: KeySignature,
  withSeventh = false,
): readonly number[] | null => {
  const deg = scaleDegreeIndex(((midi % 12) + 12) % 12, key);
  if (deg === -1) return null;
  const table = withSeventh ? DIATONIC_SEVENTHS : DIATONIC_TRIADS;
  return table[key.mode][deg];
};

/** ChordQuality for the diatonic triad or seventh chord built on the given MIDI pitch in the key. */
export const diatonicChordQuality = (midi: number, key: KeySignature, withSeventh = false): ChordQuality | null => {
  const deg = scaleDegreeIndex(((midi % 12) + 12) % 12, key);
  if (deg === -1) return null;
  return withSeventh ? DIATONIC_SEVENTH_QUALITY[key.mode][deg] : DIATONIC_TRIAD_QUALITY[key.mode][deg];
};

/**
 * Infer the diatonic chord (root + quality) formed by the given notes in the key context.
 * Checks all 7 scale degrees; prefers seventh chord when all 4 unique pitch classes match exactly.
 * Returns null if no diatonic chord matches.
 */
export const inferChordFromNotes = (
  notes: readonly { spelledPitch: SpelledPitch }[],
  key: KeySignature,
): { root: PitchClass; quality: ChordQuality } | null => {
  const pcs = [...new Set(notes.map(n => ((spelledPitchToMidi(n.spelledPitch) % 12) + 12) % 12))];
  const rpc = rootPc(key);
  const intervals = modeIntervals(key) as number[];
  const spellings = modeSpellings(key);

  for (let deg = 0; deg < 7; deg++) {
    const chordRootPc = (rpc + intervals[deg]) % 12;
    const seventhPcs = (DIATONIC_SEVENTHS[key.mode][deg] as number[]).map(i => (chordRootPc + i) % 12);
    if (pcs.length === 4 && pcs.every(pc => seventhPcs.includes(pc))) {
      const [letter, accidental] = spellings[rpc][deg];
      return { root: { letter, accidental }, quality: DIATONIC_SEVENTH_QUALITY[key.mode][deg] };
    }
    const triadPcs = (DIATONIC_TRIADS[key.mode][deg] as number[]).map(i => (chordRootPc + i) % 12);
    if (pcs.every(pc => triadPcs.includes(pc))) {
      const [letter, accidental] = spellings[rpc][deg];
      return { root: { letter, accidental }, quality: DIATONIC_TRIAD_QUALITY[key.mode][deg] };
    }
  }
  return null;
};

// ── Key transform ─────────────────────────────────────────────────────────────

/**
 * Snap a MIDI pitch to the nearest diatonic pitch in the key.
 * If the pitch is already diatonic, it is returned unchanged.
 * On a tie (equidistant neighbours), the lower pitch is preferred.
 */
export const snapToDiatonic = (midi: number, key: KeySignature): number => {
  if (isDiatonicPitch(midi, key)) return midi;
  for (let d = 1; d <= 6; d++) {
    if (isDiatonicPitch(midi - d, key)) return midi - d;
    if (isDiatonicPitch(midi + d, key)) return midi + d;
  }
  return midi; // unreachable: every pitch is within 6 semitones of a diatonic note
};

// ── Pitch spelling ────────────────────────────────────────────────────────────

/** Spell a chromatic (non-diatonic) pitch class relative to a key. */
const spellChromatic = (pc: number, key: KeySignature): [NoteLetter, Accidental] => {
  const rpc = rootPc(key);
  const intervals = modeIntervals(key);
  const spellings = modeSpellings(key);
  const rel = ((pc - rpc) + 12) % 12;

  // Find the diatonic degree just below the chromatic pitch
  let lowerDeg = intervals.length - 1;
  for (let d = 0; d < intervals.length; d++) {
    if (intervals[d] >= rel) {
      lowerDeg = d === 0 ? intervals.length - 1 : d - 1;
      break;
    }
  }
  const upperDeg = (lowerDeg + 1) % intervals.length;

  const [lL, lA] = spellings[rpc][lowerDeg];
  const [uL, uA] = spellings[rpc][upperDeg];

  const accA = (lA + 1) as Accidental; // lower + sharp
  const accB = (uA - 1) as Accidental; // upper + flat

  // Prefer the spelling with smaller accidental magnitude; avoid double accidentals
  if (Math.abs(accA) <= Math.abs(accB)) return [lL, accA];
  return [uL, accB];
};

/**
 * Convert a MIDI note number to an enharmonically unambiguous SpelledPitch
 * given a key context.
 *
 * The octave is computed so that:
 *   (octave + 1) * 12 + (LETTER_SEMITONES[letter] + accidental) === midi
 *
 * This correctly handles B#n (octave = MIDI octave − 1) and Cbn (octave = MIDI octave + 1).
 */
export const spellMidi = (midi: number, key: KeySignature): SpelledPitch => {
  const pc = ((midi % 12) + 12) % 12;

  const [letter, accidental] =
    scaleDegreeIndex(pc, key) !== -1
      ? [...modeSpellings(key)[rootPc(key)][scaleDegreeIndex(pc, key)]] as [NoteLetter, Accidental]
      : spellChromatic(pc, key);

  const s = LETTER_SEMITONES[letter] + accidental;
  const octave = Math.floor((midi - s) / 12) - 1;

  return { letter, accidental, octave };
};

/** Format a SpelledPitch as a human-readable string, e.g. "E♭4", "F♯3". */
export const spelledPitchToString = ({ letter, accidental, octave }: SpelledPitch): string => {
  const sym = (['𝄫', '♭', '', '♯', '𝄪'] as const)[accidental + 2];
  return `${letter}${sym}${octave}`;
};

/** Convert SpelledPitch to MIDI integer. Use only for rendering/audio — not for storage. */
export const spelledPitchToMidi = ({ letter, accidental, octave }: SpelledPitch): number =>
  (octave + 1) * 12 + LETTER_SEMITONES[letter] + accidental;

// ── Note function (harmonic role) ────────────────────────────────────────────
//
// Distinct from scale membership (isDiatonic / meaning-1).
// This is the harmonic function of a note in context — Analytical layer output.
// NOT stored on Note; produced by computeNoteFunctions() and held separately.
// See ADR-007.

export type NoteFunction =
  | 'chord_tone'    // constitutes a harmonic interval with simultaneous notes
  | 'passing_tone'  // stepwise motion between chord tones
  | 'neighbor_tone' // leaves and returns to the same pitch
  | 'suspension'    // held over from previous harmony, resolves by step
  | 'appoggiatura'  // leap to dissonance, resolves by step
  | 'unanalyzed';   // insufficient context for classification

export type NoteFunctionMap = ReadonlyMap<string, NoteFunction>;

/**
 * Classify the harmonic function of every note in the song.
 *
 * Current implementation: initial heuristics only.
 *   - chord_tone:  note overlaps (in time) with at least one other note
 *   - chromatic:   non-diatonic note with no simultaneous companion
 *   - unanalyzed:  everything else (diatonic, isolated)
 *
 * Passing tone / neighbor tone / suspension detection is planned but not yet
 * implemented (requires voice-leading analysis across consecutive chords).
 */
export const computeNoteFunctions = (song: Composition): NoteFunctionMap => {
  const result = new Map<string, NoteFunction>();
  const allNotes = song.voices.flatMap(v => v.notes);

  for (const note of allNotes) {
    const noteDur = DURATION_BEATS[note.duration];
    const hasSibling = allNotes.some(
      other =>
        other.id !== note.id &&
        other.startBeat < note.startBeat + noteDur &&
        note.startBeat < other.startBeat + DURATION_BEATS[other.duration],
    );

    result.set(note.id, hasSibling ? 'chord_tone' : 'unanalyzed');
  }

  return result;
};

// ── Diagnostic types ──────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DiagnosticType =
  // ── Confirmed errors (hard rules in 芸大和声) ──────────────────────────────
  | 'parallel-fifth'          // 並行5度
  | 'parallel-octave'         // 並行8度
  | 'hidden-fifth'            // 隠伏5度 (outer voices, leap to P5)
  | 'hidden-octave'           // 隠伏8度 (outer voices, leap to P8)
  // ── Warnings (context-dependent) ──────────────────────────────────────────
  | 'voice-crossing'          // 声部交差
  | 'voice-overlap'           // 声部追い越し
  | 'range-violation'         // SATB 声域逸脱
  | 'augmented-melodic-interval' // 増音程の旋律 (augmented 2nd, tritone)
  | 'leading-tone-descent';   // 導音の下行 (leading tone resolves down instead of up)

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly type: DiagnosticType;
  readonly message: string;
  /** IDs of the note(s) that triggered this diagnostic. */
  readonly noteIds: readonly string[];
  /** Beat where the issue occurs (0-indexed). */
  readonly beat: number;
}

// ── SATB comfortable ranges ───────────────────────────────────────────────────
// Standard comfortable ranges (MIDI). Warn when exceeded, not error.

const SATB_RANGES: Partial<Record<VoiceRole, { readonly min: number; readonly max: number }>> = {
  soprano: { min: 60, max: 79 },  // C4 – G5
  alto:    { min: 55, max: 72 },  // G3 – C5
  tenor:   { min: 48, max: 67 },  // C3 – G4
  bass:    { min: 40, max: 60 },  // E2 – C4
};

// ── Interval helpers ──────────────────────────────────────────────────────────

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/**
 * Returns the generic interval size (1=unison, 2=2nd, 3=3rd …) between two
 * SpelledPitches, ignoring direction.
 */
const genericInterval = (a: SpelledPitch, b: SpelledPitch): number => {
  const ai = LETTER_ORDER.indexOf(a.letter);
  const bi = LETTER_ORDER.indexOf(b.letter);
  const octaveDiff = Math.abs(b.octave - a.octave);
  const letterDiff = ((bi - ai + 7) % 7);
  return octaveDiff * 7 + letterDiff + 1; // 1-based
};

/**
 * True when two consecutive SpelledPitches form an augmented 2nd (3 semitones,
 * letter distance = 2nd) or a melodic tritone (augmented 4th / diminished 5th).
 * These are forbidden as melodic intervals in 芸大和声.
 */
const isForbiddenMelodicInterval = (a: SpelledPitch, b: SpelledPitch): boolean => {
  const midiA = (a.octave + 1) * 12 + LETTER_SEMITONES[a.letter] + a.accidental;
  const midiB = (b.octave + 1) * 12 + LETTER_SEMITONES[b.letter] + b.accidental;
  const semitones = Math.abs(midiB - midiA);
  const gen = genericInterval(a, b);

  // Augmented 2nd: generic 2nd (gen=2) with 3 semitones
  if (gen === 2 && semitones === 3) return true;
  // Augmented 4th / diminished 5th (tritone): 6 semitones
  if ((gen === 4 || gen === 5) && semitones === 6) return true;
  return false;
};

// ── Harmony analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a composition for harmony violations.
 *
 * Detects (in order of severity):
 *   Error:   parallel 5ths/8ths, hidden 5ths/8ths (outer voices)
 *   Warning: voice crossing, voice overlap, range violations,
 *            augmented melodic intervals, leading tone descent
 */
export const analyzeHarmony = (song: Composition): readonly Diagnostic[] => {
  const diags: Diagnostic[] = [];

  const activeVoices = song.voices.filter(v => v.notes.length > 0);
  if (activeVoices.length < 1) return diags;

  // SATB order: bass(0) → tenor(1) → alto(2) → soprano(3)
  const ROLE_ORDER: VoiceRole[] = ['bass', 'tenor', 'alto', 'soprano'];

  // Voice timelines: sorted notes per voice
  const voiceTimelines = new Map<string, readonly Note[]>(
    activeVoices.map(v => [
      v.id,
      [...v.notes].sort((a, b) => a.startBeat - b.startBeat),
    ]),
  );

  // Order voices low → high by SATB role
  const orderedVoiceIds = [...activeVoices]
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
    .map(v => v.id);

  // Snapshots: one note per voice per beat
  const allBeats = [...new Set(activeVoices.flatMap(v => v.notes.map(n => n.startBeat)))]
    .sort((a, b) => a - b);
  const snapshots = allBeats.map(beat => {
    const map = new Map<string, Note>();
    for (const v of activeVoices) {
      const note = v.notes.find(n => n.startBeat === beat);
      if (note) map.set(v.id, note);
    }
    return { beat, map };
  });

  // ── 1. SATB range violations ───────────────────────────────────────────────
  for (const v of activeVoices) {
    const range = SATB_RANGES[v.role];
    if (!range) continue;
    for (const note of v.notes) {
      const midi = spelledPitchToMidi(note.spelledPitch);
      if (midi < range.min || midi > range.max) {
        const dir = midi < range.min ? 'low' : 'high';
        diags.push({
          severity: 'warning',
          type: 'range-violation',
          message: `${v.role} ${spelledPitchToString(note.spelledPitch)} is too ${dir} for the ${v.role} range`,
          noteIds: [note.id],
          beat: note.startBeat,
        });
      }
    }
  }

  // ── 2. Augmented melodic intervals ────────────────────────────────────────
  for (const notes of voiceTimelines.values()) {
    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1];
      const curr = notes[i];
      if (isForbiddenMelodicInterval(prev.spelledPitch, curr.spelledPitch)) {
        diags.push({
          severity: 'warning',
          type: 'augmented-melodic-interval',
          message: `Augmented/tritone melodic interval ${spelledPitchToString(prev.spelledPitch)}→${spelledPitchToString(curr.spelledPitch)} at beat ${curr.startBeat + 1}`,
          noteIds: [prev.id, curr.id],
          beat: curr.startBeat,
        });
      }
    }
  }

  // ── 3. Leading tone descent ────────────────────────────────────────────────
  for (const notes of voiceTimelines.values()) {
    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1];
      const curr = notes[i];
      const key = keyAtBeat(song, prev.startBeat);
      const tonicPc = rootPc(key);
      const leadingPc = (tonicPc + 11) % 12;
      const prevMidi = spelledPitchToMidi(prev.spelledPitch);
      const currMidi = spelledPitchToMidi(curr.spelledPitch);
      const prevPc = ((prevMidi % 12) + 12) % 12;
      if (prevPc !== leadingPc) continue;
      if (currMidi >= prevMidi) continue; // ascending or static — fine
      const dominantPc = (tonicPc + 7) % 12;
      const currPc = ((currMidi % 12) + 12) % 12;
      if (currPc === dominantPc) continue; // 7→5 is acceptable
      diags.push({
        severity: 'warning',
        type: 'leading-tone-descent',
        message: `Leading tone ${spelledPitchToString(prev.spelledPitch)} resolves downward at beat ${curr.startBeat + 1} (should rise to tonic)`,
        noteIds: [prev.id, curr.id],
        beat: curr.startBeat,
      });
    }
  }

  // ── 4. Parallel 5ths and octaves (voice-agnostic) ────────────────────────
  // Rule: any pair of simultaneously active notes forming a P5 (or P8),
  // followed by another P5 (or P8) with same-direction motion, is a violation.
  // Voice ID is used only for succession tracking (which note follows which),
  // not as a filter on which pairs to compare.
  const noteVoiceId = new Map<string, string>();
  for (const v of activeVoices) {
    for (const n of v.notes) noteVoiceId.set(n.id, v.id);
  }

  const seenParallel = new Set<string>();

  for (let i = 1; i < allBeats.length; i++) {
    const prevBeat = allBeats[i - 1];
    const currBeat = allBeats[i];

    // All notes sounding at prevBeat (started at or before, not yet ended)
    const prevActive = activeVoices.flatMap(v =>
      voiceTimelines.get(v.id)!.filter(
        n => n.startBeat <= prevBeat && prevBeat < n.startBeat + DURATION_BEATS[n.duration],
      )
    );

    for (let ai = 0; ai < prevActive.length; ai++) {
      for (let bi = ai + 1; bi < prevActive.length; bi++) {
        const a = prevActive[ai];
        const b = prevActive[bi];
        const midiA = spelledPitchToMidi(a.spelledPitch);
        const midiB = spelledPitchToMidi(b.spelledPitch);
        const ivPrev = Math.abs(midiA - midiB);
        const isP5prev = ivPrev % 12 === 7;
        const isP8prev = ivPrev % 12 === 0 && ivPrev > 0;
        if (!isP5prev && !isP8prev) continue;

        // Successors: all notes active in each note's voice at currBeat
        const succsA = voiceTimelines.get(noteVoiceId.get(a.id)!)!.filter(
          n => n.startBeat <= currBeat && currBeat < n.startBeat + DURATION_BEATS[n.duration],
        );
        const succsB = voiceTimelines.get(noteVoiceId.get(b.id)!)!.filter(
          n => n.startBeat <= currBeat && currBeat < n.startBeat + DURATION_BEATS[n.duration],
        );

        for (const ap of succsA) {
          for (const bp of succsB) {
            if (ap.id === bp.id) continue;
            const midiAp = spelledPitchToMidi(ap.spelledPitch);
            const midiBp = spelledPitchToMidi(bp.spelledPitch);
            const ivCurr = Math.abs(midiAp - midiBp);
            const motionA = midiAp - midiA;
            const motionB = midiBp - midiB;
            if (motionA === 0 || motionB === 0) continue; // oblique motion
            if (Math.sign(motionA) !== Math.sign(motionB)) continue; // contrary

            if (isP5prev && ivCurr % 12 === 7) {
              const key = `p5:${[ap.id, bp.id].sort().join(':')}`;
              if (!seenParallel.has(key)) {
                seenParallel.add(key);
                diags.push({
                  severity: 'error',
                  type: 'parallel-fifth',
                  message: `Parallel 5ths at beat ${currBeat + 1}`,
                  noteIds: [ap.id, bp.id],
                  beat: currBeat,
                });
              }
            }

            if (isP8prev && ivCurr % 12 === 0 && ivCurr > 0) {
              const key = `p8:${[ap.id, bp.id].sort().join(':')}`;
              if (!seenParallel.has(key)) {
                seenParallel.add(key);
                diags.push({
                  severity: 'error',
                  type: 'parallel-octave',
                  message: `Parallel octaves at beat ${currBeat + 1}`,
                  noteIds: [ap.id, bp.id],
                  beat: currBeat,
                });
              }
            }
          }
        }
      }
    }
  }

  // ── 5. Hidden 5ths and octaves (outer voices only) ────────────────────────
  {
    const outerLowId  = orderedVoiceIds[0];
    const outerHighId = orderedVoiceIds[orderedVoiceIds.length - 1];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      if (!prev.map.has(outerLowId) || !prev.map.has(outerHighId)) continue;
      if (!curr.map.has(outerLowId) || !curr.map.has(outerHighId)) continue;

      const pA = spelledPitchToMidi(prev.map.get(outerLowId)!.spelledPitch);
      const pB = spelledPitchToMidi(prev.map.get(outerHighId)!.spelledPitch);
      const cA = spelledPitchToMidi(curr.map.get(outerLowId)!.spelledPitch);
      const cB = spelledPitchToMidi(curr.map.get(outerHighId)!.spelledPitch);

      const motionA = cA - pA;
      const motionB = cB - pB;
      if (motionA === 0 || motionB === 0) continue;
      if (Math.sign(motionA) !== Math.sign(motionB)) continue;

      const intervalCurr = Math.abs(cA - cB);
      const upperMotion = cA > cB ? motionA : motionB;
      if (Math.abs(upperMotion) <= 2) continue;

      if (intervalCurr % 12 === 7) {
        diags.push({
          severity: 'error',
          type: 'hidden-fifth',
          message: `Hidden 5th between outer voices at beat ${curr.beat + 1} (upper voice leaps to perfect 5th)`,
          noteIds: [curr.map.get(outerLowId)!.id, curr.map.get(outerHighId)!.id],
          beat: curr.beat,
        });
      } else if (intervalCurr % 12 === 0 && intervalCurr > 0) {
        diags.push({
          severity: 'error',
          type: 'hidden-octave',
          message: `Hidden octave between outer voices at beat ${curr.beat + 1} (upper voice leaps to octave)`,
          noteIds: [curr.map.get(outerLowId)!.id, curr.map.get(outerHighId)!.id],
          beat: curr.beat,
        });
      }
    }
  }

  // ── 6. Voice crossing ─────────────────────────────────────────────────────
  for (const { beat, map } of snapshots) {
    for (let i = 0; i < orderedVoiceIds.length - 1; i++) {
      const lower = orderedVoiceIds[i];
      const upper = orderedVoiceIds[i + 1];
      const nLower = map.get(lower);
      const nUpper = map.get(upper);
      if (!nLower || !nUpper) continue;
      if (spelledPitchToMidi(nLower.spelledPitch) > spelledPitchToMidi(nUpper.spelledPitch)) {
        diags.push({
          severity: 'warning',
          type: 'voice-crossing',
          message: `Voice crossing at beat ${beat + 1}`,
          noteIds: [nLower.id, nUpper.id],
          beat,
        });
      }
    }
  }

  // ── 7. Voice overlap (声部追い越し) ───────────────────────────────────────
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    for (let j = 0; j < orderedVoiceIds.length - 1; j++) {
      const lowerId = orderedVoiceIds[j];
      const upperId = orderedVoiceIds[j + 1];
      const prevLower = prev.map.get(lowerId);
      const prevUpper = prev.map.get(upperId);
      const currLower = curr.map.get(lowerId);
      const currUpper = curr.map.get(upperId);

      if (prevUpper && currLower &&
          spelledPitchToMidi(currLower.spelledPitch) > spelledPitchToMidi(prevUpper.spelledPitch)) {
        diags.push({
          severity: 'warning',
          type: 'voice-overlap',
          message: `Voice overlap at beat ${curr.beat + 1}: lower voice crosses above adjacent voice's previous position`,
          noteIds: [currLower.id, prevUpper.id],
          beat: curr.beat,
        });
      }
      if (prevLower && currUpper &&
          spelledPitchToMidi(currUpper.spelledPitch) < spelledPitchToMidi(prevLower.spelledPitch)) {
        diags.push({
          severity: 'warning',
          type: 'voice-overlap',
          message: `Voice overlap at beat ${curr.beat + 1}: upper voice crosses below adjacent voice's previous position`,
          noteIds: [currUpper.id, prevLower.id],
          beat: curr.beat,
        });
      }
    }
  }

  return diags;
};
