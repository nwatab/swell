import type { Note, Song } from '../types/song';

export type NoteDiff = {
  added: readonly Note[];
  removed: readonly Note[];
  unchanged: readonly Note[];
};

export const diffSongs = (current: Song, suggested: Song): NoteDiff => {
  const currentIds = new Set(current.notes.map(n => n.id));
  const suggestedIds = new Set(suggested.notes.map(n => n.id));
  return {
    added: suggested.notes.filter(n => !currentIds.has(n.id)),
    removed: current.notes.filter(n => !suggestedIds.has(n.id)),
    unchanged: current.notes.filter(n => suggestedIds.has(n.id)),
  };
};
