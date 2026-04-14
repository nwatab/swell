import { diffSongs } from './diff';
import type { Song, Note } from '../types/song';

const BASE: Song = {
  version: '1.0',
  bpm: 120,
  beatsPerMeasure: 4,
  totalBeats: 16,
  notes: [],
  streams: [],
  globalKey: { root: 'C', mode: 'major' },
};

const note = (id: string, pitch = 60): Note => ({
  id,
  pitch,
  startBeat: 0,
  durationBeats: 1,
  velocity: 100,
});

describe('diffSongs', () => {
  it('all unchanged when songs are identical', () => {
    const n1 = note('a');
    const song = { ...BASE, notes: [n1] };
    const result = diffSongs(song, song);
    expect(result.unchanged).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('detects added notes', () => {
    const current = BASE;
    const suggested = { ...BASE, notes: [note('new')] };
    const result = diffSongs(current, suggested);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('new');
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('detects removed notes', () => {
    const current = { ...BASE, notes: [note('old')] };
    const suggested = BASE;
    const result = diffSongs(current, suggested);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].id).toBe('old');
    expect(result.added).toHaveLength(0);
  });

  it('handles mixed add/remove/unchanged', () => {
    const shared = note('shared');
    const current = { ...BASE, notes: [shared, note('gone')] };
    const suggested = { ...BASE, notes: [shared, note('fresh')] };
    const result = diffSongs(current, suggested);
    expect(result.unchanged.map(n => n.id)).toEqual(['shared']);
    expect(result.removed.map(n => n.id)).toEqual(['gone']);
    expect(result.added.map(n => n.id)).toEqual(['fresh']);
  });

  it('both empty → all arrays empty', () => {
    const result = diffSongs(BASE, BASE);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });
});
