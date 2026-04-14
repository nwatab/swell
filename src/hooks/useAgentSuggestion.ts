'use client';

import { useState, useCallback } from 'react';
import type { Song } from '../types/song';
import type { SuggestionState } from '../types/ui-state';
import { diffSongs } from '../lib/diff';

export interface UseAgentSuggestionReturn {
  suggestion: SuggestionState;
  handleAgentSubmit: (instruction: string) => Promise<void>;
  handleAccept: () => void;
  handleReject: () => void;
}

export const useAgentSuggestion = (
  song: Song,
  setSong: React.Dispatch<React.SetStateAction<Song>>,
): UseAgentSuggestionReturn => {
  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });

  const handleAgentSubmit = useCallback(async (instruction: string) => {
    setSuggestion({ status: 'loading' });
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'API error');
      const suggestedSong: Song = data.suggestedSong;
      setSuggestion({
        status: 'ready',
        suggestedSong,
        diff: diffSongs(song, suggestedSong),
      });
    } catch (err) {
      console.error(err);
      setSuggestion({ status: 'idle' });
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [song]);

  const handleAccept = useCallback(() => {
    if (suggestion.status !== 'ready') return;
    setSong(suggestion.suggestedSong);
    setSuggestion({ status: 'idle' });
  }, [suggestion, setSong]);

  const handleReject = useCallback(() => {
    setSuggestion({ status: 'idle' });
  }, []);

  return { suggestion, handleAgentSubmit, handleAccept, handleReject };
};
