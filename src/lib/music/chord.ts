export type ChordType = 'note' | 'maj' | 'min' | 'maj7' | 'min7' | 'dia' | 'dia7';

export const CHORD_INTERVALS: Record<Exclude<ChordType, 'dia' | 'dia7'>, readonly number[]> = {
  note: [0],
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

export const CHORD_LABELS: Record<ChordType, string> = {
  note:  '—',
  maj:   'Maj',
  min:   'Min',
  maj7:  'Maj7',
  min7:  'Min7',
  dia:   'Dia',
  dia7:  'Dia7',
};
