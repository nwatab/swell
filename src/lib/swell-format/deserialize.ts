import type { Song } from '../../types/song';

export const parseSwell = (text: string): Song => {
  const d = JSON.parse(text);
  if (d.version !== '1.0') throw new Error(`Unsupported version: ${d.version}`);
  if (
    typeof d.bpm !== 'number' ||
    typeof d.beatsPerMeasure !== 'number' ||
    typeof d.totalBeats !== 'number'
  ) {
    throw new Error('Invalid song format');
  }
  if (!Array.isArray(d.notes)) throw new Error('Invalid notes');
  return {
    ...d,
    streams: Array.isArray(d.streams) ? d.streams : [],
    globalKey: d.globalKey ?? { root: 'C', mode: 'major' },
    modulations: Array.isArray(d.modulations) ? d.modulations : undefined,
  } as Song;
};
