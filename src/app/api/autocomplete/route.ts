import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Composition } from '../../../types/song';
import { beatsPerMeasure, DURATION_BEATS } from '../../../types/song';
import type { AutocompleteNote } from '../../../types/ui-state';
import { compositionToText } from '../../../lib/music/score-repr';
import { spreadChordAcrossVoices } from '../../../lib/music/note-operations';
import { spelledPitchToMidi } from '../../../lib/harmony';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a music continuation assistant for a 4-voice SATB piano roll editor.
Given an SATB composition, suggest the next measure as 4 whole notes (one per voice).
Output ONLY a valid JSON array — no text, no markdown, no explanation.

JSON schema for each element:
{ "voiceId": string, "spelledPitch": { "letter": string, "accidental": number, "octave": number }, "startBeat": number, "duration": "whole" }

Rules:
- Exactly 4 notes, one per voice (use the voice IDs provided)
- duration must be "whole"
- Study the existing progression and choose the chord that best continues the harmonic narrative — consider function (tonic/subdominant/dominant), whether a cadence is appropriate, and what creates musical interest at this point
- Choose smooth voice leading: minimize leaps, resolve tendency tones
- SATB comfortable ranges: soprano C4-G5, alto G3-C5, tenor C3-G4, bass E2-C4
- letter must be one of: C D E F G A B
- accidental must be one of: -2 -1 0 1 2`;

const isValidNote = (n: unknown): n is AutocompleteNote => {
  if (!n || typeof n !== 'object') return false;
  const note = n as Record<string, unknown>;
  if (typeof note.voiceId !== 'string') return false;
  if (note.duration !== 'whole') return false;
  if (typeof note.startBeat !== 'number') return false;
  const sp = note.spelledPitch as Record<string, unknown>;
  if (!sp || typeof sp !== 'object') return false;
  if (!['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(sp.letter as string)) return false;
  if (![-2, -1, 0, 1, 2].includes(sp.accidental as number)) return false;
  if (typeof sp.octave !== 'number') return false;
  return true;
};

const tryParse = (text: string, nextStartBeat: number, validVoiceIds: Set<string>): AutocompleteNote[] | null => {
  const raw = text.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 4 || !parsed.every(isValidNote)) return null;
  const notes = (parsed as AutocompleteNote[]).filter(n => validVoiceIds.has(n.voiceId));
  const coveredVoiceIds = new Set(notes.map(n => n.voiceId));
  if (notes.length !== 4 || coveredVoiceIds.size !== validVoiceIds.size) return null;
  return notes.map(n => ({ ...n, startBeat: nextStartBeat }));
};

export async function POST(req: NextRequest) {
  const { composition } = (await req.json()) as { composition: Composition };

  const bpm = beatsPerMeasure(composition);
  const isEmpty = composition.voices.every(v => v.notes.length === 0);

  if (isEmpty) {
    const { keySignature } = composition;
    const tonicMidi = spelledPitchToMidi({ ...keySignature.tonic, octave: 3 });
    const intervals: readonly number[] = keySignature.mode === 'major' ? [0, 4, 7] : [0, 3, 7];
    const suggested = spreadChordAcrossVoices(composition, tonicMidi, 0, 'whole', intervals, keySignature);
    const notes: AutocompleteNote[] = suggested.voices.flatMap(v =>
      v.notes.map(n => ({
        voiceId: v.id,
        spelledPitch: n.spelledPitch,
        startBeat: n.startBeat,
        duration: n.duration,
      }))
    );
    return NextResponse.json({ notes });
  }

  const lastNoteBeat = composition.voices
    .flatMap(v => v.notes)
    .reduce((max, n) => Math.max(max, n.startBeat + DURATION_BEATS[n.duration]), 0);
  const nextStartBeat = Math.ceil(lastNoteBeat / bpm) * bpm;

  const voiceList = composition.voices.map(v => `${v.role}: voiceId="${v.id}"`).join(', ');
  const userMessage = `${compositionToText(composition)}\n\nVoices: ${voiceList}\nNext measure start beat: ${nextStartBeat}`;
  const validVoiceIds = new Set(composition.voices.map(v => v.id));

  const MAX_ATTEMPTS = 2;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') continue;

      const notes = tryParse(textBlock.text, nextStartBeat, validVoiceIds);
      if (notes) return NextResponse.json({ notes });
    } catch (err) {
      if (attempt === MAX_ATTEMPTS - 1) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `API error: ${msg}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: 'Failed after retries' }, { status: 500 });
}
