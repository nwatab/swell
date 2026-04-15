// Internal file format for Swell compositions
// Serializes to/from JSON (.swell files)

import { genId } from '../lib/id';

export interface Track {
  readonly id: string;
  readonly name: string;
  readonly color: string; // hex color, e.g. '#60a5fa'
}

export type VoiceRole = 'soprano' | 'alto' | 'tenor' | 'bass' | (string & {});

export interface Part {
  readonly id: string;
  readonly trackId: string;
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
}

// ── Composition ──────────────────────────────────────────────────────────────

export interface Composition {
  readonly id: string;
  readonly version: '2.0';
  readonly bpm: number;
  readonly beatsPerMeasure: number;
  readonly totalBeats: number;
  readonly notes: readonly Note[];
  readonly tracks: readonly Track[];
  readonly parts: readonly Part[];
  /** Global key signature (applies from beat 0 unless overridden by modulations). */
  readonly globalKey: KeySignature;
  /** Ordered list of key changes. Each entry overrides globalKey from its beat onward. */
  readonly modulations?: readonly Modulation[];
}

export const DEFAULT_COMPOSITION: Composition = {
  id: genId(),
  version: '2.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 32,
  notes: [],
  tracks: [],
  parts: [],
  globalKey: { root: 'C', mode: 'major' },
};
