/**
 * Human/LLM-readable text representation of a Composition.
 *
 * Designed to be passed to Claude API for analysis and modification requests.
 * Solves ADR-005 Option A: Notes → chord-annotated representation.
 *
 * Format example:
 *   Key: C major | 120 BPM | 4/4 | 8 bars
 *   m1 b1 [I]:  S=E4(3rd)  A=C4(root)  T=G3(5th)  B=C3(root)
 *   m1 b2 [V7]: S=D5(5th)  A=B4(3rd)   T=G3(root) B=G2(root)
 *   ...
 */

import type { Composition, Note, KeySignature, Chord, VoiceRole } from '../../types/song';
import { keyAtBeat, spelledPitchToString, spellMidi } from '../harmony';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOICE_ABBREV: Partial<Record<VoiceRole, string>> = {
  soprano: 'S',
  alto:    'A',
  tenor:   'T',
  bass:    'B',
};

const ROLE_ABBREV: Record<string, string> = {
  root:    'root',
  third:   '3rd',
  fifth:   '5th',
  seventh: '7th',
  ninth:   '9th',
};

const NCT_ABBREV: Record<string, string> = {
  passing:     'pass',
  neighbor:    'nbr',
  appoggiatura: 'app',
  suspension:  'sus',
};

/** Format a single note for the score representation. */
const formatNote = (
  note: Note,
  key: KeySignature,
  voiceLabel: string,
): string => {
  const pitch = note.spelledPitch
    ? spelledPitchToString(note.spelledPitch)
    : spelledPitchToString(spellMidi(note.pitch, key));

  let annotation = '';
  if (note.binding) {
    if (note.binding.kind === 'chord_tone') {
      const role = ROLE_ABBREV[note.binding.role] ?? note.binding.role;
      const alt = note.binding.alteration !== 0
        ? (note.binding.alteration > 0 ? `+${note.binding.alteration}` : `${note.binding.alteration}`)
        : '';
      annotation = `(${role}${alt})`;
    } else if (note.binding.kind === 'scale_degree') {
      const alt = note.binding.alteration !== 0
        ? (note.binding.alteration > 0 ? `+${note.binding.alteration}` : `${note.binding.alteration}`)
        : '';
      annotation = `(deg${note.binding.degree}${alt})`;
    } else if (note.binding.kind === 'non_chord_tone') {
      annotation = `(${NCT_ABBREV[note.binding.function] ?? note.binding.function})`;
    }
    // 'absolute' has no annotation
  }

  return `${voiceLabel}=${pitch}${annotation}`;
};

/** Find the chord active at a given beat, if any. */
const chordAtBeat = (chords: readonly Chord[], beat: number): Chord | undefined =>
  [...chords]
    .filter(c => c.startBeat <= beat && beat < c.startBeat + c.durationBeats)
    .sort((a, b) => b.startBeat - a.startBeat)[0];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a Composition to a compact, chord-annotated text string suitable
 * for LLM consumption or human review.
 *
 * Voice labels come from Part.voice (soprano/alto/tenor/bass).
 * Falls back to part index (p0/p1/…) when voice is unlabeled.
 */
export const compositionToText = (composition: Composition): string => {
  const { bpm, beatsPerMeasure, totalBeats, globalKey, notes, parts, chords = [] } = composition;
  const totalBars = Math.ceil(totalBeats / beatsPerMeasure);

  const lines: string[] = [
    `Key: ${globalKey.root} ${globalKey.mode} | ${bpm} BPM | ${beatsPerMeasure}/4 | ${totalBars} bars`,
  ];

  // Build part label map
  const partLabel = new Map<string, string>(
    parts.map((p, i) => [p.id, VOICE_ABBREV[p.voice as VoiceRole] ?? `p${i}`]),
  );

  // Group notes by beat, sorted
  const byBeat = new Map<number, Note[]>();
  for (const note of notes) {
    if (!byBeat.has(note.startBeat)) byBeat.set(note.startBeat, []);
    byBeat.get(note.startBeat)!.push(note);
  }

  const beatsSorted = [...byBeat.keys()].sort((a, b) => a - b);

  for (const beat of beatsSorted) {
    const bar  = Math.floor(beat / beatsPerMeasure) + 1;
    const bInM = (beat % beatsPerMeasure) + 1;
    const key  = keyAtBeat(composition, beat);

    const chord = chordAtBeat(chords, beat);
    const chordLabel = chord ? `[${chord.romanNumeral}]` : '';

    const beatNotes = byBeat.get(beat)!;

    // Sort notes by voice order (bass→soprano) then by pitch descending
    const VOICE_ORDER: VoiceRole[] = ['bass', 'tenor', 'alto', 'soprano'];
    beatNotes.sort((a, b) => {
      const pa = parts.find(p => p.id === a.partId);
      const pb = parts.find(p => p.id === b.partId);
      const va = VOICE_ORDER.indexOf(pa?.voice as VoiceRole);
      const vb = VOICE_ORDER.indexOf(pb?.voice as VoiceRole);
      if (va !== -1 && vb !== -1) return vb - va; // soprano first
      return b.pitch - a.pitch;
    });

    const noteStrs = beatNotes.map(n => {
      const label = n.partId ? (partLabel.get(n.partId) ?? 'x') : '?';
      return formatNote(n, key, label);
    });

    const prefix = `m${bar} b${bInM}${chordLabel ? ` ${chordLabel}` : ''}:`;
    lines.push(`${prefix.padEnd(16)}${noteStrs.join('  ')}`);
  }

  if (lines.length === 1) lines.push('(no notes)');

  return lines.join('\n');
};
