import { parseSwell } from './deserialize';

const VALID_COMPOSITION = JSON.stringify({
  id: 'test-id',
  version: '2.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 32,
  notes: [],
  parts: [],
  globalKey: { root: 'C', mode: 'major' },
});

describe('parseSwell', () => {
  it('parses a valid minimal composition', () => {
    const comp = parseSwell(VALID_COMPOSITION);
    expect(comp.version).toBe('2.0');
    expect(comp.bpm).toBe(120);
    expect(comp.notes).toEqual([]);
    expect(comp.parts).toEqual([]);
  });

  it('throws on unsupported version', () => {
    const bad = JSON.stringify({ version: '1.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [] });
    expect(() => parseSwell(bad)).toThrow('Unsupported version');
  });

  it('throws when bpm is missing', () => {
    const bad = JSON.stringify({ version: '2.0', beatsPerMeasure: 4, totalBeats: 32, notes: [] });
    expect(() => parseSwell(bad)).toThrow('Invalid composition format');
  });

  it('throws when notes is not an array', () => {
    const bad = JSON.stringify({ version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: null });
    expect(() => parseSwell(bad)).toThrow('Invalid notes');
  });

  it('defaults missing parts to empty array', () => {
    const noParts = JSON.stringify({ id: 'x', version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], globalKey: { root: 'C', mode: 'major' } });
    const comp = parseSwell(noParts);
    expect(comp.parts).toEqual([]);
  });

  it('preserves globalKey', () => {
    const withKey = JSON.stringify({
      id: 'x', version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], parts: [],
      globalKey: { root: 'G', mode: 'major' },
    });
    const comp = parseSwell(withKey);
    expect(comp.globalKey).toEqual({ root: 'G', mode: 'major' });
  });

  it('throws when globalKey is absent', () => {
    const noKey = JSON.stringify({ id: 'x', version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], parts: [] });
    expect(() => parseSwell(noKey)).toThrow('Missing globalKey');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSwell('not json')).toThrow();
  });
});
