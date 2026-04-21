/**
 * Human/LLM-readable text representation of a Composition.
 * Designed to be passed to Claude API for analysis and modification requests.
 *
 * Format example:
 *   Key: C major | 120 BPM | 4/4 | 8 bars
 *   m1 [I maj]:  S=E4  A=C4  T=G3  B=C3
 *   m2 [V dom7]: S=D5  A=B4  T=G3  B=G2
 */

import type { Composition, Voice, HarmonicDeclaration } from '../../types/song';
import { VOICE_ORDER } from '../../types/song';
import { spelledPitchToString, chordDegreeLabel } from '../harmony';

const VOICE_ABBREV: Record<string, string> = {
  soprano: 'S',
  alto:    'A',
  tenor:   'T',
  bass:    'B',
};

const pitchClassLabel = (decl: HarmonicDeclaration, key: Parameters<typeof chordDegreeLabel>[1]): string => {
  const acc = ['𝄫', '♭', '', '♯', '𝄪'][decl.root.accidental + 2];
  const roman = chordDegreeLabel(decl, key);
  return `${decl.root.letter}${acc} ${decl.quality} (${roman})`;
};

export const compositionToText = (composition: Composition): string => {
  const { bpm, keySignature, timeSignature, measureCount, voices, measures } = composition;
  const acc = ['𝄫', '♭', '', '♯', '𝄪'][keySignature.tonic.accidental + 2];
  const keyLabel = `${keySignature.tonic.letter}${acc} ${keySignature.mode}`;

  const lines: string[] = [
    `Key: ${keyLabel} | ${bpm} BPM | ${timeSignature.numerator}/${timeSignature.denominator} | ${measureCount} bars`,
  ];

  // Voice order for display: soprano first
  const displayOrder = [...VOICE_ORDER].reverse();
  const orderedVoices = displayOrder
    .map(role => voices.find(v => v.role === role))
    .filter((v): v is Voice => v !== undefined);

  const beatsPerMeasure = timeSignature.numerator;

  for (let m = 0; m < measureCount; m++) {
    const measureStartBeat = m * beatsPerMeasure;
    const decl = measures.find(d => d.measureIndex === m);
    const chordLabel = decl ? `[${pitchClassLabel(decl, keySignature)}]` : '';

    // Collect notes starting in this measure, keyed by voice
    const voiceNotes = orderedVoices.map(v => {
      const notes = v.notes
        .filter(n => n.startBeat >= measureStartBeat && n.startBeat < measureStartBeat + beatsPerMeasure)
        .sort((a, b) => a.startBeat - b.startBeat);
      return { voice: v, notes };
    });

    const hasNotes = voiceNotes.some(vn => vn.notes.length > 0);
    if (!hasNotes && !decl) continue;

    const noteStr = voiceNotes
      .filter(vn => vn.notes.length > 0)
      .map(vn => {
        const label = VOICE_ABBREV[vn.voice.role] ?? vn.voice.role;
        return vn.notes.map(n => `${label}=${spelledPitchToString(n.spelledPitch)}`).join(' ');
      })
      .join('  ');

    const prefix = `m${m + 1}${chordLabel ? ` ${chordLabel}` : ''}:`;
    lines.push(`${prefix.padEnd(18)}${noteStr || '(empty)'}`);
  }

  if (lines.length === 1) lines.push('(no notes)');
  return lines.join('\n');
};
