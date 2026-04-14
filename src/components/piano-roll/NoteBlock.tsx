'use client';

import type { Note } from '../../types/song';
import { spelledPitchToString } from '../../lib/harmony';
import { NOTE_NAMES, pitchY, pitchBlockH, isBlack } from './layout';

export type NoteVariant = 'normal' | 'added' | 'removed' | 'dragging';

interface NoteBlockProps {
  note: Note;
  cellW: number;
  variant?: NoteVariant;
  streamColor?: string;
}

export default function NoteBlock({
  note,
  cellW,
  variant = 'normal',
  streamColor,
}: NoteBlockProps) {
  const color = streamColor ?? '#3b82f6';
  const style: React.CSSProperties =
    variant === 'added'    ? { backgroundColor: '#10b981', borderColor: '#6ee7b7' } :
    variant === 'removed'  ? { backgroundColor: 'rgba(239,68,68,0.6)', borderColor: '#f87171', opacity: 0.7 } :
    variant === 'dragging' ? { backgroundColor: color, borderColor: color, opacity: 0.8 } :
                             { backgroundColor: color, borderColor: color };

  const label = note.spelledPitch
    ? spelledPitchToString(note.spelledPitch)
    : `${NOTE_NAMES[note.pitch % 12]}${Math.floor(note.pitch / 12) - 1}`;

  return (
    <div
      className="absolute rounded-sm border pointer-events-none"
      title={label}
      style={{
        left: note.startBeat * cellW + 1,
        top: pitchY(note.pitch) + 2,
        width: note.durationBeats * cellW - 2,
        height: pitchBlockH(note.pitch) - 4,
        zIndex: isBlack(note.pitch) ? 4 : 3,
        ...style,
      }}
    />
  );
}
