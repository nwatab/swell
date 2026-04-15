import type { Composition } from './song';
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
  originalPitch: number;
  beatOffset: number; // click position within note
  previewBeat: number;
  previewPitch: number;
  hasMoved: boolean;
};

export type MusicGenState =
  | { status: 'hidden' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };
