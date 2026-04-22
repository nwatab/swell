'use client';

import type { BeatChordEntry } from '../../lib/harmony';
import { HEADER_H, CHORD_HEADER_H, DEGREE_HEADER_H } from './layout';

interface BeatHeaderProps {
  totalBeats: number;
  beatsPerMeasure: number;
  cellW: number;
  beatChords: readonly BeatChordEntry[];
}

export default function BeatHeader({ totalBeats, beatsPerMeasure, cellW, beatChords }: BeatHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-600" style={{ width: totalBeats * cellW }}>
      {/* Degree label row */}
      <div className="flex" style={{ height: DEGREE_HEADER_H }}>
        {Array.from({ length: totalBeats }, (_, i) => {
          const entry = beatChords[i] ?? { degree: '', chord: '', ghost: false };
          return (
            <div
              key={i}
              style={{ width: cellW, flexShrink: 0 }}
              className={[
                'flex items-center pl-1 border-r border-zinc-700 text-[10px] truncate text-zinc-500',
                entry.ghost ? 'opacity-50' : '',
              ].join(' ')}
            >
              {entry.degree}
            </div>
          );
        })}
      </div>

      {/* Chord name row */}
      <div className="flex" style={{ height: CHORD_HEADER_H }}>
        {Array.from({ length: totalBeats }, (_, i) => {
          const entry = beatChords[i] ?? { degree: '', chord: '', ghost: false };
          return (
            <div
              key={i}
              style={{ width: cellW, flexShrink: 0 }}
              className={[
                'flex items-center pl-1 border-r border-zinc-700 text-[11px] font-semibold text-indigo-300 truncate',
                entry.ghost ? 'opacity-50' : '',
              ].join(' ')}
            >
              {entry.chord}
            </div>
          );
        })}
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
