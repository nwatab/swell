import type { Song, Stream } from '../../types/song';
import { genId } from '../id';

const STREAM_COLORS = [
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

export const nextStreamColor = (streams: readonly Stream[]): string => {
  const used = new Set(streams.map(s => s.color));
  return STREAM_COLORS.find(c => !used.has(c)) ?? STREAM_COLORS[streams.length % STREAM_COLORS.length];
};

export const addStreamToSong = (song: Song, name: string, color: string): Song => ({
  ...song,
  streams: [...song.streams, { id: genId(), name, color }],
});

export const removeStreamFromSong = (song: Song, streamId: string): Song => ({
  ...song,
  streams: song.streams.filter(s => s.id !== streamId),
  notes: song.notes.map(n => n.streamId === streamId ? { ...n, streamId: undefined } : n),
});

export const renameStream = (song: Song, streamId: string, name: string): Song => ({
  ...song,
  streams: song.streams.map(s => s.id === streamId ? { ...s, name } : s),
});

export const applySATB = (song: Song): Song => ({
  ...song,
  streams: SATB_NAMES.map((name, i) => ({ id: genId(), name, color: SATB_COLORS[i] })),
});
