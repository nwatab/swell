import { parseSwell } from './deserialize';

const VALID_SONG = JSON.stringify({
  version: '1.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 32,
  notes: [],
  streams: [],
});

describe('parseSwell', () => {
  it('parses a valid minimal song', () => {
    const song = parseSwell(VALID_SONG);
    expect(song.version).toBe('1.0');
    expect(song.bpm).toBe(120);
    expect(song.notes).toEqual([]);
    expect(song.streams).toEqual([]);
  });

  it('throws on unsupported version', () => {
    const bad = JSON.stringify({ version: '2.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [] });
    expect(() => parseSwell(bad)).toThrow('Unsupported version');
  });

  it('throws when bpm is missing', () => {
    const bad = JSON.stringify({ version: '1.0', beatsPerMeasure: 4, totalBeats: 32, notes: [] });
    expect(() => parseSwell(bad)).toThrow('Invalid song format');
  });

  it('throws when notes is not an array', () => {
    const bad = JSON.stringify({ version: '1.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: null });
    expect(() => parseSwell(bad)).toThrow('Invalid notes');
  });

  it('defaults missing streams to empty array', () => {
    const noStreams = JSON.stringify({ version: '1.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [] });
    const song = parseSwell(noStreams);
    expect(song.streams).toEqual([]);
  });

  it('preserves globalKey when present', () => {
    const withKey = JSON.stringify({
      version: '1.0', bpm: 120, beatsPerMeasure: 4, totalBeats: 32, notes: [], streams: [],
      globalKey: { root: 'G', mode: 'major' },
    });
    const song = parseSwell(withKey);
    expect(song.globalKey).toEqual({ root: 'G', mode: 'major' });
  });

  it('defaults globalKey to C major when absent', () => {
    const song = parseSwell(VALID_SONG);
    expect(song.globalKey).toEqual({ root: 'C', mode: 'major' });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSwell('not json')).toThrow();
  });
});
