/**
 * Human/LLM-readable text representation of a Composition.
 * Designed to be passed to Claude API for analysis and modification requests.
 *
 * Format example:
 *   Key: C major | 120 BPM | 4/4 | 8 bars
 *   m1 [C maj (I)]:  S=E4  A=C4  T=G3  B=C3
 *   m2 [G dom7 (V7)]: S=D5  A=B4  T=G3  B=G2
 */

import type { Composition, Voice } from '../../types/song';
import { VOICE_ORDER } from '../../types/song';
import { spelledPitchToString, chordDegreeLabel, inferChordFromNotes } from '../harmony';
import { pitchClassLabel } from './chord';

const VOICE_ABBREV: Record<string, string> = {
  soprano: 'S',
  alto:    'A',
  tenor:   'T',
  bass:    'B',
};

export const compositionToText = (composition: Composition): string => {
  const { bpm, keySignature, timeSignature, measureCount, voices } = composition;
  const acc = ['𝄫', '♭', '', '♯', '𝄪'][keySignature.tonic.accidental + 2];
  const keyLabel = `${keySignature.tonic.letter}${acc} ${keySignature.mode}`;

  const lines: string[] = [
    `Key: ${keyLabel} | ${bpm} BPM | ${timeSignature.numerator}/${timeSignature.denominator} | ${measureCount} bars`,
  ];

  const displayOrder = [...VOICE_ORDER].reverse();
  const orderedVoices = displayOrder
    .map(role => voices.find(v => v.role === role))
    .filter((v): v is Voice => v !== undefined);

  const beatsPerMeasure = timeSignature.numerator;

  for (let m = 0; m < measureCount; m++) {
    const measureStartBeat = m * beatsPerMeasure;

    const voiceNotes = orderedVoices.map(v => {
      const notes = v.notes
        .filter(n => n.startBeat >= measureStartBeat && n.startBeat < measureStartBeat + beatsPerMeasure)
        .sort((a, b) => a.startBeat - b.startBeat);
      return { voice: v, notes };
    });

    const hasNotes = voiceNotes.some(vn => vn.notes.length > 0);
    if (!hasNotes) continue;

    const allMeasureNotes = voiceNotes.flatMap(vn => vn.notes);
    const inferred = inferChordFromNotes(allMeasureNotes, keySignature);
    const chordStr = inferred
      ? `[${pitchClassLabel(inferred.root)} ${inferred.quality} (${chordDegreeLabel(inferred, keySignature)})]`
      : '';

    const noteStr = voiceNotes
      .filter(vn => vn.notes.length > 0)
      .map(vn => {
        const label = VOICE_ABBREV[vn.voice.role] ?? vn.voice.role;
        return vn.notes.map(n => `${label}=${spelledPitchToString(n.spelledPitch)}`).join(' ');
      })
      .join('  ');

    const prefix = `m${m + 1}${chordStr ? ` ${chordStr}` : ''}:`;
    lines.push(`${prefix.padEnd(18)}${noteStr}`);
  }

  if (lines.length === 1) lines.push('(no notes)');
  return lines.join('\n');
};
