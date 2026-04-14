export type SnapDiv = '1/4' | '1/8' | '1/16';

export const toResolution = (div: SnapDiv, triplet: boolean): number => {
  const base = div === '1/4' ? 1 : div === '1/8' ? 0.5 : 0.25;
  return triplet ? (base * 2) / 3 : base;
};

export const snapBeat = (rawBeat: number, resolution: number): number =>
  Math.round(rawBeat / resolution) * resolution;
