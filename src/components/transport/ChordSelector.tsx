'use client';

import { MousePointer2 } from 'lucide-react';
import type { ChordType } from '../../lib/music/chord';
import { CHORD_LABELS } from '../../lib/music/chord';
import type { EditMode } from '../../types/ui-state';

interface ChordSelectorProps {
  chordType: ChordType;
  onChordTypeChange: (ct: ChordType) => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
}

export default function ChordSelector({ chordType, onChordTypeChange, editMode, onEditModeChange }: ChordSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onEditModeChange('select')}
        title="Select mode — click to select, drag to move"
        className={[
          'w-8 h-7 rounded flex items-center justify-center transition-colors',
          editMode === 'select'
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
      >
        <MousePointer2 size={14} />
      </button>
      {(Object.keys(CHORD_LABELS) as ChordType[]).map(ct => {
        const isDia = ct === 'dia' || ct === 'dia7';
        const active = editMode === 'draw' && chordType === ct;
        return (
          <button
            key={ct}
            onClick={() => { onChordTypeChange(ct); onEditModeChange('draw'); }}
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
