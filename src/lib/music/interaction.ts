import type { Composition, Note, NoteDuration } from '../../types/song';
import { DURATION_BEATS } from '../../types/song';
import type { DragState, Selection, EditMode } from '../../types/ui-state';
import type { KeySignature } from '../../types/song';
import { spelledPitchToMidi, spellMidi, keyAtBeat } from '../harmony';
import { snapBeat } from '../snap';
import { moveNote, moveChord } from './note-operations';

export const resolutionToDuration = (resolution: number): NoteDuration => {
  if (resolution >= 4) return 'whole';
  if (resolution >= 2) return 'half';
  if (resolution >= 1) return 'quarter';
  return 'eighth';
};

/** Returns the first note in the composition that occupies (rawBeat, midi), or null. */
export const hitNote = (
  composition: Composition,
  rawBeat: number,
  midi: number,
): Note | null => {
  for (const voice of composition.voices) {
    for (const note of voice.notes) {
      if (
        spelledPitchToMidi(note.spelledPitch) === midi &&
        rawBeat >= note.startBeat &&
        rawBeat < note.startBeat + DURATION_BEATS[note.duration]
      ) {
        return note;
      }
    }
  }
  return null;
};

/**
 * Computes the initial DragState for a note mousedown.
 * Chord drag is activated when the current selection is the chord that owns this note.
 */
export const computeDragStart = (
  note: Note,
  selection: Selection,
  editMode: EditMode,
  rawBeat: number,
): DragState => {
  const isChordDrag =
    editMode === 'select' &&
    selection?.kind === 'chord' &&
    note.binding?.kind === 'chord_tone' &&
    note.binding.chordId === selection.chordId;

  return {
    noteId: note.id,
    originalBeat: note.startBeat,
    originalMidi: spelledPitchToMidi(note.spelledPitch),
    beatOffset: rawBeat - note.startBeat,
    previewBeat: note.startBeat,
    previewSpelledPitch: note.spelledPitch,
    hasMoved: false,
    ...(isChordDrag ? { chordId: note.binding!.chordId, pitchDelta: 0 } : {}),
  };
};

/**
 * Computes the updated DragState in response to a mousemove.
 * Beat is clamped to [0, maxBeat] and snapped to resolution.
 */
export const computeDragUpdate = (
  drag: DragState,
  rawBeat: number,
  midi: number,
  maxBeat: number,
  resolution: number,
  key: KeySignature,
): DragState => {
  const newBeat = Math.max(0, Math.min(maxBeat, snapBeat(rawBeat - drag.beatOffset, resolution)));
  const hasMoved = newBeat !== drag.originalBeat || midi !== drag.originalMidi;
  return {
    ...drag,
    previewBeat: newBeat,
    previewSpelledPitch: spellMidi(midi, key),
    hasMoved,
    ...(drag.chordId !== undefined ? { pitchDelta: midi - drag.originalMidi } : {}),
  };
};

/**
 * Applies a completed drag to the composition.
 * Chord drag moves all notes of the chord; single-note drag moves only the dragged note.
 */
export const applyDrag = (drag: DragState, composition: Composition): Composition => {
  if (drag.chordId !== undefined) {
    const beatDelta = drag.previewBeat - drag.originalBeat;
    const pitchDelta = drag.pitchDelta ?? 0;
    return moveChord(composition, drag.chordId, beatDelta, pitchDelta, keyAtBeat(composition, drag.previewBeat));
  }
  return moveNote(composition, drag.noteId, drag.previewBeat, drag.previewSpelledPitch);
};

/**
 * Computes the new Selection after a click (no drag) in select mode.
 * chord_tone notes select the whole chord; free notes select just the note.
 * Returns the existing selection unchanged if it already matches.
 */
export const resolveClickSelection = (
  noteId: string,
  composition: Composition,
  currentSelection: Selection,
): Selection => {
  const note = composition.voices.flatMap(v => v.notes).find(n => n.id === noteId);
  if (!note) return currentSelection;

  const binding = note.binding;
  if (binding?.kind === 'chord_tone') {
    const alreadySelected =
      (currentSelection?.kind === 'chord' && currentSelection.chordId === binding.chordId) ||
      (currentSelection?.kind === 'note' && currentSelection.noteId === noteId);
    return alreadySelected ? currentSelection : { kind: 'chord', chordId: binding.chordId };
  }

  const alreadySelected = currentSelection?.kind === 'note' && currentSelection.noteId === note.id;
  return alreadySelected ? currentSelection : { kind: 'note', noteId: note.id };
};
