'use client';

import { useState, useCallback } from 'react';
import type { MusicGenState } from '../types/ui-state';

export interface UseMusicGenReturn {
  musicGen: MusicGenState;
  handleMusicGenToggle: () => void;
  handleMusicGen: (prompt: string) => Promise<void>;
  closeMusicGen: () => void;
}

export const useMusicGen = (): UseMusicGenReturn => {
  const [musicGen, setMusicGen] = useState<MusicGenState>({ status: 'hidden' });

  const handleMusicGenToggle = useCallback(() => {
    setMusicGen(s => s.status === 'hidden' ? { status: 'idle' } : { status: 'hidden' });
  }, []);

  const handleMusicGen = useCallback(async (prompt: string) => {
    setMusicGen({ status: 'loading' });
    try {
      const res = await fetch('/api/musicgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMusicGen({ status: 'error', message: data.error ?? 'API error' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'composition.mp3';
      a.click();
      URL.revokeObjectURL(url);
      setMusicGen({ status: 'idle' });
    } catch (err) {
      setMusicGen({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const closeMusicGen = useCallback(() => {
    setMusicGen({ status: 'hidden' });
  }, []);

  return { musicGen, handleMusicGenToggle, handleMusicGen, closeMusicGen };
};
