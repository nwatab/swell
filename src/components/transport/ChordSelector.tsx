'use client';

import type { ChordType } from '../../lib/music/chord';
import { CHORD_LABELS } from '../../lib/music/chord';

interface ChordSelectorProps {
  chordType: ChordType;
  onChordTypeChange: (ct: ChordType) => void;
}

export default function ChordSelector({ chordType, onChordTypeChange }: ChordSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {(Object.keys(CHORD_LABELS) as ChordType[]).map(ct => {
        const isDia = ct === 'dia' || ct === 'dia7';
        const active = chordType === ct;
        return (
          <button
            key={ct}
            onClick={() => onChordTypeChange(ct)}
            title={isDia ? 'Diatonic chord (requires key to be set)' : undefined}
            className={[
              'px-2 py-1 rounded text-xs transition-colors font-mono',
              active
                ? isDia ? 'bg-teal-600 text-white' : 'bg-amber-600 text-white'
                : isDia ? 'bg-zinc-700 hover:bg-zinc-600 text-teal-400' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
            ].join(' ')}
          >
            {CHORD_LABELS[ct]}
          </button>
        );
      })}
    </div>
  );
}
