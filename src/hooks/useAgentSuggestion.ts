'use client';

import { useState, useCallback } from 'react';
import type { Composition } from '../types/song';
import type { SuggestionState } from '../types/ui-state';
import { diffCompositions } from '../lib/diff';

export interface UseAgentSuggestionReturn {
  suggestion: SuggestionState;
  handleAgentSubmit: (instruction: string) => Promise<void>;
  handleAccept: () => void;
  handleReject: () => void;
}

export const useAgentSuggestion = (
  composition: Composition,
  setComposition: React.Dispatch<React.SetStateAction<Composition>>,
): UseAgentSuggestionReturn => {
  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });

  const handleAgentSubmit = useCallback(async (instruction: string) => {
    setSuggestion({ status: 'loading' });
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ composition, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'API error');
      const suggestedComposition: Composition = data.suggestedComposition;
      setSuggestion({
        status: 'ready',
        suggestedComposition,
        diff: diffCompositions(composition, suggestedComposition),
      });
    } catch (err) {
      console.error(err);
      setSuggestion({ status: 'idle' });
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [composition]);

  const handleAccept = useCallback(() => {
    if (suggestion.status !== 'ready') return;
    setComposition(suggestion.suggestedComposition);
    setSuggestion({ status: 'idle' });
  }, [suggestion, setComposition]);

  const handleReject = useCallback(() => {
    setSuggestion({ status: 'idle' });
  }, []);

  return { suggestion, handleAgentSubmit, handleAccept, handleReject };
};
