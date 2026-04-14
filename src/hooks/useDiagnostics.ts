'use client';

import { useMemo } from 'react';
import type { Song } from '../types/song';
import { analyzeHarmony, computeNoteFunctions } from '../lib/harmony';
import type { Diagnostic, NoteFunctionMap } from '../lib/harmony';

export interface DiagnosticsResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly noteFunctions: NoteFunctionMap;
}

export const useDiagnostics = (song: Song): DiagnosticsResult =>
  useMemo(() => ({
    diagnostics: analyzeHarmony(song),
    noteFunctions: computeNoteFunctions(song),
  }), [song]);
