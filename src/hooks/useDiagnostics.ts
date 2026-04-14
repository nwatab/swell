'use client';

import { useMemo } from 'react';
import type { Song } from '../types/song';
import { analyzeHarmony } from '../lib/harmony';
import type { Diagnostic } from '../lib/harmony';

export const useDiagnostics = (song: Song): readonly Diagnostic[] =>
  useMemo(() => analyzeHarmony(song), [song]);
