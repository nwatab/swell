'use client';

import type { Note, Composition } from '../../types/song';
import { VOICE_COLORS } from '../../types/song';
import { spelledPitchToMidi } from '../../lib/harmony';
import type { SuggestionState, DragState, AutocompleteNote } from '../../types/ui-state';
import { MIN_PITCH, MAX_PITCH } from './layout';
import NoteBlock, { type NoteVariant } from './NoteBlock';

interface NoteLayerProps {
  composition: Composition;
  activeComposition: Composition;
  suggestion: SuggestionState;
  drag: DragState | null;
  cellW: number;
  ghostNotes?: AutocompleteNote[];
}

type NoteEntry = { note: Note; variant: NoteVariant; color?: string };

export default function NoteLayer({ composition, activeComposition, suggestion, drag, cellW, ghostNotes = [] }: NoteLayerProps) {
  const allNotes = (c: Composition): NoteEntry[] =>
    c.voices.flatMap(v =>
      v.notes.map(note => ({
        note,
        variant: 'normal' as const,
        color: VOICE_COLORS[v.role],
      }))
    );

  const baseNotes: NoteEntry[] =
    suggestion.status === 'ready'
      ? [
          ...suggestion.diff.unchanged.map(note => ({ note, variant: 'normal' as const })),
          ...suggestion.diff.removed.map(note => ({ note, variant: 'removed' as const })),
          ...suggestion.diff.modified.flatMap(({ before, after }) => [
            { note: before, variant: 'removed' as const },
            { note: after, variant: 'added' as const },
          ]),
          ...suggestion.diff.added.map(note => ({ note, variant: 'added' as const })),
        ]
      : allNotes(composition);

  const ghostEntries: NoteEntry[] = ghostNotes.map((gn, i) => {
    const voiceRole = composition.voices.find(v => v.id === gn.voiceId)?.role;
    return {
      note: { id: `ghost-${i}`, spelledPitch: gn.spelledPitch, startBeat: gn.startBeat, duration: gn.duration },
      variant: 'ghost' as const,
      color: voiceRole ? VOICE_COLORS[voiceRole] : undefined,
    };
  });

  const displayNotes: NoteEntry[] = drag
    ? [
        ...baseNotes.filter(({ note }) => note.id !== drag.noteId),
        {
          note: {
            ...composition.voices.flatMap(v => v.notes).find(n => n.id === drag.noteId)!,
            startBeat: drag.previewBeat,
            spelledPitch: drag.previewSpelledPitch,
          },
          variant: 'dragging' as const,
        },
        ...ghostEntries,
      ]
    : [...baseNotes, ...ghostEntries];

  // Derive voice color for suggestion diff notes
  const voiceColorForNote = (noteId: string): string | undefined => {
    const voice = activeComposition.voices.find(v => v.notes.some(n => n.id === noteId));
    return voice ? VOICE_COLORS[voice.role] : undefined;
  };

  return (
    <>
      {displayNotes.map(({ note, variant, color }) => {
        const midi = spelledPitchToMidi(note.spelledPitch);
        if (midi < MIN_PITCH || midi > MAX_PITCH) return null;
        const noteColor =
          (variant === 'normal' || variant === 'dragging' || variant === 'ghost')
            ? (color ?? voiceColorForNote(note.id))
            : undefined;
        return (
          <NoteBlock
            key={`${note.id}-${variant}`}
            note={note}
            cellW={cellW}
            variant={variant}
            color={noteColor}
          />
        );
      })}
    </>
  );
}
