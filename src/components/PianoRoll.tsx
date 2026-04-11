'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
const CELL_W = 40;
const CELL_H = 20;
const KEY_W = 64;
const HEADER_H = 32;

const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6

const PITCHES = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MAX_PITCH - i
);

// ── Song state helpers ───────────────────────────────────────────────────────
const addNote = (song: Song, pitch: number, startBeat: number): Song => ({
  ...song,
  notes: [...song.notes, { id: genId(), pitch, startBeat, durationBeats: 1, velocity: 100 }],
});

const removeNote = (song: Song, id: string): Song => ({
  ...song,
  notes: song.notes.filter(n => n.id !== id),
});

// ── Diff helpers ─────────────────────────────────────────────────────────────
type NoteDiff = {
  added: readonly Note[];
  removed: readonly Note[];
  unchanged: readonly Note[];
};

const diffSongs = (current: Song, suggested: Song): NoteDiff => {
  const currentIds = new Set(current.notes.map(n => n.id));
  const suggestedIds = new Set(suggested.notes.map(n => n.id));
  return {
    added: suggested.notes.filter(n => !currentIds.has(n.id)),
    removed: current.notes.filter(n => !suggestedIds.has(n.id)),
    unchanged: current.notes.filter(n => suggestedIds.has(n.id)),
  };
};

// ── Suggestion state ─────────────────────────────────────────────────────────
type SuggestionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; suggestedSong: Song; diff: NoteDiff };

// ── Sub-components ───────────────────────────────────────────────────────────

