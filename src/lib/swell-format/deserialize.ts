import type { Composition } from '../../types/song';

export const parseSwell = (text: string): Composition => {
  const d = JSON.parse(text);
  if (d.version !== '2.0') throw new Error(`Unsupported version: ${d.version}`);
  if (
    typeof d.bpm !== 'number' ||
    typeof d.beatsPerMeasure !== 'number' ||
    typeof d.totalBeats !== 'number'
  ) {
    throw new Error('Invalid composition format');
  }
  if (!Array.isArray(d.notes)) throw new Error('Invalid notes');
  if (!d.globalKey?.root || !d.globalKey?.mode) throw new Error('Missing globalKey');
  return {
    ...d,
    tracks: Array.isArray(d.tracks) ? d.tracks : [],
    parts: Array.isArray(d.parts) ? d.parts : [],
    modulations: Array.isArray(d.modulations) ? d.modulations : undefined,
  } as Composition;
};
