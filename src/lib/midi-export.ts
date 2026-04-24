import type { Composition, Voice, NoteDuration, KeySignature, NoteLetter } from '../types/song';
import { spelledPitchToMidi } from './harmony';

const TICKS_PER_BEAT = 480;

const DURATION_TICKS: Record<NoteDuration, number> = {
  whole:   TICKS_PER_BEAT * 4,
  half:    TICKS_PER_BEAT * 2,
  quarter: TICKS_PER_BEAT,
  eighth:  TICKS_PER_BEAT / 2,
};

// Circle-of-fifths position for major key with given natural letter as tonic
const NATURAL_SHARPS: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: -1, G: 1, A: 3, B: 5 };

const VOICE_CHANNEL: Record<string, number> = { soprano: 0, alto: 1, tenor: 2, bass: 3 };

const vlq = (n: number): number[] => {
  const out = [n & 0x7F];
  n >>= 7;
  while (n > 0) {
    out.unshift((n & 0x7F) | 0x80);
    n >>= 7;
  }
  return out;
};

const u16be = (n: number): number[] => [(n >> 8) & 0xFF, n & 0xFF];
const u32be = (n: number): number[] => [(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];

const keySharpCount = ({ tonic, mode }: KeySignature): number => {
  const base = NATURAL_SHARPS[tonic.letter] + tonic.accidental * 7;
  return mode === 'major' ? base : base - 3;
};

const buildTempoTrack = (
  bpm: number,
  timeSignature: { readonly numerator: number; readonly denominator: number },
  keySignature: KeySignature,
): number[] => {
  const uspb = Math.round(60_000_000 / bpm);
  const sf = keySharpCount(keySignature) & 0xFF; // signed → unsigned byte
  const mi = keySignature.mode === 'major' ? 0 : 1;
  const denomLog2 = Math.round(Math.log2(timeSignature.denominator));

  const body = [
    0x00, 0xFF, 0x51, 0x03, (uspb >> 16) & 0xFF, (uspb >> 8) & 0xFF, uspb & 0xFF,
    0x00, 0xFF, 0x58, 0x04, timeSignature.numerator, denomLog2, 24, 8,
    0x00, 0xFF, 0x59, 0x02, sf, mi,
    0x00, 0xFF, 0x2F, 0x00,
  ];
  return [0x4D, 0x54, 0x72, 0x6B, ...u32be(body.length), ...body];
};

const buildVoiceTrack = (voice: Voice, channel: number): number[] => {
  interface Ev { tick: number; data: number[] }
  const evs: Ev[] = [];

  for (const note of voice.notes) {
    const midi  = spelledPitchToMidi(note.spelledPitch);
    const start = Math.round(note.startBeat * TICKS_PER_BEAT);
    const end   = start + DURATION_TICKS[note.duration];
    evs.push({ tick: start, data: [0x90 | channel, midi, 80] });
    evs.push({ tick: end,   data: [0x80 | channel, midi,  0] });
  }

  // Sort by tick; note-off (0x8n) before note-on (0x9n) at same tick
  evs.sort((a, b) => a.tick !== b.tick ? a.tick - b.tick : (a.data[0] & 0xF0) - (b.data[0] & 0xF0));

  const body: number[] = [];
  let cur = 0;
  for (const ev of evs) {
    body.push(...vlq(ev.tick - cur), ...ev.data);
    cur = ev.tick;
  }
  body.push(0x00, 0xFF, 0x2F, 0x00);

  return [0x4D, 0x54, 0x72, 0x6B, ...u32be(body.length), ...body];
};

export const compositionToMidi = (composition: Composition): Uint8Array => {
  const nTracks = 1 + composition.voices.length;
  const header = [
    0x4D, 0x54, 0x68, 0x64, ...u32be(6),
    ...u16be(1), ...u16be(nTracks), ...u16be(TICKS_PER_BEAT),
  ];
  const tempoTrack = buildTempoTrack(composition.bpm, composition.timeSignature, composition.keySignature);
  const voiceTracks = composition.voices.flatMap((v, i) =>
    buildVoiceTrack(v, VOICE_CHANNEL[v.role] ?? i),
  );
  return new Uint8Array([...header, ...tempoTrack, ...voiceTracks]);
};

export const downloadMidi = (composition: Composition): void => {
  const midi = compositionToMidi(composition);
  const blob = new Blob([midi.buffer as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composition.mid';
  a.click();
  URL.revokeObjectURL(url);
};
