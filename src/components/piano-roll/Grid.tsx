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
      {/* Row backgrounds — white key rows
          Lightness hierarchy: root (lightest) > diatonic > out-of-key (darkest).
          When no key is set, use the standard white-key background. */}
      {[...WHITE_INDEX.entries()].map(([pitch, idx]) => {
        const deg = globalKey !== null ? getScaleDegree(pitch, globalKey) : undefined;
        const rowClass =
          deg === 0   ? 'bg-zinc-700 border-zinc-600/40'  // root — lightest
          : deg != null ? 'bg-zinc-800 border-zinc-700/40'  // diatonic
          : globalKey !== null ? 'bg-zinc-950 border-zinc-800/20'  // out of key — darkest
          :                 'bg-zinc-800 border-zinc-700/40'; // no key → standard
        return (
          <div
            key={pitch}
            className={`absolute w-full border-b ${rowClass}`}
            style={{ top: idx * WHITE_H, height: WHITE_H }}
          />
        );
      })}

      {/* Row backgrounds — black key overlay bands.
          Same 3-level hierarchy; always darker than the surrounding white row. */}
      {PITCHES.filter(isBlack).map(pitch => {
        const deg = globalKey !== null ? getScaleDegree(pitch, globalKey) : undefined;
        const bandClass =
          deg === 0   ? 'bg-zinc-800'   // root black key — lighter than other black keys
          : deg != null ? 'bg-zinc-900'   // diatonic black key
          : globalKey !== null ? 'bg-zinc-950'  // out of key — near-invisible
          :                 'bg-zinc-900'; // no key → standard black key
        return (
          <div
            key={pitch}
            className={`absolute w-full ${bandClass}`}
            style={{ top: pitchY(pitch), height: BLACK_H, zIndex: 1 }}
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
