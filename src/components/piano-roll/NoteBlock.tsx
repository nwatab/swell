'use client';

import type { Note } from '../../types/song';
import { spelledPitchToString, spelledPitchToMidi } from '../../lib/harmony';
import { pitchY, pitchBlockH, isBlack } from './layout';

export type NoteVariant = 'normal' | 'added' | 'removed' | 'dragging';

interface NoteBlockProps {
  note: Note;
  cellW: number;
  variant?: NoteVariant;
  color?: string;
}

export default function NoteBlock({ note, cellW, variant = 'normal', color = '#3b82f6' }: NoteBlockProps) {
  const style: React.CSSProperties =
    variant === 'added'    ? { backgroundColor: '#10b981', borderColor: '#6ee7b7' } :
    variant === 'removed'  ? { backgroundColor: 'rgba(239,68,68,0.6)', borderColor: '#f87171', opacity: 0.7 } :
    variant === 'dragging' ? { backgroundColor: color, borderColor: color, opacity: 0.8 } :
                             { backgroundColor: color, borderColor: color };

  const midi = spelledPitchToMidi(note.spelledPitch);

  return (
    <div
      className="absolute rounded-sm border pointer-events-none"
      title={spelledPitchToString(note.spelledPitch)}
      style={{
        left: note.startBeat * cellW + 1,
        top: pitchY(midi) + 2,
        width: note.duration === 'whole'   ? 4 * cellW - 2 :
               note.duration === 'half'    ? 2 * cellW - 2 :
               note.duration === 'quarter' ? 1 * cellW - 2 :
                                             0.5 * cellW - 2,
        height: pitchBlockH(midi) - 4,
        zIndex: isBlack(midi) ? 4 : 3,
        ...style,
      }}
    />
  );
}
