import type { VoiceRole, SpelledPitch, KeySignature, Composition } from '../../types/song';
import { VOICE_ORDER } from '../../types/song';
import { spellMidi, spelledPitchToMidi } from '../harmony';
import { minCostAssign } from '../minCostAssign';
import { MIN_MIDI, MAX_MIDI } from './note-operations';

// Standard SATB vocal ranges (MIDI numbers)
export const VOICE_RANGES: Record<VoiceRole, { readonly min: number; readonly max: number }> = {
  soprano: { min: 60, max: 79 }, // C4–G5
  alto:    { min: 55, max: 72 }, // G3–C5
  tenor:   { min: 48, max: 67 }, // C3–G4
  bass:    { min: 40, max: 60 }, // E2–C4
};

const RANGE_PENALTY = 1000;

const getChordToneMidis = (rootMidi: number, intervals: readonly number[]): readonly number[] => {
  const rootClass = ((rootMidi % 12) + 12) % 12;
  const result: number[] = [];
  for (let p = MIN_MIDI; p <= MAX_MIDI; p++) {
    const semitone = ((p % 12) - rootClass + 12) % 12;
    if ((intervals as number[]).includes(semitone)) result.push(p);
  }
  return result;
};

const movementCost = (voice: VoiceRole, newPitch: number, prevPitch: number): number => {
  const { min, max } = VOICE_RANGES[voice];
  const rangePenalty = newPitch < min || newPitch > max ? RANGE_PENALTY : 0;
  return Math.abs(newPitch - prevPitch) + rangePenalty;
};

/**
 * Get the most recent MIDI pitch for each voice strictly before `beat`.
 * Returns null unless all four voices have at least one prior note.
 */
export const getPrevVoicePitches = (
  composition: Composition,
  beat: number,
): Record<VoiceRole, number> | null => {
  const result: Partial<Record<VoiceRole, number>> = {};

  for (const voice of composition.voices) {
    const prior = voice.notes.filter(n => n.startBeat < beat);
    if (prior.length === 0) continue;
    const latest = prior.reduce((a, b) => (a.startBeat >= b.startBeat ? a : b));
    result[voice.role] = spelledPitchToMidi(latest.spelledPitch);
  }

  return (VOICE_ORDER as readonly VoiceRole[]).every(r => r in result)
    ? (result as Record<VoiceRole, number>)
    : null;
};

/**
 * Assign chord tones to voices to minimise total semitone movement from
 * prevPitches, with a penalty for leaving each voice's standard range.
 * Returns null if fewer chord tone candidates exist than voices.
 */
export const resolveVoiceLeading = (
  prevPitches: Record<VoiceRole, number>,
  rootMidi: number,
  intervals: readonly number[],
  key: KeySignature,
): Record<VoiceRole, SpelledPitch> | null => {
  const voices = VOICE_ORDER as readonly VoiceRole[];
  const candidates = getChordToneMidis(rootMidi, intervals);
  if (candidates.length < voices.length) return null;

  const assignment = minCostAssign(
    voices.length,
    candidates.length,
    (vi, ci) => movementCost(voices[vi], candidates[ci], prevPitches[voices[vi]]),
  );

  if (assignment.length !== voices.length) return null;

  return Object.fromEntries(
    voices.map((v, i) => [v, spellMidi(candidates[assignment[i]], key)])
  ) as Record<VoiceRole, SpelledPitch>;
};
