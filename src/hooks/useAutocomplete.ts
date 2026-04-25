'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Composition } from '../types/song';
import { beatsPerMeasure, DURATION_BEATS } from '../types/song';
import type { AutocompleteState, AutocompleteNote } from '../types/ui-state';
import { addNote } from '../lib/music/note-operations';
import { genId } from '../lib/id';

export type UseAutocompleteReturn = {
  autocomplete: AutocompleteState;
  acceptAutocomplete: () => void;
  dismissAutocomplete: () => void;
};

export const useAutocomplete = (
  composition: Composition,
  setComposition: React.Dispatch<React.SetStateAction<Composition>>,
  suggestionActive: boolean,
): UseAutocompleteReturn => {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({ status: 'idle' });
  const [fetchedFor, setFetchedFor] = useState<Composition | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const bpm = beatsPerMeasure(composition);

  useEffect(() => {
    if (suggestionActive) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ composition }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.notes) {
          setAutocomplete({ status: 'idle' });
          return;
        }
        setFetchedFor(composition);
        setAutocomplete({ status: 'ready', notes: data.notes as AutocompleteNote[] });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setAutocomplete({ status: 'idle' });
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [composition, suggestionActive]);

  // Notes fetched for a different composition are stale — suppress them immediately
  // without calling setState in the effect body.
  const effectiveAutocomplete = useMemo<AutocompleteState>(
    () => autocomplete.status === 'ready' && fetchedFor === composition
      ? autocomplete
      : { status: 'idle' },
    [autocomplete, fetchedFor, composition],
  );

  const acceptAutocomplete = useCallback(() => {
    if (effectiveAutocomplete.status !== 'ready') return;
    const { notes } = effectiveAutocomplete;

    setComposition(comp => {
      const maxBeat = Math.max(...notes.map(n => n.startBeat + DURATION_BEATS[n.duration]));
      const maxMeasureIdx = Math.ceil(maxBeat / bpm) - 1;
      let updated = maxMeasureIdx >= comp.measureCount
        ? { ...comp, measureCount: comp.measureCount + 1 }
        : comp;
      const chordId = genId();
      for (const gn of notes) {
        const binding = { kind: 'chord_tone' as const, chordId, role: 'root' as const };
        updated = addNote(updated, gn.voiceId, gn.spelledPitch, gn.startBeat, gn.duration, binding);
      }
      return updated;
    });
    setAutocomplete({ status: 'idle' });
  }, [effectiveAutocomplete, bpm, setComposition]);

  const dismissAutocomplete = useCallback(() => {
    setAutocomplete({ status: 'idle' });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (effectiveAutocomplete.status !== 'ready') return;
      const tag = (document.activeElement as HTMLElement)?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        acceptAutocomplete();
      } else if (e.key === 'Escape') {
        dismissAutocomplete();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [effectiveAutocomplete.status, acceptAutocomplete, dismissAutocomplete]);

  return { autocomplete: effectiveAutocomplete, acceptAutocomplete, dismissAutocomplete };
};
