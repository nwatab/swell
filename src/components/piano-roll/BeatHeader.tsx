'use client';

import type { HarmonicDeclaration } from '../../types/song';
import { chordLabel } from '../../lib/music/chord';
import { HEADER_H, CHORD_HEADER_H } from './layout';

interface BeatHeaderProps {
  totalBeats: number;
  beatsPerMeasure: number;
  cellW: number;
  measures: readonly HarmonicDeclaration[];
}

export default function BeatHeader({ totalBeats, beatsPerMeasure, cellW, measures }: BeatHeaderProps) {
  const measureCount = Math.ceil(totalBeats / beatsPerMeasure);
  const measureW = beatsPerMeasure * cellW;

  const declByMeasure = new Map(measures.map(m => [m.measureIndex, m]));

  return (
    <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-600" style={{ width: totalBeats * cellW }}>
      {/* Chord name row */}
      <div className="flex" style={{ height: CHORD_HEADER_H }}>
        {Array.from({ length: measureCount }, (_, i) => (
          <div
            key={i}
            style={{ width: measureW, flexShrink: 0 }}
            className="flex items-center pl-2 border-r border-zinc-700 text-[11px] font-semibold text-indigo-300 truncate"
          >
            {declByMeasure.has(i) ? chordLabel(declByMeasure.get(i)!) : ''}
          </div>
        ))}
      </div>

      {/* Beat number row */}
      <div className="flex" style={{ height: HEADER_H }}>
        {Array.from({ length: totalBeats }, (_, i) => (
          <div
            key={i}
            style={{ width: cellW, flexShrink: 0 }}
            className={[
              'flex items-center justify-start pl-1 text-[10px] border-r border-zinc-700',
              i % beatsPerMeasure === 0 ? 'text-zinc-300' : 'text-zinc-600',
            ].join(' ')}
          >
            {i % beatsPerMeasure === 0 ? String(Math.floor(i / beatsPerMeasure) + 1) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
