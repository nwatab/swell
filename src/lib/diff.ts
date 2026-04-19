import type { Note, Composition } from '../types/song';

export type ModifiedNote = { before: Note; after: Note };

export type NoteDiff = {
  added: readonly Note[];
  removed: readonly Note[];
  modified: readonly ModifiedNote[];
  unchanged: readonly Note[];
};

const noteContentEquals = (a: Note, b: Note): boolean =>
  a.spelledPitch.letter === b.spelledPitch.letter &&
  a.spelledPitch.accidental === b.spelledPitch.accidental &&
  a.spelledPitch.octave === b.spelledPitch.octave &&
  a.startBeat === b.startBeat &&
  a.duration === b.duration;

export const diffCompositions = (current: Composition, suggested: Composition): NoteDiff => {
  const currentNotes = current.voices.flatMap(v => v.notes);
  const suggestedNotes = suggested.voices.flatMap(v => v.notes);
  const currentById = new Map(currentNotes.map(n => [n.id, n]));
  const suggestedById = new Map(suggestedNotes.map(n => [n.id, n]));

  const sharedCurrent = currentNotes.filter(n => suggestedById.has(n.id));

  return {
    added: suggestedNotes.filter(n => !currentById.has(n.id)),
    removed: currentNotes.filter(n => !suggestedById.has(n.id)),
    modified: sharedCurrent
      .filter(n => !noteContentEquals(n, suggestedById.get(n.id)!))
      .map(n => ({ before: n, after: suggestedById.get(n.id)! })),
    unchanged: sharedCurrent.filter(n => noteContentEquals(n, suggestedById.get(n.id)!)),
  };
};
