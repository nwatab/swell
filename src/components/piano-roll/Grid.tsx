'use client';

import type { KeySignature } from '../../types/song';
import { getScaleDegree } from '../../lib/harmony';
import {
  PITCHES,
  isBlack,
  pitchY,
  pitchBlockH,
  WHITE_H,
  NUM_WHITE_KEYS,
} from './layout';

interface GridProps {
  totalBeats: number;
  beatsPerMeasure: number;
  cellW: number;
  resolution: number;
  globalKey: KeySignature;
}

export default function Grid({
  totalBeats,
  beatsPerMeasure,
  cellW,
  resolution,
  globalKey,
}: GridProps) {
  const gridWidth = totalBeats * cellW;
  const gridHeight = NUM_WHITE_KEYS * WHITE_H;

  return (
    <>
      {/* Row backgrounds — all pitches colored by scale degree.
          Lightness hierarchy: root (lightest) > diatonic > out-of-key (darkest).
          Black key bands sit on top (zIndex 1) with the same coloring logic. */}
      {PITCHES.map(pitch => {
        const deg = getScaleDegree(pitch, globalKey);
        const rowClass =
          deg === 0   ? 'bg-zinc-700 border-zinc-600/40'
          : deg != null ? 'bg-zinc-800 border-zinc-700/40'
          :               'bg-zinc-950 border-zinc-800/20';
        return (
          <div
            key={pitch}
            className={`absolute w-full border-b ${rowClass}`}
            style={{
              top: pitchY(pitch),
              height: pitchBlockH(pitch),
              zIndex: isBlack(pitch) ? 1 : 0,
            }}
          />
        );
      })}

      {/* Vertical grid lines */}
      {Array.from({ length: Math.round(totalBeats / resolution) + 1 }, (_, i) => {
        const beat = i * resolution;
        const isMeasure = beat % beatsPerMeasure < 1e-6;
        const isBeat = beat % 1 < 1e-6;
        return (
          <div
            key={i}
            className={[
              'absolute top-0 w-px',
              isMeasure ? 'bg-zinc-600' : isBeat ? 'bg-zinc-700/60' : 'bg-zinc-700/30',
            ].join(' ')}
            style={{ left: beat * cellW, height: gridHeight }}
          />
        );
      })}
    </>
  );
}
