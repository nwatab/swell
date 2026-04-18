'use client';

import { useState, useCallback } from 'react';
import type { Composition, KeySignature } from '../types/song';
import { DEFAULT_COMPOSITION } from '../types/song';
import { downloadSwell } from '../lib/swell-format/serialize';

export interface UseCompositionReturn {
  composition: Composition;
  setComposition: React.Dispatch<React.SetStateAction<Composition>>;
  activeVoiceId: string | null;
  setActiveVoiceId: React.Dispatch<React.SetStateAction<string | null>>;
  handleExport: () => void;
  handleImport: (imported: Composition) => void;
  handleBpmChange: (bpm: number) => void;
  handleKeyChange: (key: KeySignature) => void;
}

export const useComposition = (): UseCompositionReturn => {
  const [composition, setComposition] = useState<Composition>(DEFAULT_COMPOSITION);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(
    () => DEFAULT_COMPOSITION.voices[0]?.id ?? null,
  );

  const handleExport = useCallback(() => downloadSwell(composition), [composition]);
  const handleImport = useCallback((imported: Composition) => {
    setComposition(imported);
    setActiveVoiceId(imported.voices[0]?.id ?? null);
  }, []);

  const handleBpmChange = useCallback((bpm: number) => {
    setComposition(s => ({ ...s, bpm }));
  }, []);

  // Key change: notes keep their SpelledPitch unchanged.
  // The harmonic interpretation changes; notes are not moved.
  const handleKeyChange = useCallback((key: KeySignature) => {
    setComposition(s => ({ ...s, keySignature: key }));
  }, []);

  return {
    composition,
    setComposition,
    activeVoiceId,
    setActiveVoiceId,
    handleExport,
    handleImport,
    handleBpmChange,
    handleKeyChange,
  };
};
