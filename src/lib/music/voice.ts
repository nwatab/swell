import type { Composition, Voice, Note, SpelledPitch, NoteDuration } from '../../types/song';
import { genId } from '../id';

/** Add a note to a specific voice. */
export const addNoteToVoice = (
  composition: Composition,
  voiceId: string,
  spelledPitch: SpelledPitch,
  startBeat: number,
  duration: NoteDuration,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v =>
    v.id !== voiceId ? v : {
      ...v,
      notes: [...v.notes, { id: genId(), spelledPitch, startBeat, duration }],
    }
  ),
});

/** Remove a note from a composition (searches all voices). */
export const removeNoteFromComposition = (composition: Composition, noteId: string): Composition => ({
  ...composition,
  voices: composition.voices.map(v => ({
    ...v,
    notes: v.notes.filter(n => n.id !== noteId),
  })),
});

/** Move a note to a new beat and pitch. */
export const moveNoteInComposition = (
  composition: Composition,
  noteId: string,
  startBeat: number,
  spelledPitch: SpelledPitch,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v => ({
    ...v,
    notes: v.notes.map(n =>
      n.id !== noteId ? n : { ...n, startBeat, spelledPitch }
    ),
  })),
});

/** Add notes across all voices (bass→soprano), one chord tone per voice. */
export const addNotesToVoices = (
  composition: Composition,
  notesByVoiceId: ReadonlyMap<string, { spelledPitch: SpelledPitch; startBeat: number; duration: NoteDuration }>,
): Composition => ({
  ...composition,
  voices: composition.voices.map(v => {
    const entry = notesByVoiceId.get(v.id);
    if (!entry) return v;
    return {
      ...v,
      notes: [...v.notes, { id: genId(), ...entry }],
    };
  }),
});

/** Find which voice contains a given note ID. */
export const findVoiceForNote = (composition: Composition, noteId: string): Voice | undefined =>
  composition.voices.find(v => v.notes.some(n => n.id === noteId));
