export type SnapDiv = '1/4' | '1/8' | '1/16';

export const toResolution = (div: SnapDiv): number =>
  div === '1/4' ? 1 : div === '1/8' ? 0.5 : 0.25;

/** Snap to nearest grid point (used when dragging an existing note). */
export const snapBeat = (rawBeat: number, resolution: number): number =>
  Math.round(rawBeat / resolution) * resolution;

/** Snap to the grid point at or before rawBeat (used when placing a new note). */
export const snapBeatFloor = (rawBeat: number, resolution: number): number =>
  Math.floor(rawBeat / resolution) * resolution;
