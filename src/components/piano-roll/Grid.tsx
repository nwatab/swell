'use client';

import type { KeySignature } from '../../types/song';
import { getScaleDegree } from '../../lib/harmony';
import {
  WHITE_INDEX,
  PITCHES,
  isBlack,
  pitchY,
  WHITE_H,
  BLACK_H,
  NUM_WHITE_KEYS,
} from './layout';

interface GridProps {
  totalBeats: number;
  beatsPerMeasure: number;
  cellW: number;
  resolution: number;
  globalKey: KeySignature | null;
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
      {/* Row backgrounds — white key rows */}
      {[...WHITE_INDEX.entries()].map(([pitch, idx]) => {
        const deg = globalKey !== null ? getScaleDegree(pitch, globalKey) : undefined;
        const rowClass =
          deg === 0
            ? 'bg-indigo-950/70 border-indigo-900/40'       // root / tonic
            : deg != null
            ? 'bg-zinc-900 border-zinc-800/50'               // diatonic (non-root)
            : globalKey !== null
            ? 'bg-zinc-950 border-zinc-800/30'               // out of key
            : 'bg-zinc-900 border-zinc-800/50';              // no key set
        return (
          <div
            key={pitch}
            className={`absolute w-full border-b ${rowClass}`}
            style={{ top: idx * WHITE_H, height: WHITE_H }}
          />
        );
      })}

      {/* Row backgrounds — black key overlay bands (uniform; keyboard rhythm only) */}
      {PITCHES.filter(isBlack).map(pitch => (
        <div
          key={pitch}
          className="absolute w-full bg-zinc-800"
          style={{ top: pitchY(pitch), height: BLACK_H, zIndex: 1 }}
        />
      ))}

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
