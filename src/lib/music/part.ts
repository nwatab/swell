import type { Composition, Part, VoiceRole } from '../../types/song';
import { genId } from '../id';

const PART_COLORS = [
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

export const nextPartColor = (parts: readonly Part[]): string => {
  const used = new Set(parts.map(p => p.color));
  return PART_COLORS.find(c => !used.has(c)) ?? PART_COLORS[parts.length % PART_COLORS.length];
};

export const addPartToComposition = (composition: Composition, name: string, color: string): Composition => ({
  ...composition,
  parts: [...composition.parts, { id: genId(), name, color }],
});

export const removePartFromComposition = (composition: Composition, partId: string): Composition => ({
  ...composition,
  parts: composition.parts.filter(p => p.id !== partId),
  notes: composition.notes.map(n => n.partId === partId ? { ...n, partId: undefined } : n),
});

export const renamePart = (composition: Composition, partId: string, name: string): Composition => ({
  ...composition,
  parts: composition.parts.map(p => p.id === partId ? { ...p, name } : p),
});

export const applySATB = (composition: Composition): Composition => {
  const parts: Part[] = SATB_NAMES.map((name, i) => ({
    id: genId(),
    name,
    color: SATB_COLORS[i],
    voice: name.toLowerCase() as VoiceRole,
  }));
  return { ...composition, parts };
};
