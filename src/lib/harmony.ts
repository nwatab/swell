/**
 * Harmony analysis: pitch spelling, key utilities, and voice-leading diagnostics.
 *
 * Design:
 *   - spellMidi(midi, key)  — maps a MIDI integer to an enharmonically unambiguous SpelledPitch
 *   - keyAtBeat(composition, beat) — resolves the active KeySignature (global + modulations)
 *   - analyzeHarmony(composition)  — returns Diagnostic[] (errors / warnings / infos)
 */

import type {
  Composition,
  Note,
  KeySignature,
  SpelledPitch,
  NoteLetter,
  Accidental,
} from '../types/song';
import { PITCH_CLASS_NAMES } from '../types/song';

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

/** Returns the active key at a given beat (respects modulations). */
export const keyAtBeat = (song: Composition, beat: number): KeySignature => {
  if (!song.modulations?.length) return song.globalKey;
  // The last modulation whose beat is ≤ the query beat wins; fall back to globalKey.
  const active = song.modulations
    .filter(m => m.beat <= beat)
    .reduce<{ beat: number; key: KeySignature } | null>(
      (best, m) => (!best || m.beat >= best.beat ? m : best),
      null,
    );
  return active ? active.key : song.globalKey;
};

/** Root pitch class index (0–11) for a key. */
const rootPc = (key: KeySignature): number => PITCH_CLASS_NAMES.indexOf(key.root);

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
export const isDiatonicPitch = (midi: number, key: KeySignature): boolean =>
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

// ── Key transform ─────────────────────────────────────────────────────────────

/**
 * Remap diatonic notes so each note keeps its scale degree in the new key.
 *
 * Works for any combination of root change and/or mode change:
 *   - Same root, mode change  (C minor → C major):  Eb→E, Ab→A, Bb→B
 *   - Root change, same mode  (C minor → C# minor):  all notes shift +1
 *   - Both change             (C minor → C# major):  degree-by-degree remap
 *
 * Chromatic notes are left unchanged (pitch preserved, originalMidi set).
 * The transform is reversible: applying the inverse key pair restores pitches.
 */
export const applyKeyTransform = (
  notes: readonly Note[],
  oldKey: KeySignature,
  newKey: KeySignature,
): readonly Note[] => {
  if (oldKey.root === newKey.root && oldKey.mode === newKey.mode) return notes;

  const oldRpc = rootPc(oldKey);
  const newRpc = rootPc(newKey);
  const oldIntvls = modeIntervals(oldKey) as readonly number[];
  const newIntvls = modeIntervals(newKey) as readonly number[];

  return notes.map(n => {
    const pc = ((n.pitch % 12) + 12) % 12;
    const deg = scaleDegreeIndex(pc, oldKey);
    if (deg === -1) return n; // chromatic — leave unchanged

    const oldPc = (oldRpc + oldIntvls[deg]) % 12;
    const newPc = (newRpc + newIntvls[deg]) % 12;

    // Minimal semitone delta to reach newPc from current pitch
    let delta = (newPc - oldPc + 12) % 12;
    if (delta > 6) delta -= 12; // prefer the shorter direction
    if (delta === 0) return n;

    return {
      ...n,
      pitch: n.pitch + delta,
      originalMidi: n.originalMidi ?? n.pitch,
    };
  });
};

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
  | 'chromatic'     // non-diatonic with no identifiable tonal function
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

  for (const note of song.notes) {
    const hasSibling = song.notes.some(
      other =>
        other.id !== note.id &&
        other.startBeat < note.startBeat + note.durationBeats &&
        note.startBeat < other.startBeat + other.durationBeats,
    );

    let fn: NoteFunction;
    if (hasSibling) {
      fn = 'chord_tone';
    } else {
      const key = keyAtBeat(song, note.startBeat);
      fn = !isDiatonicPitch(note.pitch, key) ? 'chromatic' : 'unanalyzed';
    }
    result.set(note.id, fn);
  }

  return result;
};

// ── Diagnostic types ──────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DiagnosticType =
  | 'parallel-fifth'
  | 'parallel-octave'
  | 'voice-crossing'
  | 'out-of-scale';

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly type: DiagnosticType;
  readonly message: string;
  /** IDs of the note(s) that triggered this diagnostic. */
  readonly noteIds: readonly string[];
  /** Beat where the issue occurs (0-indexed). */
  readonly beat: number;
}

// ── Harmony analysis ──────────────────────────────────────────────────────────

