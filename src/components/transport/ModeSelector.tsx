'use client';

import { MousePointer2, Pencil } from 'lucide-react';
import type { EditMode } from '../../types/ui-state';

interface ModeSelectorProps {
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
}

const MODES: { mode: EditMode; icon: React.ReactNode; title: string }[] = [
  { mode: 'select', icon: <MousePointer2 size={14} />, title: 'Select mode — click to select, drag to move' },
  { mode: 'draw',   icon: <Pencil size={14} />,        title: 'Draw mode — click to add notes' },
];

export default function ModeSelector({ editMode, onEditModeChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {MODES.map(({ mode, icon, title }) => (
        <button
          key={mode}
          onClick={() => onEditModeChange(mode)}
          title={title}
          className={[
            'w-8 h-7 rounded flex items-center justify-center transition-colors',
            editMode === mode
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
          ].join(' ')}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
