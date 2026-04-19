// ── Piano constants ───────────────────────────────────────────────────────────
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

export const isBlack = (pitch: number): boolean => BLACK_SEMITONES.has(pitch % 12);

export const pitchName = (pitch: number): string =>
  `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

// ── Layout constants ──────────────────────────────────────────────────────────
export const DEFAULT_CELL_W = 40;
export const ZOOM_STEPS = [20, 40, 80, 160] as const;
export const WHITE_H = 28;   // px per white-key row
export const BLACK_H = 16;   // px for black-key overlay band
export const KEY_W = 64;
export const HEADER_H = 32;
export const CHORD_HEADER_H = 22;

export const MIN_PITCH = 36; // C2
export const MAX_PITCH = 84; // C6

export const PITCHES: readonly number[] = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MAX_PITCH - i,
);

// ── Keyboard layout ───────────────────────────────────────────────────────────
// Map each white-key pitch to its display index (0 = C6 at top, incrementing downward)
export const WHITE_INDEX: Map<number, number> = (() => {
  const m = new Map<number, number>();
  let idx = 0;
  for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
    if (!isBlack(p)) m.set(p, idx++);
  }
  return m;
})();

export const WHITE_PITCH_AT: Map<number, number> = (() => {
  const m = new Map<number, number>();
  for (const [pitch, idx] of WHITE_INDEX) m.set(idx, pitch);
  return m;
})();

export const NUM_WHITE_KEYS = WHITE_INDEX.size; // 29 for C2–C6

// Top y-coordinate of the visual block for a pitch in the grid
export const pitchY = (pitch: number): number =>
  isBlack(pitch)
    // Black keys float centred on the boundary between lower (pitch-1) and upper (pitch+1) white keys
    ? WHITE_INDEX.get(pitch - 1)! * WHITE_H - BLACK_H / 2
    : WHITE_INDEX.get(pitch)! * WHITE_H;

// Visual block height for a pitch
export const pitchBlockH = (pitch: number): number => (isBlack(pitch) ? BLACK_H : WHITE_H);

// Grid y-coordinate → MIDI pitch; black key bands take visual priority
export const yToPitch = (y: number): number | null => {
  for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
    if (isBlack(p)) {
      const top = pitchY(p);
      if (y >= top && y < top + BLACK_H) return p;
    }
  }
  const idx = Math.floor(y / WHITE_H);
  return WHITE_PITCH_AT.get(idx) ?? null;
};
