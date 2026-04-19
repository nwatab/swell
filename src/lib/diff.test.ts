import { diffCompositions } from './diff';
import type { Composition, Note } from '../types/song';
import { DEFAULT_COMPOSITION } from '../types/song';

const BASE: Composition = DEFAULT_COMPOSITION;

const note = (id: string): Note => ({
  id,
  spelledPitch: { letter: 'C', accidental: 0, octave: 4 },
  startBeat: 0,
  duration: 'quarter',
});

const withNote = (comp: Composition, n: Note, voiceIndex = 0): Composition => ({
  ...comp,
  voices: comp.voices.map((v, i) =>
    i !== voiceIndex ? v : { ...v, notes: [...v.notes, n] }
  ),
});

describe('diffCompositions', () => {
  it('all unchanged when compositions are identical', () => {
    const n1 = note('a');
    const comp = withNote(BASE, n1);
    const result = diffCompositions(comp, comp);
    expect(result.unchanged).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('detects added notes', () => {
    const suggested = withNote(BASE, note('new'));
    const result = diffCompositions(BASE, suggested);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe('new');
    expect(result.removed).toHaveLength(0);
  });

  it('detects removed notes', () => {
    const current = withNote(BASE, note('old'));
    const result = diffCompositions(current, BASE);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].id).toBe('old');
    expect(result.added).toHaveLength(0);
  });

  it('handles mixed add/remove/unchanged', () => {
    const shared = note('shared');
    const current = withNote(withNote(BASE, shared), note('gone'));
    const suggested = withNote(withNote(BASE, shared), note('fresh'));
    const result = diffCompositions(current, suggested);
    expect(result.unchanged.map(n => n.id)).toContain('shared');
    expect(result.removed.map(n => n.id)).toContain('gone');
    expect(result.added.map(n => n.id)).toContain('fresh');
  });

  it('both empty → all arrays empty', () => {
    const result = diffCompositions(BASE, BASE);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });
});
