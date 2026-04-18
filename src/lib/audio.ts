import type { Note, Composition } from '../types/song';
import { DURATION_BEATS, totalBeats } from '../types/song';
import { spelledPitchToMidi } from './harmony';

const midiToFreq = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

const scheduleNote = (
  ctx: AudioContext,
  note: Note,
  startTime: number,
  bps: number,
): OscillatorNode => {
  const midi = spelledPitchToMidi(note.spelledPitch);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(midi);

  const t0 = startTime + note.startBeat / bps;
  const dur = DURATION_BEATS[note.duration] / bps;
  const amp = 0.35;

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(amp, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(amp * 0.35, t0 + 0.09);
  gain.gain.setValueAtTime(amp * 0.35, t0 + Math.max(dur - 0.06, 0.01));
  gain.gain.exponentialRampToValueAtTime(0.00001, t0 + dur + 0.08);

  osc.start(t0);
  osc.stop(t0 + dur + 0.1);

  return osc;
};

export const playComposition = (
  ctx: AudioContext,
  composition: Composition,
): (() => void) => {
  const bps = composition.bpm / 60;
  const startedAt = ctx.currentTime + 0.05;
  const allNotes = composition.voices.flatMap(v => v.notes);
  const oscs = allNotes.map(note => scheduleNote(ctx, note, startedAt, bps));
  return () => oscs.forEach(osc => { try { osc.stop(); } catch { /* already stopped */ } });
};
