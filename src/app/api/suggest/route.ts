import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Composition } from '../../../types/song';
import { beatsPerMeasure } from '../../../types/song';
import { analyzeHarmony } from '../../../lib/harmony';
import type { Diagnostic } from '../../../lib/harmony';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a music composition assistant for a piano roll editor.
The user will describe a change they want to make to their composition, and you must output ONLY a valid JSON object — nothing else.

You have access to a tool: get_harmonic_problems
- Call it when the user asks to fix, improve, or review harmonic issues (parallel 5ths, voice crossing, etc.)
- Do NOT call it for transposition, tempo, or structural edits — proceed directly

The composition format:
{
  "id": string,
  "keySignature": { "tonic": { "letter": "C"|...|"B", "accidental": -1|0|1 }, "mode": "major"|"minor" },
  "timeSignature": { "numerator": number, "denominator": number },
  "bpm": number,
  "measureCount": number,
  "voices": [
    {
      "id": string,
      "role": "soprano"|"alto"|"tenor"|"bass",
      "notes": [
        {
          "id": string,
          "spelledPitch": { "letter": "C"|"D"|"E"|"F"|"G"|"A"|"B", "accidental": -2|-1|0|1|2, "octave": number },
          "startBeat": number,
          "duration": "whole"|"half"|"quarter"|"eighth"
        }
      ]
    }
  ],
  "measures": [ { "measureIndex": number, "root": { "letter": ..., "accidental": ... }, "quality": string } ]
}

Rules:
- Preserve existing ids when keeping notes unchanged
- Generate new short unique ids (e.g. "n1", "n2") for new notes
- Only output the modified JSON — no explanations, no markdown fences, no comments
- Keep all existing notes unless the user explicitly asks to remove some
- Do NOT change timeSignature or measureCount unless explicitly asked`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_harmonic_problems',
    description: `Returns current harmonic diagnostics (parallel fifths, parallel octaves, voice crossing, range violations, etc.) for the composition or a specific measure range.
Call this when the user asks to fix, improve, or review harmonic issues.
Do NOT call this for transposition, tempo, or structural edits.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        measureRange: {
          type: 'array',
          items: { type: 'integer' },
          minItems: 2,
          maxItems: 2,
          description: '[start, end] measure numbers (1-based, inclusive). Omit for full score.',
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'info', 'all'],
          description: 'Filter by severity. Default: all.',
        },
      },
    },
  },
];

type GetHarmonicProblemsInput = {
  measureRange?: [number, number];
  severity?: 'error' | 'warning' | 'info' | 'all';
};

const executeGetHarmonicProblems = (
  composition: Composition,
  input: GetHarmonicProblemsInput,
): string => {
  const bpm = beatsPerMeasure(composition);
  let diags: readonly Diagnostic[] = analyzeHarmony(composition);

  if (input.measureRange) {
    const [startMeasure, endMeasure] = input.measureRange;
    const startBeat = (startMeasure - 1) * bpm;
    const endBeat = endMeasure * bpm;
    diags = diags.filter(d => d.beat >= startBeat && d.beat < endBeat);
  }

  const severity = input.severity ?? 'all';
  if (severity !== 'all') {
    diags = diags.filter(d => d.severity === severity);
  }

  if (diags.length === 0) {
    const scope = input.measureRange
      ? ` in measures ${input.measureRange[0]}–${input.measureRange[1]}`
      : '';
    return `No harmonic problems found${scope}.`;
  }

  return diags
    .map(d =>
      `[${d.severity.toUpperCase()}] ${d.type} at beat ${d.beat + 1}: ${d.message} (noteIds: ${d.noteIds.join(', ')})`,
    )
    .join('\n');
};

export async function POST(req: NextRequest) {
  const { composition, instruction } = (await req.json()) as {
    composition: Composition;
    instruction: string;
  };

  if (!instruction?.trim()) {
    return NextResponse.json({ error: 'No instruction provided' }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Current composition:\n${JSON.stringify(composition, null, 2)}\n\nInstruction: ${instruction}`,
    },
  ];

  try {
    for (let turn = 0; turn < 5; turn++) {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
          return NextResponse.json({ error: 'No response from model' }, { status: 500 });
        }
        const raw = textBlock.text.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();
        try {
          const suggestedComposition: Composition = JSON.parse(raw);
          return NextResponse.json({ suggestedComposition });
        } catch {
          return NextResponse.json(
            { error: 'Model returned invalid JSON', raw: textBlock.text },
            { status: 500 },
          );
        }
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          .map(toolUse => {
            if (toolUse.name === 'get_harmonic_problems') {
              const result = executeGetHarmonicProblems(
                composition,
                toolUse.input as GetHarmonicProblemsInput,
              );
              return { type: 'tool_result' as const, tool_use_id: toolUse.id, content: result };
            }
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: `Unknown tool: ${toolUse.name}`,
            };
          });

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      break; // unexpected stop_reason (e.g. 'max_tokens')
    }

    return NextResponse.json({ error: 'Agent loop did not terminate' }, { status: 500 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `API error: ${msg}` }, { status: 502 });
  }
}
