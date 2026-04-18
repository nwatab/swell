'use client';

import type { Voice } from '../../types/song';
import { VOICE_COLORS } from '../../types/song';

interface VoicesBarProps {
  voices: readonly Voice[];
  activeVoiceId: string | null;
  onActiveVoiceChange: (id: string) => void;
}

export default function TracksBar({
  voices,
  activeVoiceId,
  onActiveVoiceChange,
}: VoicesBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 bg-zinc-900 border-b border-zinc-700 h-10 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-zinc-500 flex-shrink-0">Voice</span>

      {voices.map(voice => {
        const color = VOICE_COLORS[voice.role];
        return (
          <button
            key={voice.id}
            onClick={() => onActiveVoiceChange(voice.id)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0',
              activeVoiceId === voice.id ? 'bg-zinc-600' : 'bg-zinc-700 hover:bg-zinc-600',
            ].join(' ')}
            style={{ color }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            {voice.role}
          </button>
        );
      })}

    </div>
  );
}
