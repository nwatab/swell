import type { Composition } from '../../types/song';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ACCIDENTALS = [-2, -1, 0, 1, 2];
const ROLES = ['soprano', 'alto', 'tenor', 'bass'];
const DURATIONS = ['whole', 'half', 'quarter', 'eighth'];

export const validateComposition = (raw: unknown): string | null => {
  if (typeof raw !== 'object' || raw === null) return 'root must be an object';
  const d = raw as Record<string, unknown>;

  if (typeof d.id !== 'string') return 'id must be a string';
  if (typeof d.bpm !== 'number') return 'bpm must be a number';
  if (typeof d.measureCount !== 'number') return 'measureCount must be a number';

  if (typeof d.keySignature !== 'object' || d.keySignature === null)
    return 'keySignature must be an object';
  const ks = d.keySignature as Record<string, unknown>;
  if (typeof ks.tonic !== 'object' || ks.tonic === null) return 'keySignature.tonic must be an object';
  const tonic = ks.tonic as Record<string, unknown>;
  if (!LETTERS.includes(tonic.letter as string))
    return `keySignature.tonic.letter must be one of ${LETTERS.join('|')}`;
  if (!ACCIDENTALS.includes(tonic.accidental as number))
    return 'keySignature.tonic.accidental must be -2|-1|0|1|2';
  if (ks.mode !== 'major' && ks.mode !== 'minor')
    return 'keySignature.mode must be "major" or "minor"';

  if (typeof d.timeSignature !== 'object' || d.timeSignature === null)
    return 'timeSignature must be an object';
  const ts = d.timeSignature as Record<string, unknown>;
  if (typeof ts.numerator !== 'number') return 'timeSignature.numerator must be a number';
  if (typeof ts.denominator !== 'number') return 'timeSignature.denominator must be a number';

  if (!Array.isArray(d.voices)) return 'voices must be an array';
  for (let vi = 0; vi < d.voices.length; vi++) {
    const v = d.voices[vi] as Record<string, unknown>;
    if (typeof v.id !== 'string') return `voices[${vi}].id must be a string`;
    if (!ROLES.includes(v.role as string))
      return `voices[${vi}].role must be one of ${ROLES.join('|')}`;
    if (!Array.isArray(v.notes)) return `voices[${vi}].notes must be an array`;
    for (let ni = 0; ni < v.notes.length; ni++) {
      const n = v.notes[ni] as Record<string, unknown>;
      if (typeof n.id !== 'string') return `voices[${vi}].notes[${ni}].id must be a string`;
      if (typeof n.startBeat !== 'number')
        return `voices[${vi}].notes[${ni}].startBeat must be a number`;
      if (!DURATIONS.includes(n.duration as string))
        return `voices[${vi}].notes[${ni}].duration must be one of ${DURATIONS.join('|')}`;
      if (typeof n.spelledPitch !== 'object' || n.spelledPitch === null)
        return `voices[${vi}].notes[${ni}].spelledPitch must be an object`;
      const sp = n.spelledPitch as Record<string, unknown>;
      if (!LETTERS.includes(sp.letter as string))
        return `voices[${vi}].notes[${ni}].spelledPitch.letter must be one of ${LETTERS.join('|')}`;
      if (!ACCIDENTALS.includes(sp.accidental as number))
        return `voices[${vi}].notes[${ni}].spelledPitch.accidental must be -2|-1|0|1|2`;
      if (typeof sp.octave !== 'number')
        return `voices[${vi}].notes[${ni}].spelledPitch.octave must be a number`;
    }
  }

  if (!Array.isArray(d.measures)) return 'measures must be an array';

  return null;
};

export const parseSwell = (text: string): Composition => {
  const d = JSON.parse(text) as Record<string, unknown>;
  if (typeof d.bpm !== 'number' || typeof d.measureCount !== 'number') {
    throw new Error('Invalid composition format');
  }
  if (!Array.isArray(d.voices)) throw new Error('Invalid voices');
  const ks = d.keySignature as Record<string, unknown> | undefined;
  if (!ks?.tonic || !ks?.mode) throw new Error('Missing keySignature');
  return d as unknown as Composition;
};
