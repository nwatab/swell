import type { Composition } from '../../types/song';

export const parseSwell = (text: string): Composition => {
  const d = JSON.parse(text) as Record<string, unknown>;
  if (
    typeof d.bpm !== 'number' ||
    typeof d.measureCount !== 'number'
  ) {
    throw new Error('Invalid composition format');
  }
  if (!Array.isArray(d.voices)) throw new Error('Invalid voices');
  const ks = d.keySignature as Record<string, unknown> | undefined;
  if (!ks?.tonic || !ks?.mode) throw new Error('Missing keySignature');
  return d as unknown as Composition;
};
