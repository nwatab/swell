'use client';

import { useState, useCallback, useRef } from 'react';
import type { Composition } from '../types/song';
import type { SuggestionState, ChatEntry } from '../types/ui-state';
import { diffCompositions } from '../lib/diff';

const genId = () => Math.random().toString(36).slice(2, 10);

export interface UseAgentSuggestionReturn {
  suggestion: SuggestionState;
  history: ChatEntry[];
  handleAgentSubmit: (instruction: string) => Promise<void>;
  handleAccept: () => void;
  handleReject: () => void;
  clearHistory: () => void;
}

export const useAgentSuggestion = (
  composition: Composition,
  setComposition: React.Dispatch<React.SetStateAction<Composition>>,
): UseAgentSuggestionReturn => {
  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const pendingAssistantId = useRef<string | null>(null);

  const handleAgentSubmit = useCallback(async (instruction: string) => {
    const assistantId = genId();
    pendingAssistantId.current = assistantId;

    setHistory(h => [
      ...h,
      { id: genId(), role: 'user', text: instruction },
      { id: assistantId, role: 'assistant', status: 'loading' },
    ]);
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
      const diff = diffCompositions(composition, suggestedComposition);
      setSuggestion({ status: 'ready', suggestedComposition, diff });
      setHistory(h => h.map(entry =>
        entry.id === assistantId
          ? { id: assistantId, role: 'assistant', status: 'ready', diff }
          : entry,
      ));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setSuggestion({ status: 'idle' });
      setHistory(h => h.map(entry =>
        entry.id === assistantId
          ? { id: assistantId, role: 'assistant', status: 'error', message }
          : entry,
      ));
    }
  }, [composition]);

  const handleAccept = useCallback(() => {
    if (suggestion.status !== 'ready') return;
    setComposition(suggestion.suggestedComposition);
    setSuggestion({ status: 'idle' });
    const id = pendingAssistantId.current;
    setHistory(h => h.map(entry =>
      entry.id === id ? { id: entry.id, role: 'assistant', status: 'accepted' } : entry,
    ));
    pendingAssistantId.current = null;
  }, [suggestion, setComposition]);

  const handleReject = useCallback(() => {
    setSuggestion({ status: 'idle' });
    const id = pendingAssistantId.current;
    setHistory(h => h.map(entry =>
      entry.id === id ? { id: entry.id, role: 'assistant', status: 'rejected' } : entry,
    ));
    pendingAssistantId.current = null;
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { suggestion, history, handleAgentSubmit, handleAccept, handleReject, clearHistory };
};
