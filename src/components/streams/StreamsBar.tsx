'use client';

import type { Stream } from '../../types/song';
import StreamNameInput from './StreamNameInput';

interface StreamsBarProps {
  streams: readonly Stream[];
  activeStreamId: string | null;
  onActiveStreamChange: (id: string | null) => void;
  onAddStream: () => void;
  onRemoveStream: (id: string) => void;
  onRenameStream: (id: string, name: string) => void;
  onApplySATB: () => void;
  spreadChord: boolean;
  onSpreadChordToggle: () => void;
}

export default function StreamsBar({
  streams,
  activeStreamId,
  onActiveStreamChange,
  onAddStream,
  onRemoveStream,
  onRenameStream,
  onApplySATB,
  spreadChord,
  onSpreadChordToggle,
}: StreamsBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 bg-zinc-900 border-b border-zinc-700 h-10 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-zinc-500 flex-shrink-0">Streams</span>

      {/* "none" selector */}
      <button
        onClick={() => onActiveStreamChange(null)}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0',
          activeStreamId === null
            ? 'bg-zinc-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="No stream (untagged)"
      >
        —
      </button>

      {/* Per-stream buttons */}
      {streams.map(stream => (
        <div key={stream.id} className="flex items-center flex-shrink-0">
          <button
            onClick={() => onActiveStreamChange(stream.id)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded-l text-xs font-medium transition-colors',
              activeStreamId === stream.id ? 'bg-zinc-600' : 'bg-zinc-700 hover:bg-zinc-600',
            ].join(' ')}
            style={{ color: stream.color }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stream.color }} />
            <StreamNameInput
              name={stream.name}
              color={stream.color}
              onRename={name => onRenameStream(stream.id, name)}
            />
          </button>
          <button
            onClick={() => onRemoveStream(stream.id)}
            className="px-1.5 py-1 rounded-r bg-zinc-700 hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300 text-xs border-l border-zinc-600 transition-colors"
            title="Remove stream"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAddStream}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors flex-shrink-0"
        title="Add stream"
      >
        +
      </button>
      <button
        onClick={onApplySATB}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-400 transition-colors flex-shrink-0"
        title="Replace streams with SATB preset (Bass → Tenor → Alto → Soprano)"
      >
        SATB
      </button>
      <button
        onClick={onSpreadChordToggle}
        disabled={streams.length < 2}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0 font-mono disabled:opacity-30',
          spreadChord
            ? 'bg-teal-700 text-teal-100'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="Spread chord across all streams (bass → soprano)"
      >
        Spread
      </button>
    </div>
  );
}
