'use client';

import { useState, useCallback } from 'react';
import type { Composition, KeySignature } from '../types/song';
import { DEFAULT_COMPOSITION } from '../types/song';
import { keyAtBeat, applyKeyTransform } from '../lib/harmony';
import { annotateNote } from '../lib/music/note-operations';
import { downloadSwell } from '../lib/swell-format/serialize';
import {
  nextPartColor,
  addPartToComposition,
  removePartFromComposition,
  renamePart,
  applySATB,
} from '../lib/music/part';

export interface UseCompositionReturn {
  composition: Composition;
  setComposition: React.Dispatch<React.SetStateAction<Composition>>;
  globalKey: KeySignature;
  setGlobalKey: (key: KeySignature) => void;
  activePartId: string | null;
  setActivePartId: React.Dispatch<React.SetStateAction<string | null>>;
  spreadChord: boolean;
  setSpreadChord: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddPart: () => void;
  handleRemovePart: (partId: string) => void;
  handleRenamePart: (partId: string, name: string) => void;
  handleApplySATB: () => void;
  handleExport: () => void;
  handleImport: (imported: Composition) => void;
  handleBpmChange: (bpm: number) => void;
}

export const useComposition = (): UseCompositionReturn => {
  const [composition, setComposition] = useState<Composition>(DEFAULT_COMPOSITION);
  const [activePartId, setActivePartId] = useState<string | null>(null);
  const [spreadChord, setSpreadChord] = useState(false);

  const globalKey = composition.globalKey;

  const setGlobalKey = useCallback((newKey: KeySignature) => {
    setComposition(s => {
      const withNewKey = { ...s, globalKey: newKey };

      // Remap diatonic notes so each keeps its scale degree in the new key,
      // then re-annotate spelledPitch with the new key context.
      return {
        ...withNewKey,
        notes: applyKeyTransform(s.notes, s.globalKey, newKey).map(n => ({
          ...n,
          ...annotateNote(n.pitch, keyAtBeat(withNewKey, n.startBeat)),
        })),
      };
    });
  }, []);

  const handleAddPart = useCallback(() => {
    setComposition(s => {
      const color = nextPartColor(s.parts);
      const name = `Part ${s.parts.length + 1}`;
      const updated = addPartToComposition(s, name, color);
      setActivePartId(updated.parts[updated.parts.length - 1].id);
      return updated;
    });
  }, []);

  const handleRemovePart = useCallback((partId: string) => {
    setComposition(s => removePartFromComposition(s, partId));
    setActivePartId(id => id === partId ? null : id);
  }, []);

  const handleRenamePart = useCallback((partId: string, name: string) => {
    setComposition(s => renamePart(s, partId, name));
  }, []);

  const handleApplySATB = useCallback(() => {
    setComposition(s => {
      const updated = applySATB(s);
      setActivePartId(updated.parts[0]?.id ?? null);
      return updated;
    });
  }, []);

  const handleExport = useCallback(() => downloadSwell(composition), [composition]);
  const handleImport = useCallback((imported: Composition) => setComposition(imported), []);
  const handleBpmChange = useCallback((bpm: number) => {
    setComposition(s => ({ ...s, bpm }));
  }, []);

  return {
    composition,
    setComposition,
    globalKey,
    setGlobalKey,
    activePartId,
    setActivePartId,
    spreadChord,
    setSpreadChord,
    handleAddPart,
    handleRemovePart,
    handleRenamePart,
    handleApplySATB,
    handleExport,
    handleImport,
    handleBpmChange,
  };
};
