'use client';

import { useState, useCallback, useRef } from 'react';
import type { Composition } from '../types/song';
import { totalBeats, DURATION_BEATS } from '../types/song';
import { playComposition } from '../lib/audio';

export interface UsePlaybackReturn {
  playing: boolean;
  playhead: number;
  togglePlay: () => void;
}

export const usePlayback = (activeComposition: Composition): UsePlaybackReturn => {
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopOscillatorsRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);
  const playStartWallRef = useRef<number>(0);
  const activeCompositionRef = useRef<Composition>(activeComposition);
  activeCompositionRef.current = activeComposition;
  const isPlayingRef = useRef(false);

  const getCtx = (): AudioContext => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    stopOscillatorsRef.current?.();
    stopOscillatorsRef.current = null;
    setPlaying(false);
    setPlayhead(0);
  }, []);

  const startPlayback = useCallback(() => {
    const comp = activeCompositionRef.current;
    const ctx = getCtx();
    const bps = comp.bpm / 60;
    const lastNoteEnd = comp.voices
      .flatMap(v => v.notes)
      .reduce((max, n) => Math.max(max, n.startBeat + DURATION_BEATS[n.duration]), 0);
    const total = lastNoteEnd > 0 ? lastNoteEnd : totalBeats(comp);
    stopOscillatorsRef.current = playComposition(ctx, comp);
    playStartWallRef.current = performance.now();
    isPlayingRef.current = true;
    setPlaying(true);

    const tick = () => {
      if (!isPlayingRef.current) return;
      const elapsed = (performance.now() - playStartWallRef.current) / 1000;
      const beat = elapsed * bps;
      if (beat >= total) { stopPlayback(); return; }
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
