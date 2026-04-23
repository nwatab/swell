'use client';

import type { Note } from '../../types/song';
import { spelledPitchToString, spelledPitchToMidi } from '../../lib/harmony';
import { noteBlockY, NOTE_H, isBlack } from './layout';

export type NoteVariant = 'normal' | 'added' | 'removed' | 'dragging' | 'ghost';

interface NoteBlockProps {
  note: Note;
  cellW: number;
  variant?: NoteVariant;
  color?: string;
  selected?: boolean;
}

export default function NoteBlock({ note, cellW, variant = 'normal', color = '#3b82f6', selected = false }: NoteBlockProps) {
  const style: React.CSSProperties =
    variant === 'added'    ? { backgroundColor: '#10b981', borderColor: '#6ee7b7' } :
    variant === 'removed'  ? { backgroundColor: 'rgba(239,68,68,0.6)', borderColor: '#f87171', opacity: 0.7 } :
    variant === 'dragging' ? { backgroundColor: color, borderColor: color, opacity: 0.8 } :
    variant === 'ghost'    ? { backgroundColor: color, borderColor: color, opacity: 0.35, borderStyle: 'dashed' } :
                             { backgroundColor: color, borderColor: color };

  const midi = spelledPitchToMidi(note.spelledPitch);

  return (
    <div
      className="absolute rounded-sm border pointer-events-none"
      title={spelledPitchToString(note.spelledPitch)}
      style={{
        left: note.startBeat * cellW + 1,
        top: noteBlockY(midi),
        width: note.duration === 'whole'   ? 4 * cellW - 2 :
               note.duration === 'half'    ? 2 * cellW - 2 :
               note.duration === 'quarter' ? 1 * cellW - 2 :
                                             0.5 * cellW - 2,
        height: NOTE_H,
        zIndex: isBlack(midi) ? 4 : 3,
        ...(selected ? { outline: '2px solid white', outlineOffset: '1px' } : {}),
        ...style,
      }}
    />
  );
}
