import type { Composition, Track, VoiceRole } from '../../types/song';
import { genId } from '../id';

const TRACK_COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // rose
  '#a78bfa', // violet
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#e879f9', // fuchsia
] as const;

// SATB order: low → high so spread distributes bass-up
const SATB_NAMES  = ['Bass', 'Tenor', 'Alto', 'Soprano'] as const;
const SATB_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa'] as const;

export const nextTrackColor = (tracks: readonly Track[]): string => {
  const used = new Set(tracks.map(s => s.color));
  return TRACK_COLORS.find(c => !used.has(c)) ?? TRACK_COLORS[tracks.length % TRACK_COLORS.length];
};

export const addTrackToComposition = (composition: Composition, name: string, color: string): Composition => ({
  ...composition,
  tracks: [...composition.tracks, { id: genId(), name, color }],
});

export const removeTrackFromComposition = (composition: Composition, trackId: string): Composition => ({
  ...composition,
  tracks: composition.tracks.filter(s => s.id !== trackId),
  parts: composition.parts.filter(p => p.trackId !== trackId),
  notes: composition.notes.map(n => n.partId === trackId ? { ...n, partId: undefined } : n),
});

export const renameTrack = (composition: Composition, trackId: string, name: string): Composition => ({
  ...composition,
  tracks: composition.tracks.map(s => s.id === trackId ? { ...s, name } : s),
});

export const applySATB = (composition: Composition): Composition => {
  const tracks = SATB_NAMES.map((name, i) => ({
    id: genId(), name, color: SATB_COLORS[i],
  }));
  const parts = tracks.map((track, i) => ({
    id: genId(),
    trackId: track.id,
    voice: SATB_NAMES[i].toLowerCase() as VoiceRole,
  }));
  return { ...composition, tracks, parts };
};
