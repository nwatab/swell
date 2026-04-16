'use client';

import type { Part } from '../../types/song';
import TrackNameInput from './TrackNameInput';

interface PartsBarProps {
  parts: readonly Part[];
  activePartId: string | null;
  onActivePartChange: (id: string | null) => void;
  onAddPart: () => void;
  onRemovePart: (id: string) => void;
  onRenamePart: (id: string, name: string) => void;
  onApplySATB: () => void;
  spreadChord: boolean;
  onSpreadChordToggle: () => void;
}

export default function TracksBar({
  parts,
  activePartId,
  onActivePartChange,
  onAddPart,
  onRemovePart,
  onRenamePart,
  onApplySATB,
  spreadChord,
  onSpreadChordToggle,
}: PartsBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 bg-zinc-900 border-b border-zinc-700 h-10 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-zinc-500 flex-shrink-0">Parts</span>

      {/* "none" selector */}
      <button
        onClick={() => onActivePartChange(null)}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0',
          activePartId === null
            ? 'bg-zinc-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="No part (untagged)"
      >
        —
      </button>

      {/* Per-part buttons */}
      {parts.map(part => (
        <div key={part.id} className="flex items-center flex-shrink-0">
          <button
            onClick={() => onActivePartChange(part.id)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded-l text-xs font-medium transition-colors',
              activePartId === part.id ? 'bg-zinc-600' : 'bg-zinc-700 hover:bg-zinc-600',
            ].join(' ')}
            style={{ color: part.color }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: part.color }} />
            <TrackNameInput
              name={part.name}
              color={part.color}
              onRename={name => onRenamePart(part.id, name)}
            />
          </button>
          <button
            onClick={() => onRemovePart(part.id)}
            className="px-1.5 py-1 rounded-r bg-zinc-700 hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300 text-xs border-l border-zinc-600 transition-colors"
            title="Remove part"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAddPart}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors flex-shrink-0"
        title="Add part"
      >
        +
      </button>
      <button
        onClick={onApplySATB}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-400 transition-colors flex-shrink-0"
        title="Replace parts with SATB preset (Bass → Tenor → Alto → Soprano)"
      >
        SATB
      </button>
      <button
        onClick={onSpreadChordToggle}
        disabled={parts.length < 2}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0 font-mono disabled:opacity-30',
          spreadChord
            ? 'bg-teal-700 text-teal-100'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="Spread chord across all parts (bass → soprano)"
      >
        Spread
      </button>
    </div>
  );
}