const pitchLabel = (midi: number, key: KeySignature): string => {
  const pc = ((midi % 12) + 12) % 12;
  const deg = scaleDegreeIndex(pc, key);
  if (deg !== -1) return spelledPitchToString(spellMidi(midi, key));
  return `${PITCH_CLASS_NAMES[pc]}${Math.floor(midi / 12) - 1}`;
};

/**
 * Analyze a song for common harmony violations.
 *
 * Detects:
 *   - Out-of-scale notes (info) when globalKey is set
 *   - Parallel 5ths (error) between voiced parts
 *   - Parallel octaves (error) between voiced parts
 *   - Voice crossing (warning) when voices swap registers
 */
export const analyzeHarmony = (song: Composition): readonly Diagnostic[] => {
  const diags: Diagnostic[] = [];

  // ── 1. Out-of-scale notes ──────────────────────────────────────────────────
  for (const note of song.notes) {
    const key = keyAtBeat(song, note.startBeat);
    if (!isDiatonicPitch(note.pitch, key)) {
      diags.push({
        severity: 'info',
        type: 'out-of-scale',
        message: `${pitchLabel(note.pitch, key)} is not in ${key.root} ${key.mode}`,
        noteIds: [note.id],
        beat: note.startBeat,
      });
    }
  }

  // ── Part-based analysis (needs at least 2 voiced parts) ──────────────
  const partedNotes = song.notes.filter(n => n.partId);
  const partIds = [...new Set(partedNotes.map(n => n.partId!))];
  if (partIds.length < 2) return diags;

  // Unique beats, sorted
  const beats = [...new Set(partedNotes.map(n => n.startBeat))].sort((a, b) => a - b);

  // Map beat → (partId → Note)
  const snapshots = beats.map(beat => {
    const map = new Map<string, Note>();
    for (const n of partedNotes) {
      if (n.startBeat === beat && n.partId) map.set(n.partId, n);
    }
    return { beat, map };
  });

  // ── 2. Parallel 5ths and octaves ──────────────────────────────────────────
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    // Only check part pairs present in both snapshots
    const commonParts = partIds.filter(id => prev.map.has(id) && curr.map.has(id));

    for (let a = 0; a < commonParts.length; a++) {
      for (let b = a + 1; b < commonParts.length; b++) {
        const idA = commonParts[a];
        const idB = commonParts[b];

        const pA = prev.map.get(idA)!.pitch;
        const pB = prev.map.get(idB)!.pitch;
        const cA = curr.map.get(idA)!.pitch;
        const cB = curr.map.get(idB)!.pitch;

        // Both voices must move (not static)
        const motionA = cA - pA;
        const motionB = cB - pB;
        if (motionA === 0 || motionB === 0) continue;

        // Parallel = same direction
        if (Math.sign(motionA) !== Math.sign(motionB)) continue;

        const intervalPrev = Math.abs(pA - pB);
        const intervalCurr = Math.abs(cA - cB);

        // Perfect 5th (7 semitones mod 12)
        if (intervalPrev % 12 === 7 && intervalCurr % 12 === 7) {
          diags.push({
            severity: 'error',
            type: 'parallel-fifth',
            message: `Parallel 5ths between voices at beat ${curr.beat + 1}`,
            noteIds: [curr.map.get(idA)!.id, curr.map.get(idB)!.id],
            beat: curr.beat,
          });
        }

        // Perfect octave (12 semitones, not unison)
        if (
          intervalPrev % 12 === 0 && intervalPrev > 0 &&
          intervalCurr % 12 === 0 && intervalCurr > 0
        ) {
          diags.push({
            severity: 'error',
            type: 'parallel-octave',
            message: `Parallel octaves between voices at beat ${curr.beat + 1}`,
            noteIds: [curr.map.get(idA)!.id, curr.map.get(idB)!.id],
            beat: curr.beat,
          });
        }
      }
    }
  }

  // ── 3. Voice crossing ─────────────────────────────────────────────────────
  // Infer expected ordering from average pitch per part (lower part = lower pitch)
  const avgPitch = new Map(
    partIds.map(id => {
      const notes = partedNotes.filter(n => n.partId === id);
      return [id, notes.reduce((s, n) => s + n.pitch, 0) / notes.length];
    }),
  );
  const orderedParts = [...partIds].sort(
    (a, b) => (avgPitch.get(a) ?? 0) - (avgPitch.get(b) ?? 0),
  );

  for (const { beat, map } of snapshots) {
    for (let i = 0; i < orderedParts.length - 1; i++) {
      const lower = orderedParts[i];
      const upper = orderedParts[i + 1];
      const nLower = map.get(lower);
      const nUpper = map.get(upper);
      if (!nLower || !nUpper) continue;
      if (nLower.pitch > nUpper.pitch) {
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

  return diags;
};
