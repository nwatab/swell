'use client';

import { useState, useCallback, useRef } from 'react';
import { playSong } from '../lib/audio';
import type { Note, Song } from '../types/song';
import { DEFAULT_SONG } from '../types/song';

// ── Piano constants ─────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

const isBlack = (pitch: number) => BLACK_SEMITONES.has(pitch % 12);
const pitchName = (pitch: number) =>
  `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const genId = () => Math.random().toString(36).slice(2, 9);

// ── Layout constants ─────────────────────────────────────────────────────────
const CELL_W = 40;    // px per beat
const CELL_H = 20;    // px per pitch row
const KEY_W = 64;     // piano keyboard width
const HEADER_H = 32;  // beat header height

const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6

// Pitches array: high pitch at top → low at bottom (GarageBand style)
const PITCHES = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MAX_PITCH - i
);

// ── Song state helpers ───────────────────────────────────────────────────────
const addNote = (song: Song, pitch: number, startBeat: number): Song => ({
  ...song,
  notes: [
    ...song.notes,
    { id: genId(), pitch, startBeat, durationBeats: 1, velocity: 100 },
  ],
});

const removeNote = (song: Song, id: string): Song => ({
  ...song,
  notes: song.notes.filter(n => n.id !== id),
});

// ── Sub-components ───────────────────────────────────────────────────────────

function PianoKey({ pitch }: { pitch: number }) {
  const black = isBlack(pitch);
  const showLabel = pitch % 12 === 0; // show C notes only
  return (
    <div
      style={{ height: CELL_H }}
      className={[
        'flex items-center justify-end pr-1 text-[10px] border-b select-none',
        black
          ? 'bg-zinc-800 text-zinc-500 border-zinc-700'
          : 'bg-zinc-100 text-zinc-500 border-zinc-300',
      ].join(' ')}
    >
      {showLabel ? pitchName(pitch) : ''}
    </div>
  );
}

function BeatHeader({ totalBeats, beatsPerMeasure }: { totalBeats: number; beatsPerMeasure: number }) {
  return (
    <div
      className="flex bg-zinc-800 border-b border-zinc-600 sticky top-0 z-10"
      style={{ height: HEADER_H, width: totalBeats * CELL_W }}
    >
      {Array.from({ length: totalBeats }, (_, i) => (
        <div
          key={i}
          style={{ width: CELL_W, flexShrink: 0 }}
          className={[
            'flex items-center justify-start pl-1 text-[10px] border-r border-zinc-700',
            i % beatsPerMeasure === 0 ? 'text-zinc-300' : 'text-zinc-600',
          ].join(' ')}
        >
          {i % beatsPerMeasure === 0 ? String(Math.floor(i / beatsPerMeasure) + 1) : ''}
        </div>
      ))}
    </div>
  );
}

function NoteBlock({ note, pitchIndex }: { note: Note; pitchIndex: number }) {
  return (
    <div
      className="absolute rounded-sm bg-blue-500 border border-blue-300 pointer-events-none"
      style={{
        left: note.startBeat * CELL_W + 1,
        top: pitchIndex * CELL_H + 2,
        width: note.durationBeats * CELL_W - 2,
        height: CELL_H - 4,
      }}
    />
  );
}

function Playhead({ beat }: { beat: number }) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
      style={{ left: beat * CELL_W }}
    />
  );
}

// ── Transport bar ────────────────────────────────────────────────────────────

function TransportBar({
  playing,
  beat,
  bpm,
  onTogglePlay,
  onBpmChange,
}: {
  playing: boolean;
  beat: number;
  bpm: number;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
}) {
  const measure = Math.floor(beat / 4) + 1;
  const beatInMeasure = Math.floor(beat % 4) + 1;

  return (
    <div className="flex items-center gap-4 px-4 bg-zinc-900 border-b border-zinc-700 h-12 flex-shrink-0">
      <button
        onClick={onTogglePlay}
        className="w-10 h-8 rounded bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-lg transition-colors"
        aria-label={playing ? 'Stop' : 'Play'}
      >
        {playing ? '⏹' : '▶'}
      </button>

      <div className="font-mono text-sm text-zinc-300 w-16">
        {measure}.{beatInMeasure}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        BPM
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={e => onBpmChange(Number(e.target.value))}
          className="w-16 bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 text-sm"
        />
      </label>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PianoRoll() {
  const [song, setSong] = useState<Song>(DEFAULT_SONG);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const playStartWallRef = useRef<number>(0); // performance.now() at play start
  const bpsRef = useRef<number>(song.bpm / 60);

  const getCtx = (): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setPlayhead(0);
  }, []);

  const startPlayback = useCallback(() => {
    const ctx = getCtx();
    const currentSong = song; // capture for closure
    const bps = currentSong.bpm / 60;
    bpsRef.current = bps;

    playSong(ctx, currentSong);

    playStartWallRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const elapsed = (performance.now() - playStartWallRef.current) / 1000;
      const beat = elapsed * bps;

      if (beat >= currentSong.totalBeats) {
        stopPlayback();
        return;
      }

      setPlayhead(beat);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [song, stopPlayback]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlayback();
    else startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  const handleBpmChange = useCallback((bpm: number) => {
    setSong(s => ({ ...s, bpm }));
  }, []);

  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const beat = Math.floor(x / CELL_W);
      const pitchIndex = Math.floor(y / CELL_H);
      const pitch = PITCHES[pitchIndex];

      if (pitch === undefined || beat < 0 || beat >= song.totalBeats) return;

      const hit = song.notes.find(
        n => n.pitch === pitch && beat >= n.startBeat && beat < n.startBeat + n.durationBeats
      );

      setSong(s => (hit ? removeNote(s, hit.id) : addNote(s, pitch, beat)));
    },
    [song.notes, song.totalBeats]
  );

  const gridWidth = song.totalBeats * CELL_W;
  const gridHeight = PITCHES.length * CELL_H;

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-white overflow-hidden">
      <TransportBar
        playing={playing}
        beat={playhead}
        bpm={song.bpm}
        onTogglePlay={togglePlay}
        onBpmChange={handleBpmChange}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Piano keyboard column */}
        <div
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden border-r border-zinc-700"
          style={{ width: KEY_W }}
        >
          {/* Spacer matching beat header height */}
          <div style={{ height: HEADER_H }} className="bg-zinc-800 border-b border-zinc-600" />
          {PITCHES.map(pitch => (
            <PianoKey key={pitch} pitch={pitch} />
          ))}
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-auto" id="grid-scroll">
          <BeatHeader
            totalBeats={song.totalBeats}
            beatsPerMeasure={song.beatsPerMeasure}
          />

          {/* Grid body */}
          <div
            className="relative cursor-crosshair"
            style={{ width: gridWidth, height: gridHeight }}
            onDoubleClick={handleGridDoubleClick}
          >
            {/* Row backgrounds */}
            {PITCHES.map((pitch, idx) => (
              <div
                key={pitch}
                className={[
                  'absolute w-full border-b',
                  isBlack(pitch)
                    ? 'bg-zinc-800 border-zinc-700'
                    : 'bg-zinc-900 border-zinc-700/50',
                ].join(' ')}
                style={{ top: idx * CELL_H, height: CELL_H }}
              />
            ))}

            {/* Vertical beat/measure lines */}
            {Array.from({ length: song.totalBeats + 1 }, (_, i) => (
              <div
                key={i}
                className={[
                  'absolute top-0 w-px',
                  i % song.beatsPerMeasure === 0 ? 'bg-zinc-600' : 'bg-zinc-700/60',
                ].join(' ')}
                style={{ left: i * CELL_W, height: gridHeight }}
              />
            ))}

            {/* Notes */}
            {song.notes.map(note => {
              const pitchIndex = PITCHES.indexOf(note.pitch);
              if (pitchIndex === -1) return null;
              return <NoteBlock key={note.id} note={note} pitchIndex={pitchIndex} />;
            })}

            {/* Playhead */}
            {playing && <Playhead beat={playhead} />}
          </div>
        </div>
      </div>
    </div>
  );
}
