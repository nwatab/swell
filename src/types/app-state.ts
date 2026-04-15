import type { Composition } from './song';

export interface AppState {
  readonly compositions: readonly Composition[];
  readonly activeCompositionId: string;
}
