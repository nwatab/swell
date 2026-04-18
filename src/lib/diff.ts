import type { Note, Composition } from '../types/song';

export type NoteDiff = {
  added: readonly Note[];
  removed: readonly Note[];
  unchanged: readonly Note[];
};

export const diffCompositions = (current: Composition, suggested: Composition): NoteDiff => {
  const currentNotes = current.voices.flatMap(v => v.notes);
  const suggestedNotes = suggested.voices.flatMap(v => v.notes);
  const currentIds = new Set(currentNotes.map(n => n.id));
  const suggestedIds = new Set(suggestedNotes.map(n => n.id));
  return {
    added: suggestedNotes.filter(n => !currentIds.has(n.id)),
    removed: currentNotes.filter(n => !suggestedIds.has(n.id)),
    unchanged: currentNotes.filter(n => suggestedIds.has(n.id)),
  };
};
