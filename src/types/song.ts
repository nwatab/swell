// Internal file format for Swell compositions
// Serializes to/from JSON (.swell files in the future)

export interface Note {
  readonly id: string;
  readonly pitch: number;       // MIDI note number (0–127)
  readonly startBeat: number;   // 0-indexed beat position
  readonly durationBeats: number;
  readonly velocity: number;    // 0–127
}

export interface Song {
  readonly version: '1.0';
  readonly bpm: number;
  readonly beatsPerMeasure: number;
  readonly totalBeats: number;
  readonly notes: readonly Note[];
}

export const DEFAULT_SONG: Song = {
  version: '1.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 32,
  notes: [],
} as const;
