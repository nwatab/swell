import Replicate from 'replicate';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { prompt } = (await req.json()) as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
  }

  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) {
    return NextResponse.json(
      { error: 'REPLICATE_API_TOKEN environment variable is not set' },
      { status: 500 }
    );
  }

  try {
    const replicate = new Replicate({ auth });
    const output = await replicate.run(
      'meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb',
      {
        input: {
          prompt,
          model_version: 'large',
          output_format: 'mp3',
          normalization_strategy: 'peak',
        },
      }
    );

    // FileOutput — fetch the audio bytes from its URL
    const audioUrl = (output as { url: () => string }).url();
    const audioRes = await fetch(audioUrl);
    const audio = await audioRes.arrayBuffer();

    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="composition.mp3"',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Replicate error: ${msg}` }, { status: 502 });
  }
}
