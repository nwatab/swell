import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Composition } from '../../../types/song';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a music composition assistant for a piano roll editor.
The user will describe a change they want to make to their composition, and you must output ONLY a valid JSON object — nothing else.

The composition uses this format:
{
  "id": string,
  "version": "2.0",
  "bpm": number,
  "beatsPerMeasure": number (usually 4),
  "totalBeats": number,
  "globalKey": { "root": "C"|"C#"|"D"|...|"B", "mode": "major"|"minor" } (optional),
  "modulations": [ { "beat": number, "key": { "root": ..., "mode": ... } } ] (optional),
  "parts": [ { "id": string, "name": string, "color": string, "voice": string (optional) } ] (optional),
  "notes": [
    {
      "id": string,
      "pitch": number,        // MIDI (required)
      "startBeat": number,
      "durationBeats": number,
      "velocity": number,
      "spelledPitch": { "letter": "C"|"D"|"E"|"F"|"G"|"A"|"B", "accidental": -1|0|1, "octave": number } (optional),
      "partId": string (optional)
    }
  ]
}

MIDI pitch reference (standard):
- Middle C = 60 (C4), D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
- C5=72, C3=48, C2=36
- Sharp keys: C#4=61, D#4=63, F#4=66, G#4=68, A#4=70

Common chords (C major scale):
- C major: 60, 64, 67
- G major: 67, 71, 74
- Am: 57, 60, 64
- F major: 65, 69, 72
- Dm: 62, 65, 69
- Em: 64, 67, 71

Rules:
- Preserve existing note ids when keeping them unchanged
- Generate new short unique ids (e.g. "n1", "n2") for new notes
- Only output the modified JSON — no explanations, no markdown fences, no comments
- Keep all existing notes unless the user explicitly asks to remove some
- Do NOT change version, beatsPerMeasure unless explicitly asked`;

export async function POST(req: NextRequest) {
  const { composition, instruction } = (await req.json()) as {
    composition: Composition;
    instruction: string;
  };

  if (!instruction?.trim()) {
    return NextResponse.json({ error: 'No instruction provided' }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current composition state:\n${JSON.stringify(composition, null, 2)}\n\nInstruction: ${instruction}`,
        },
      ],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 });
    }

    // Strip any accidental markdown fences
    const raw = textBlock.text.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();

    try {
      const suggestedComposition: Composition = JSON.parse(raw);
      return NextResponse.json({ suggestedComposition });
    } catch {
      return NextResponse.json(
        { error: 'Model returned invalid JSON', raw: textBlock.text },
        { status: 500 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `API error: ${msg}` }, { status: 502 });
  }
}
