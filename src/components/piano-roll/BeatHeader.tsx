'use client';

import { HEADER_H } from './layout';

interface BeatHeaderProps {
  totalBeats: number;
  beatsPerMeasure: number;
  cellW: number;
}

export default function BeatHeader({ totalBeats, beatsPerMeasure, cellW }: BeatHeaderProps) {
  return (
    <div
      className="flex bg-zinc-800 border-b border-zinc-600 sticky top-0 z-10"
      style={{ height: HEADER_H, width: totalBeats * cellW }}
    >
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
  );
}