function PianoKey({ pitch }: { pitch: number }) {
  const black = isBlack(pitch);
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
      {pitch % 12 === 0 ? pitchName(pitch) : ''}
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

function NoteBlock({
  note,
  pitchIndex,
  variant = 'normal',
}: {
  note: Note;
  pitchIndex: number;
  variant?: 'normal' | 'added' | 'removed';
}) {
  const colorClass =
    variant === 'added'
      ? 'bg-emerald-500 border-emerald-300'
      : variant === 'removed'
      ? 'bg-red-500/60 border-red-400 opacity-70'
      : 'bg-blue-500 border-blue-300';

  return (
    <div
      className={`absolute rounded-sm border pointer-events-none ${colorClass}`}
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

// ── Agent input bar ──────────────────────────────────────────────────────────

function AgentBar({
  suggestion,
  onSubmit,
  onAccept,
  onReject,
}: {
  suggestion: SuggestionState;
  onSubmit: (instruction: string) => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || suggestion.status === 'loading') return;
    onSubmit(text.trim());
    setText('');
  };

  // Keyboard shortcut: Enter to accept, Escape to reject when suggestion is ready
  useEffect(() => {
    if (suggestion.status !== 'ready') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT') {
        onAccept();
      }
      if (e.key === 'Escape') onReject();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [suggestion.status, onAccept, onReject]);

  return (
    <div className="flex-shrink-0 border-t border-zinc-700 bg-zinc-900">
      {/* Diff legend when suggestion is ready */}
      {suggestion.status === 'ready' && (
        <div className="flex items-center gap-6 px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-xs">
          <span className="text-zinc-400">Review suggestion:</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
            Added {suggestion.diff.added.length}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500/60" />
            Removed {suggestion.diff.removed.length}
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onAccept}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Accept (Enter)
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1 rounded bg-zinc-600 hover:bg-zinc-500 text-white transition-colors"
            >
              Reject (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              suggestion.status === 'loading'
                ? 'Claude is thinking…'
                : 'Enter instructions (e.g. Add a melody in C major, create a I-IV-V-I chord progression)'
            }
            disabled={suggestion.status === 'loading'}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 disabled:opacity-50"
          />
          {suggestion.status === 'loading' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs animate-pulse">
              ●●●
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={suggestion.status === 'loading' || !text.trim()}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm text-white transition-colors flex-shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PianoRoll() {
  const [song, setSong] = useState<Song>(DEFAULT_SONG);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });

  const activeSong = suggestion.status === 'ready' ? suggestion.suggestedSong : song;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stopOscillatorsRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number>(0);
  const playStartWallRef = useRef<number>(0);

  const getCtx = (): AudioContext => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopOscillatorsRef.current?.();
    stopOscillatorsRef.current = null;
    setPlaying(false);
    setPlayhead(0);
  }, []);

  const startPlayback = useCallback(() => {
    const ctx = getCtx();
    const bps = activeSong.bpm / 60;
    stopOscillatorsRef.current = playSong(ctx, activeSong);
    playStartWallRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const elapsed = (performance.now() - playStartWallRef.current) / 1000;
      const beat = elapsed * bps;
      if (beat >= activeSong.totalBeats) { stopPlayback(); return; }
      setPlayhead(beat);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [activeSong, stopPlayback]);

  const togglePlay = useCallback(() => {
    if (playing) stopPlayback(); else startPlayback();
  }, [playing, startPlayback, stopPlayback]);

  const handleBpmChange = useCallback((bpm: number) => {
    setSong(s => ({ ...s, bpm }));
  }, []);

  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suggestion.status === 'ready') return; // lock grid while reviewing
      const rect = e.currentTarget.getBoundingClientRect();
      const beat = Math.floor((e.clientX - rect.left) / CELL_W);
      const pitchIndex = Math.floor((e.clientY - rect.top) / CELL_H);
      const pitch = PITCHES[pitchIndex];
      if (pitch === undefined || beat < 0 || beat >= song.totalBeats) return;
      const hit = song.notes.find(
        n => n.pitch === pitch && beat >= n.startBeat && beat < n.startBeat + n.durationBeats
      );
      setSong(s => (hit ? removeNote(s, hit.id) : addNote(s, pitch, beat)));
    },
    [song.notes, song.totalBeats, suggestion.status]
  );

  // ── Agent suggestion ───────────────────────────────────────────────────────
  const handleAgentSubmit = useCallback(async (instruction: string) => {
    setSuggestion({ status: 'loading' });
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'API error');
      const suggestedSong: Song = data.suggestedSong;
      setSuggestion({
        status: 'ready',
        suggestedSong,
        diff: diffSongs(song, suggestedSong),
      });
    } catch (err) {
      console.error(err);
      setSuggestion({ status: 'idle' });
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [song]);

  const handleAccept = useCallback(() => {
    if (suggestion.status !== 'ready') return;
    setSong(suggestion.suggestedSong);
    setSuggestion({ status: 'idle' });
  }, [suggestion]);

  const handleReject = useCallback(() => {
    setSuggestion({ status: 'idle' });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const gridWidth = song.totalBeats * CELL_W;
  const gridHeight = PITCHES.length * CELL_H;

  // Which notes to show: base + diff overlay
  const displayNotes: { note: Note; variant: 'normal' | 'added' | 'removed' }[] =
    suggestion.status === 'ready'
      ? [
          ...suggestion.diff.unchanged.map(note => ({ note, variant: 'normal' as const })),
          ...suggestion.diff.removed.map(note => ({ note, variant: 'removed' as const })),
          ...suggestion.diff.added.map(note => ({ note, variant: 'added' as const })),
        ]
      : song.notes.map(note => ({ note, variant: 'normal' as const }));

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
        {/* Piano keyboard */}
        <div
          className="flex-shrink-0 overflow-y-auto overflow-x-hidden border-r border-zinc-700"
          style={{ width: KEY_W }}
        >
          <div style={{ height: HEADER_H }} className="bg-zinc-800 border-b border-zinc-600" />
          {PITCHES.map(pitch => (
            <PianoKey key={pitch} pitch={pitch} />
          ))}
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-auto">
          <BeatHeader totalBeats={song.totalBeats} beatsPerMeasure={song.beatsPerMeasure} />

          <div
            className={[
              'relative',
              suggestion.status === 'ready' ? 'cursor-not-allowed' : 'cursor-crosshair',
            ].join(' ')}
            style={{ width: gridWidth, height: gridHeight }}
            onDoubleClick={handleGridDoubleClick}
          >
            {/* Row backgrounds */}
            {PITCHES.map((pitch, idx) => (
              <div
                key={pitch}
                className={[
                  'absolute w-full border-b',
                  isBlack(pitch) ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-700/50',
                ].join(' ')}
                style={{ top: idx * CELL_H, height: CELL_H }}
              />
            ))}

            {/* Vertical beat lines */}
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

            {/* Notes (with diff overlay) */}
            {displayNotes.map(({ note, variant }) => {
              const pitchIndex = PITCHES.indexOf(note.pitch);
              if (pitchIndex === -1) return null;
              return (
                <NoteBlock key={`${note.id}-${variant}`} note={note} pitchIndex={pitchIndex} variant={variant} />
              );
            })}

            {/* Playhead */}
            {playing && <Playhead beat={playhead} />}
          </div>
        </div>
      </div>

      {/* Agent input + suggestion review */}
      <AgentBar
        suggestion={suggestion}
        onSubmit={handleAgentSubmit}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </div>
  );
}
