// Internal file format for Swell compositions
// Serializes to/from JSON (.swell files)

import { genId } from '../lib/id';

// ── Pitch primitives ──────────────────────────────────────────────────────────

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = -2 | -1 | 0 | 1 | 2; // 𝄫 ♭ ♮ ♯ 𝄪

/** Pitch class without octave. Used for key tonic and chord root (e.g. F#, Bb). */
export interface PitchClass {
  readonly letter: NoteLetter;
  readonly accidental: Accidental;
}

/** Enharmonically unambiguous pitch. Canonical form — MIDI pitch is derived. */
export interface SpelledPitch {
  readonly letter: NoteLetter;
  readonly accidental: Accidental;
  readonly octave: number;
}

// ── Duration ──────────────────────────────────────────────────────────────────

export type NoteDuration = 'whole' | 'half' | 'quarter' | 'eighth';

/** Duration in beats (4/4 context). */
export const DURATION_BEATS: Record<NoteDuration, number> = {
  whole:   4,
  half:    2,
  quarter: 1,
  eighth:  0.5,
};

// ── Key signature ─────────────────────────────────────────────────────────────

export type ScaleMode = 'major' | 'minor';
// NOTE: Do NOT add 'harmonic-minor' here. The raised 7th in minor is a harmony-level
// phenomenon (Chord.quality = 'major' on V), not a key-level one. ScaleMode represents
// the key signature (調号). See ADR-008.

export interface KeySignature {
  readonly tonic: PitchClass;
  readonly mode: ScaleMode;
}

// ── Chord quality ─────────────────────────────────────────────────────────────

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

// ── Note (実現層) ─────────────────────────────────────────────────────────────

export type NoteRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ninth';

export type NoteBinding =
  | { readonly kind: 'absolute' }
  | { readonly kind: 'chord_tone'; readonly chordId: string; readonly role: NoteRole }
  | { readonly kind: 'scale_degree'; readonly degree: 1|2|3|4|5|6|7 };

export interface Note {
  readonly id: string;
  /** Canonical form. MIDI pitch is derived via spelledPitchToMidi() in harmony.ts. */
  readonly spelledPitch: SpelledPitch;
  readonly startBeat: number;
  readonly duration: NoteDuration;
  readonly binding?: NoteBinding;
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export type VoiceRole = 'soprano' | 'alto' | 'tenor' | 'bass';

/** Low → high register order. */
export const VOICE_ORDER: readonly VoiceRole[] = ['bass', 'tenor', 'alto', 'soprano'];

export const VOICE_COLORS: Record<VoiceRole, string> = {
  soprano: '#f87171',
  alto:    '#fbbf24',
  tenor:   '#34d399',
  bass:    '#60a5fa',
};

export interface Voice {
  readonly id: string;
  readonly role: VoiceRole;
  readonly notes: readonly Note[];
}

// ── Composition ───────────────────────────────────────────────────────────────

export interface Composition {
  readonly id: string;
  readonly keySignature: KeySignature;
  readonly timeSignature: { readonly numerator: number; readonly denominator: number };
  readonly bpm: number;
  readonly measureCount: number;
  /** Fixed SATB voices. Always 4 voices in MVP. */
  readonly voices: readonly Voice[];
}

/** Total beats derived from measure count and time signature. */
export const totalBeats = (c: Composition): number =>
  c.measureCount * c.timeSignature.numerator;

/** Beats per measure derived from time signature. */
export const beatsPerMeasure = (c: Composition): number =>
  c.timeSignature.numerator;

export const DEFAULT_COMPOSITION: Composition = {
  id: genId(),
  keySignature: { tonic: { letter: 'C', accidental: 0 }, mode: 'major' },
  timeSignature: { numerator: 4, denominator: 4 },
  bpm: 120,
  measureCount: 8,
  voices: [...VOICE_ORDER].reverse().map(role => ({ id: genId(), role, notes: [] })),
};
