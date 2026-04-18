import { parseSwell } from './deserialize';

const C_MAJOR_KEY = { tonic: { letter: 'C', accidental: 0 }, mode: 'major' };

const VALID_COMPOSITION = JSON.stringify({
  id: 'test-id',
  bpm: 120,
  measureCount: 8,
  keySignature: C_MAJOR_KEY,
  timeSignature: { numerator: 4, denominator: 4 },
  voices: [],
  measures: [],
});

describe('parseSwell', () => {
  it('parses a valid minimal composition', () => {
    const comp = parseSwell(VALID_COMPOSITION);
    expect(comp.bpm).toBe(120);
    expect(comp.measureCount).toBe(8);
    expect(comp.voices).toEqual([]);
    expect(comp.keySignature).toEqual(C_MAJOR_KEY);
  });

  it('throws when bpm is missing', () => {
    const bad = JSON.stringify({ measureCount: 8, keySignature: C_MAJOR_KEY, voices: [], measures: [] });
    expect(() => parseSwell(bad)).toThrow('Invalid composition format');
  });

  it('throws when measureCount is missing', () => {
    const bad = JSON.stringify({ bpm: 120, keySignature: C_MAJOR_KEY, voices: [], measures: [] });
    expect(() => parseSwell(bad)).toThrow('Invalid composition format');
  });

  it('throws when voices is not an array', () => {
    const bad = JSON.stringify({ bpm: 120, measureCount: 8, keySignature: C_MAJOR_KEY, voices: null, measures: [] });
    expect(() => parseSwell(bad)).toThrow('Invalid voices');
  });

  it('throws when keySignature is absent', () => {
    const bad = JSON.stringify({ bpm: 120, measureCount: 8, voices: [], measures: [] });
    expect(() => parseSwell(bad)).toThrow('Missing keySignature');
  });

  it('throws when keySignature.tonic is missing', () => {
    const bad = JSON.stringify({ bpm: 120, measureCount: 8, keySignature: { mode: 'major' }, voices: [], measures: [] });
    expect(() => parseSwell(bad)).toThrow('Missing keySignature');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSwell('not json')).toThrow();
  });
});
