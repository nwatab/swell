'use client';

import { useMemo } from 'react';
import type { Composition } from '../types/song';
import { analyzeHarmony, computeNoteFunctions } from '../lib/harmony';
import type { Diagnostic, NoteFunctionMap } from '../lib/harmony';

export interface DiagnosticsResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly noteFunctions: NoteFunctionMap;
}

export const useDiagnostics = (composition: Composition): DiagnosticsResult =>
  useMemo(() => ({
    diagnostics: analyzeHarmony(composition),
    noteFunctions: computeNoteFunctions(composition),
  }), [composition]);
