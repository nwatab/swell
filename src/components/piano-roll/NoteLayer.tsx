'use client';

import type { Note, Song } from '../../types/song';
import type { SuggestionState, DragState } from '../../types/ui-state';
import { MIN_PITCH, MAX_PITCH } from './layout';
import NoteBlock, { type NoteVariant } from './NoteBlock';

interface NoteLayerProps {
  song: Song;
  activeSong: Song;
  suggestion: SuggestionState;
  drag: DragState | null;
  cellW: number;
}

type NoteEntry = { note: Note; variant: NoteVariant };

export default function NoteLayer({ song, activeSong, suggestion, drag, cellW }: NoteLayerProps) {
  const baseNotes: NoteEntry[] =
    suggestion.status === 'ready'
      ? [
          ...suggestion.diff.unchanged.map(note => ({ note, variant: 'normal' as const })),
          ...suggestion.diff.removed.map(note => ({ note, variant: 'removed' as const })),
          ...suggestion.diff.added.map(note => ({ note, variant: 'added' as const })),
        ]
      : song.notes.map(note => ({ note, variant: 'normal' as const }));

  const displayNotes: NoteEntry[] = drag
    ? [
        ...baseNotes.filter(({ note }) => note.id !== drag.noteId),
        {
          note: {
            ...song.notes.find(n => n.id === drag.noteId)!,
            startBeat: drag.previewBeat,
            pitch: drag.previewPitch,
          },
          variant: 'dragging' as const,
        },
      ]
    : baseNotes;

  return (
    <>
      {displayNotes.map(({ note, variant }) => {
        if (note.pitch < MIN_PITCH || note.pitch > MAX_PITCH) return null;
        const streamColor =
          variant === 'normal' || variant === 'dragging'
            ? activeSong.streams.find(s => s.id === note.streamId)?.color
            : undefined;
        return (
          <NoteBlock
            key={`${note.id}-${variant}`}
            note={note}
            cellW={cellW}
            variant={variant}
            streamColor={streamColor}
          />
        );
      })}
    </>
  );
}
