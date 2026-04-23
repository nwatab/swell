import type { Composition, SpelledPitch, NoteDuration } from './song';
import type { NoteDiff } from '../lib/diff';

export type { SnapDiv } from '../lib/snap';
export type { ChordType } from '../lib/music/chord';

export type SuggestionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; suggestedComposition: Composition; diff: NoteDiff };

export type DragState = {
  noteId: string;
  originalBeat: number;
  originalMidi: number;       // MIDI pitch for hit-test geometry (UI only)
  beatOffset: number;
  previewBeat: number;
  previewSpelledPitch: SpelledPitch;  // for rendering the drag preview
  hasMoved: boolean;
};

export type AutocompleteNote = {
  voiceId: string;
  spelledPitch: SpelledPitch;
  startBeat: number;
  duration: NoteDuration;
};

export type AutocompleteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; notes: AutocompleteNote[] };

export type MusicGenState =
  | { status: 'hidden' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

export type Selection =
  | { kind: 'chord'; chordId: string }
  | { kind: 'note'; noteId: string }
  | null;
