import type { Note, Song } from '../types/song';

const midiToFreq = (midi: number): number =>
  440 * Math.pow(2, (midi - 69) / 12);

const scheduleNote = (
  ctx: AudioContext,
  note: Note,
  songStartTime: number,
  bps: number
): OscillatorNode => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Layered waveforms for a warmer piano-like tone
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(note.pitch);

  const t0 = songStartTime + note.startBeat / bps;
  const dur = note.durationBeats / bps;
  const amp = (note.velocity / 127) * 0.35;

  // Attack → Decay → Sustain → Release envelope
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(amp, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(amp * 0.35, t0 + 0.09);
  gain.gain.setValueAtTime(amp * 0.35, t0 + Math.max(dur - 0.06, 0.01));
  gain.gain.exponentialRampToValueAtTime(0.00001, t0 + dur + 0.08);

  osc.start(t0);
  osc.stop(t0 + dur + 0.1);

  return osc;
};

export const playSong = (
  ctx: AudioContext,
  song: Song
): (() => void) => {
  const bps = song.bpm / 60;
  const startedAt = ctx.currentTime + 0.05;

  const oscs = song.notes.map(note => scheduleNote(ctx, note, startedAt, bps));

  return () => oscs.forEach(osc => { try { osc.stop(); } catch { /* already stopped */ } });
};
