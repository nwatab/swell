// Internal file format for Swell compositions
// Serializes to/from JSON (.swell files)

import { genId } from '../lib/id';

export type VoiceRole = 'soprano' | 'alto' | 'tenor' | 'bass' | (string & {});

/**
 * A musical part (voice / instrument role). First-class domain concept.
 * Track (SMF MTrk) is a persistence/export detail — it does not appear in
 * the domain model. See design discussion: Part ≠ Track.
 */
export interface Part {
  readonly id: string;
  readonly name: string;
  readonly color: string; // hex color, e.g. '#60a5fa'
  readonly voice?: VoiceRole;
}

// ── Pitched spelling ──────────────────────────────────────────────────────────

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = -2 | -1 | 0 | 1 | 2; // 𝄫 ♭ ♮ ♯ 𝄪

/** Enharmonically unambiguous pitch representation (D# ≠ Eb). */
export interface SpelledPitch {
  readonly letter: NoteLetter;
  readonly accidental: Accidental;
  readonly octave: number;
}

// ── Key signature ─────────────────────────────────────────────────────────────

export type ScaleMode = 'major' | 'minor';
// NOTE: Do NOT add 'harmonic-minor' here. The raised 7th in minor is a harmony-level
// phenomenon (Chord.quality = 'major' on V), not a key-level one. ScaleMode represents
// the key signature (調号). Future extension is reserved for true modes (Dorian, Mixolydian).
// See ADR-008.

/** Chromatic pitch class names (sharp-only, matching MIDI convention). */
export type PitchClassName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export const PITCH_CLASS_NAMES: readonly PitchClassName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export interface KeySignature {
  readonly root: PitchClassName;
  readonly mode: ScaleMode;
}

/** A key change at a specific beat (for mid-composition modulations). */
export interface Modulation {
  readonly beat: number;
  readonly key: KeySignature;
}

// ── Note binding (author intent) ─────────────────────────────────────────────
// Declares what the author *intended* a note to be — distinct from NoteFunction
// (ADR-007) which is the analytical result. See ADR-008.

/** The role a note plays within its chord. */
export type NoteRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ninth';

/**
 * Author's intent binding for a note. See ADR-008.
 *
 * - absolute:        Exact SpelledPitch — unaffected by key changes.
 * - chord_tone:      Belongs to a specific chord; follows chord root on key change.
 *                    `alteration` is a voice-level semitone adjustment (NOT for chord-defining
 *                    changes like ♭5 or ♯9 — those belong in ChordQuality).
 * - scale_degree:    Follows the scale degree of the current key. Used for modal music.
 *                    `alteration` is a semitone offset from the canonical degree pitch.
 * - non_chord_tone:  An explicitly declared non-harmonic tone. The analytical layer
 *                    (NoteFunction, ADR-007) may confirm or override this declaration.
 *
 * Scope note: NoteRole covers triads + 7th + 9th. sus4/sus2/11th/13th are deferred.
 * See ADR-008 for the chord_tone.alteration vs ChordQuality boundary.
 */
export type NoteBinding =
  | { readonly kind: 'absolute' }
  | { readonly kind: 'chord_tone'; readonly chordId: string; readonly role: NoteRole; readonly alteration: Accidental }
  | { readonly kind: 'scale_degree'; readonly degree: 1 | 2 | 3 | 4 | 5 | 6 | 7; readonly alteration: Accidental }
  | { readonly kind: 'non_chord_tone'; readonly function: 'passing' | 'neighbor' | 'appoggiatura' | 'suspension' };

// ── Chord ─────────────────────────────────────────────────────────────────────

/**
 * Quality of a chord.
 * In minor keys, V is 'maj' (not 'min') — the raised 7th is derived from quality,
 * not from a separate ScaleMode. ScaleMode stays 'major' | 'minor'. See ADR-008.
 */
export type ChordQuality =
  | 'maj'    // major triad          [0, 4, 7]
  | 'min'    // minor triad          [0, 3, 7]
  | 'dim'    // diminished triad     [0, 3, 6]
  | 'aug'    // augmented triad      [0, 4, 8]
  | 'dom7'   // dominant 7th         [0, 4, 7, 10]  — V7
  | 'maj7'   // major 7th            [0, 4, 7, 11]  — Imaj7
  | 'min7'   // minor 7th            [0, 3, 7, 10]  — ii7
  | 'hdim7'  // half-diminished 7th  [0, 3, 6, 10]  — iiø7
  | 'dim7';  // fully diminished 7th [0, 3, 6,  9]  — vii°7

/**
 * A declared chord in the composition.
 * Created by the user via Roman numeral input (F03). Notes belonging to this chord
 * carry a `chord_tone` NoteBinding with this chord's id.
 */
export interface Chord {
  readonly id: string;
  /** Roman numeral label in key context: 'I', 'ii', 'V7', 'viio', 'bII', 'V/V', etc. */
  readonly romanNumeral: string;
  readonly startBeat: number;
  readonly durationBeats: number;
  /** Actual root pitch in the current key context. */
  readonly root: SpelledPitch;
  readonly quality: ChordQuality;
  /** 0 = root position, 1 = first inversion, 2 = second, 3 = third (seventh chords). */
  readonly inversion: 0 | 1 | 2 | 3;
}

// ── Note ──────────────────────────────────────────────────────────────────────

export interface Note {
  readonly id: string;
  /** MIDI note number (0–127). Canonical for audio/rendering. */
  readonly pitch: number;
  /** Enharmonically unambiguous spelling, computed from key context on creation. */
  readonly spelledPitch?: SpelledPitch;
  /**
   * Pitch before a modal transformation — preserved so the transform is
   * reversible (originalMidi → pitch → originalMidi on inverse transform).
   */
  readonly originalMidi?: number;
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly velocity: number;    // 0–127
  readonly partId?: string;     // optional part membership
  /** Author's intent. Absent = legacy note; key-transform follows ADR-002 heuristics. */
  readonly binding?: NoteBinding;
}

// ── Composition ──────────────────────────────────────────────────────────────

export interface Composition {
  readonly id: string;
  readonly version: '2.0';
  readonly bpm: number;
  readonly beatsPerMeasure: number;
  readonly totalBeats: number;
  readonly notes: readonly Note[];
  readonly parts: readonly Part[];
  /** Global key signature (applies from beat 0 unless overridden by modulations). */
  readonly globalKey: KeySignature;
  /** Ordered list of key changes. Each entry overrides globalKey from its beat onward. */
  readonly modulations?: readonly Modulation[];
  /**
   * Declared chords, sorted by startBeat. Created via Roman numeral input (F03).
   * Notes belonging to a chord carry a `chord_tone` NoteBinding referencing chord.id.
   */
  readonly chords?: readonly Chord[];
}

export const DEFAULT_COMPOSITION: Composition = {
  id: genId(),
  version: '2.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 32,
  notes: [],
  parts: [],
  globalKey: { root: 'C', mode: 'major' },
};
