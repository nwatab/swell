import type { Composition, SpelledPitch, NoteDuration } from './song';
import type { NoteDiff } from '../lib/diff';

export type { SnapDiv } from '../lib/snap';
export type { ChordType } from '../lib/music/chord';

export type SuggestionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; suggestedComposition: Composition; diff: NoteDiff };

export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; status: 'loading' }
  | { id: string; role: 'assistant'; status: 'ready'; diff: NoteDiff }
  | { id: string; role: 'assistant'; status: 'accepted' }
  | { id: string; role: 'assistant'; status: 'rejected' }
  | { id: string; role: 'assistant'; status: 'error'; message: string };

export type DragState = {
  noteId: string;
  originalBeat: number;
  originalMidi: number;       // MIDI pitch for hit-test geometry (UI only)
  beatOffset: number;
  previewBeat: number;
  previewSpelledPitch: SpelledPitch;  // for rendering the drag preview
  hasMoved: boolean;
  chordId?: string;    // set when dragging an entire chord as a unit
  pitchDelta?: number; // semitone shift from originalMidi (chord drag only)
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

export type EditMode = 'draw' | 'select';
