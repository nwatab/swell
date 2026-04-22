import type { PitchClass, ChordQuality } from '../../types/song';

export type ChordType = 'note' | 'maj' | 'min' | 'maj7' | 'min7' | 'dia' | 'dia7';

export const CHORD_INTERVALS: Record<Exclude<ChordType, 'dia' | 'dia7'>, readonly number[]> = {
  note: [0],
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

export const CHORD_LABELS: Record<ChordType, string> = {
  note:  '♩',
  maj:   'Maj',
  min:   'Min',
  maj7:  'Maj7',
  min7:  'Min7',
  dia:   'Dia',
  dia7:  'Dia7',
};

// ── Chord name display ────────────────────────────────────────────────────────

const ACCIDENTAL_SYMBOL: Record<string, string> = {
  '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪',
};

const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj:   '',
  min:   'm',
  dim:   '°',
  aug:   '+',
  dom7:  '7',
  maj7:  'M7',
  min7:  'm7',
  hdim7: 'ø7',
  dim7:  '°7',
};

export const pitchClassLabel = (pc: PitchClass): string =>
  pc.letter + (ACCIDENTAL_SYMBOL[String(pc.accidental)] ?? '');

export const chordLabel = (chord: { root: PitchClass; quality: ChordQuality }): string =>
  pitchClassLabel(chord.root) + QUALITY_SUFFIX[chord.quality];
