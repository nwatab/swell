import { toResolution, snapBeat, snapBeatFloor } from './snap';

describe('toResolution', () => {
  it('returns 1 for 1/4', () => expect(toResolution('1/4')).toBe(1));
  it('returns 0.5 for 1/8', () => expect(toResolution('1/8')).toBe(0.5));
  it('returns 0.25 for 1/16', () => expect(toResolution('1/16')).toBe(0.25));
});

describe('snapBeat (nearest — used during drag)', () => {
  it('rounds down when below midpoint', () => expect(snapBeat(0.4, 1)).toBe(0));
  it('rounds up at midpoint (Math.round behaviour)', () => expect(snapBeat(0.5, 1)).toBe(1));
  it('rounds up above midpoint', () => expect(snapBeat(0.6, 1)).toBe(1));
  it('respects fractional resolution', () => expect(snapBeat(0.3, 0.5)).toBe(0.5));
  it('handles negative rawBeat (returns -0, caller clamps)', () =>
    // Math.round(-0.3) = -0 in JS; Object.is(-0, 0) is false so we use toBeCloseTo
    expect(snapBeat(-0.3, 1)).toBeCloseTo(0));
  it('snaps to exact beat', () => expect(snapBeat(3, 1)).toBe(3));
});

describe('snapBeatFloor (floor — used when placing a new note)', () => {
  it('lands on the current beat when at left edge', () => expect(snapBeatFloor(0, 1)).toBe(0));
  it('stays in the same cell when in the left half', () => expect(snapBeatFloor(0.4, 1)).toBe(0));
  it('stays in the same cell at exactly the midpoint', () => expect(snapBeatFloor(0.5, 1)).toBe(0));
  it('stays in the same cell in the right half', () => expect(snapBeatFloor(0.99, 1)).toBe(0));
  it('advances at the next grid point', () => expect(snapBeatFloor(1.0, 1)).toBe(1));
  it('respects fractional resolution (1/8)', () => expect(snapBeatFloor(0.6, 0.5)).toBe(0.5));
  it('handles exact integer beat', () => expect(snapBeatFloor(3, 1)).toBe(3));
});
