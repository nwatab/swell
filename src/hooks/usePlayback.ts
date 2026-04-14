'use client';

import { useState, useCallback, useRef } from 'react';
import type { Song } from '../types/song';
import { playSong } from '../lib/audio';

export interface UsePlaybackReturn {
  playing: boolean;
  playhead: number;
  togglePlay: () => void;
}

export const usePlayback = (activeSong: Song): UsePlaybackReturn => {
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopOscillatorsRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);
  const playStartWallRef = useRef<number>(0);
  const activeSongRef = useRef<Song>(activeSong);
  activeSongRef.current = activeSong;

  const getCtx = (): AudioContext => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopOscillatorsRef.current?.();
    stopOscillatorsRef.current = null;
    setPlaying(false);
    setPlayhead(0);
  }, []);

  const startPlayback = useCallback(() => {
    const song = activeSongRef.current;
    const ctx = getCtx();
    const bps = song.bpm / 60;
    stopOscillatorsRef.current = playSong(ctx, song);
    playStartWallRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const elapsed = (performance.now() - playStartWallRef.current) / 1000;
      const beat = elapsed * bps;
      if (beat >= activeSongRef.current.totalBeats) { stopPlayback(); return; }
      setPlayhead(beat);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopPlayback]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlayback(); else startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  return { playing, playhead, togglePlay };
};
