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
const DEFAULT_CELL_W = 40;
const ZOOM_STEPS = [20, 40, 80, 160] as const;
const CELL_H = 20;
const KEY_W = 64;
const HEADER_H = 32;

const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6

const PITCHES = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MAX_PITCH - i
);

// ── Import / export helpers ──────────────────────────────────────────────────
const parseSwell = (text: string): Song => {
  const d = JSON.parse(text);
  if (d.version !== '1.0') throw new Error(`Unsupported version: ${d.version}`);
  if (typeof d.bpm !== 'number' || typeof d.beatsPerMeasure !== 'number' || typeof d.totalBeats !== 'number')
    throw new Error('Invalid song format');
  if (!Array.isArray(d.notes)) throw new Error('Invalid notes');
  return d as Song;
};

const downloadSwell = (song: Song) => {
  const blob = new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'composition.swell';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Snap helpers ─────────────────────────────────────────────────────────────
type SnapDiv = '1/4' | '1/8' | '1/16';

const toResolution = (div: SnapDiv, triplet: boolean): number => {
  const base = div === '1/4' ? 1 : div === '1/8' ? 0.5 : 0.25;
  return triplet ? (base * 2) / 3 : base;
};

const snapBeat = (rawBeat: number, resolution: number): number =>
  Math.round(rawBeat / resolution) * resolution;

// ── Chord helpers ─────────────────────────────────────────────────────────────
type ChordType = 'note' | 'maj' | 'min' | 'maj7' | 'min7';

const CHORD_INTERVALS: Record<ChordType, readonly number[]> = {
  note: [0],
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
};

const CHORD_LABELS: Record<ChordType, string> = {
  note: '—',
  maj:  'Maj',
  min:  'Min',
  maj7: 'Maj7',
  min7: 'Min7',
};

// ── Song state helpers ───────────────────────────────────────────────────────
const addNote = (song: Song, pitch: number, startBeat: number, durationBeats = 1): Song => ({
  ...song,
  notes: [...song.notes, { id: genId(), pitch, startBeat, durationBeats, velocity: 100 }],
});

const addChord = (
  song: Song,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
): Song => ({
  ...song,
  notes: [
    ...song.notes,
    ...intervals.map(interval => ({
      id: genId(),
      pitch: rootPitch + interval,
      startBeat,
      durationBeats,
      velocity: 100,
    })),
  ],
});

const removeNote = (song: Song, id: string): Song => ({
  ...song,
  notes: song.notes.filter(n => n.id !== id),
});

const moveNote = (song: Song, id: string, startBeat: number, pitch: number): Song => ({
  ...song,
  notes: song.notes.map(n => n.id === id ? { ...n, startBeat, pitch } : n),
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

// ── Drag state ───────────────────────────────────────────────────────────────
type DragState = {
  noteId: string;
  originalBeat: number;
  originalPitch: number;
  beatOffset: number; // click position within note
  previewBeat: number;
  previewPitch: number;
  hasMoved: boolean;
};

// ── MusicGen state ───────────────────────────────────────────────────────────
type MusicGenState =
  | { status: 'hidden' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string };

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

function BeatHeader({ totalBeats, beatsPerMeasure, cellW }: { totalBeats: number; beatsPerMeasure: number; cellW: number }) {
  return (
    <div
      className="flex bg-zinc-800 border-b border-zinc-600 sticky top-0 z-10"
      style={{ height: HEADER_H, width: totalBeats * cellW }}
    >
      {Array.from({ length: totalBeats }, (_, i) => (
        <div
          key={i}
          style={{ width: cellW, flexShrink: 0 }}
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
  cellW,
  variant = 'normal',
}: {
  note: Note;
  pitchIndex: number;
  cellW: number;
  variant?: 'normal' | 'added' | 'removed' | 'dragging';
}) {
  const colorClass =
    variant === 'added'
      ? 'bg-emerald-500 border-emerald-300'
      : variant === 'removed'
      ? 'bg-red-500/60 border-red-400 opacity-70'
      : variant === 'dragging'
      ? 'bg-blue-400 border-blue-200 opacity-80'
      : 'bg-blue-500 border-blue-300';

  return (
    <div
      className={`absolute rounded-sm border pointer-events-none ${colorClass}`}
      style={{
        left: note.startBeat * cellW + 1,
        top: pitchIndex * CELL_H + 2,
        width: note.durationBeats * cellW - 2,
        height: CELL_H - 4,
      }}
    />
  );
}

function Playhead({ beat, cellW }: { beat: number; cellW: number }) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
      style={{ left: beat * cellW }}
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
  onMusicGenToggle,
  musicGenActive,
  onExport,
  onImport,
  snapDiv,
  triplet,
  onSnapDivChange,
  onTripletToggle,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  chordType,
  onChordTypeChange,
}: {
  playing: boolean;
  beat: number;
  bpm: number;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onMusicGenToggle: () => void;
  musicGenActive: boolean;
  onExport: () => void;
  onImport: (song: Song) => void;
  snapDiv: SnapDiv;
  triplet: boolean;
  onSnapDivChange: (div: SnapDiv) => void;
  onTripletToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  chordType: ChordType;
  onChordTypeChange: (ct: ChordType) => void;
}) {
  const measure = Math.floor(beat / 4) + 1;
  const beatInMeasure = Math.floor(beat % 4) + 1;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(parseSwell(reader.result as string));
      } catch (err) {
        alert(`Failed to open file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
      <div className="flex gap-1">
        <button
          onClick={onExport}
          className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors"
        >
          Open
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".swell,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <div className="flex items-center gap-1">
        {(['1/4', '1/8', '1/16'] as const).map(div => (
          <button
            key={div}
            onClick={() => onSnapDivChange(div)}
            className={[
              'px-2 py-1 rounded text-xs transition-colors font-mono',
              snapDiv === div
                ? 'bg-zinc-500 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
            ].join(' ')}
          >
            {div}
          </button>
        ))}
        <button
          onClick={onTripletToggle}
          className={[
            'px-2 py-1 rounded text-xs transition-colors font-mono',
            triplet ? 'bg-zinc-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
          ].join(' ')}
          title="Triplet"
        >
          T
        </button>
      </div>
      <div className="flex items-center gap-1">
        {(Object.keys(CHORD_LABELS) as ChordType[]).map(ct => (
          <button
            key={ct}
            onClick={() => onChordTypeChange(ct)}
            className={[
              'px-2 py-1 rounded text-xs transition-colors font-mono',
              chordType === ct
                ? 'bg-amber-600 text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
            ].join(' ')}
          >
            {CHORD_LABELS[ct]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          disabled={!canZoomOut}
          className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 text-sm transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <button
          onClick={onZoomIn}
          disabled={!canZoomIn}
          className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 text-sm transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
      <div className="ml-auto">
        <button
          onClick={onMusicGenToggle}
          className={[
            'px-3 py-1 rounded text-sm transition-colors',
            musicGenActive
              ? 'bg-purple-700 hover:bg-purple-600 text-purple-100'
              : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300',
          ].join(' ')}
        >
          ♫ Generate Audio
        </button>
      </div>
    </div>
  );
}

// ── MusicGen bar ─────────────────────────────────────────────────────────────

function MusicGenBar({
  state,
  onGenerate,
  onClose,
}: {
  state: MusicGenState;
  onGenerate: (prompt: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const isLoading = state.status === 'loading';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt.trim());
  };

  return (
    <div className="flex-shrink-0 border-b border-zinc-700 bg-zinc-850">
      {state.status === 'error' && (
        <div className="px-4 py-1 bg-red-900/40 text-red-400 text-xs border-b border-zinc-700">
          {state.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs text-purple-400 flex-shrink-0 font-medium">MusicGen</span>
        <div className="relative flex-1">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. calm ambient piano with soft reverb"
            disabled={isLoading}
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          {isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs animate-pulse">
              ●●●
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm text-white transition-colors flex-shrink-0"
        >
          Generate
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-400 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          ✕
        </button>
      </form>
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
  const [musicGen, setMusicGen] = useState<MusicGenState>({ status: 'hidden' });

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

  const handleExport = useCallback(() => downloadSwell(song), [song]);
  const handleImport = useCallback((imported: Song) => setSong(imported), []);

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const [cellW, setCellW] = useState(DEFAULT_CELL_W);
  const cellWRef = useRef(cellW);
  cellWRef.current = cellW;
  const zoomIdx = ZOOM_STEPS.indexOf(cellW as typeof ZOOM_STEPS[number]);
  const zoomIn  = useCallback(() => setCellW(ZOOM_STEPS[Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1)]), [zoomIdx]);
  const zoomOut = useCallback(() => setCellW(ZOOM_STEPS[Math.max(zoomIdx - 1, 0)]), [zoomIdx]);

  // ── Chord mode ────────────────────────────────────────────────────────────
  const [chordType, setChordType] = useState<ChordType>('note');

  // ── Snap resolution ────────────────────────────────────────────────────────
  const [snapDiv, setSnapDiv] = useState<SnapDiv>('1/4');
  const [triplet, setTriplet] = useState(false);
  const resolution = toResolution(snapDiv, triplet);
  const resolutionRef = useRef(resolution);
  resolutionRef.current = resolution;

  // ── Drag-to-move / click-to-add / click-to-delete ─────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const songRef = useRef<Song>(song);
  songRef.current = song;
  const gridRef = useRef<HTMLDivElement>(null);

  // Window-level move/up handlers so drag works even outside the grid
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawBeat = (e.clientX - rect.left) / cellWRef.current;
      const pitchIndex = Math.floor((e.clientY - rect.top) / CELL_H);
      const pitch = PITCHES[pitchIndex];
      if (pitch === undefined) return;
      const s = songRef.current;
      const res = resolutionRef.current;
      const newBeat = Math.max(0, Math.min(s.totalBeats - 1, snapBeat(rawBeat - d.beatOffset, res)));
      const hasMoved = newBeat !== d.originalBeat || pitch !== d.originalPitch;
      setDrag({ ...d, previewBeat: newBeat, previewPitch: pitch, hasMoved });
    };

    const handleMouseUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved) {
        setSong(s => moveNote(s, d.noteId, d.previewBeat, d.previewPitch));
      } else {
        setSong(s => removeNote(s, d.noteId));
      }
      setDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // stable — reads latest state via refs

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suggestion.status === 'ready') return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const rawBeat = (e.clientX - rect.left) / cellW;
      const pitchIndex = Math.floor((e.clientY - rect.top) / CELL_H);
      const pitch = PITCHES[pitchIndex];
      if (pitch === undefined || rawBeat < 0 || rawBeat >= song.totalBeats) return;
      // Hit-test uses raw position for accuracy
      const hit = song.notes.find(
        n => n.pitch === pitch && rawBeat >= n.startBeat && rawBeat < n.startBeat + n.durationBeats
      );
      if (hit) {
        setDrag({
          noteId: hit.id,
          originalBeat: hit.startBeat,
          originalPitch: hit.pitch,
          beatOffset: rawBeat - hit.startBeat,
          previewBeat: hit.startBeat,
          previewPitch: hit.pitch,
          hasMoved: false,
        });
      } else {
        const snapped = Math.max(0, Math.min(song.totalBeats - resolution, snapBeat(rawBeat, resolution)));
        setSong(s => addChord(s, pitch, snapped, resolution, CHORD_INTERVALS[chordType]));
      }
    },
    [song.notes, song.totalBeats, suggestion.status, resolution, cellW, chordType]
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

  // ── MusicGen ───────────────────────────────────────────────────────────────
  const handleMusicGenToggle = useCallback(() => {
    setMusicGen(s => s.status === 'hidden' ? { status: 'idle' } : { status: 'hidden' });
  }, []);

  const handleMusicGen = useCallback(async (prompt: string) => {
    setMusicGen({ status: 'loading' });
    try {
      const res = await fetch('/api/musicgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMusicGen({ status: 'error', message: data.error ?? 'API error' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'composition.mp3';
      a.click();
      URL.revokeObjectURL(url);
      setMusicGen({ status: 'idle' });
    } catch (err) {
      setMusicGen({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const gridWidth = song.totalBeats * cellW;
  const gridHeight = PITCHES.length * CELL_H;

  // Which notes to show: base + diff overlay + drag preview
  const baseNotes: { note: Note; variant: 'normal' | 'added' | 'removed' | 'dragging' }[] =
    suggestion.status === 'ready'
      ? [
          ...suggestion.diff.unchanged.map(note => ({ note, variant: 'normal' as const })),
          ...suggestion.diff.removed.map(note => ({ note, variant: 'removed' as const })),
          ...suggestion.diff.added.map(note => ({ note, variant: 'added' as const })),
        ]
      : song.notes.map(note => ({ note, variant: 'normal' as const }));

  const displayNotes = drag
    ? [
        ...baseNotes.filter(({ note }) => note.id !== drag.noteId),
        {
          note: { ...song.notes.find(n => n.id === drag.noteId)!, startBeat: drag.previewBeat, pitch: drag.previewPitch },
          variant: 'dragging' as const,
        },
      ]
    : baseNotes;

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-white overflow-hidden">
      <TransportBar
        playing={playing}
        beat={playhead}
        bpm={song.bpm}
        onTogglePlay={togglePlay}
        onBpmChange={handleBpmChange}
        onMusicGenToggle={handleMusicGenToggle}
        musicGenActive={musicGen.status !== 'hidden'}
        onExport={handleExport}
        onImport={handleImport}
        snapDiv={snapDiv}
        triplet={triplet}
        onSnapDivChange={setSnapDiv}
        onTripletToggle={() => setTriplet(t => !t)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        canZoomIn={zoomIdx < ZOOM_STEPS.length - 1}
        canZoomOut={zoomIdx > 0}
        chordType={chordType}
        onChordTypeChange={setChordType}
      />
      {musicGen.status !== 'hidden' && (
        <MusicGenBar
          state={musicGen}
          onGenerate={handleMusicGen}
          onClose={() => setMusicGen({ status: 'hidden' })}
        />
      )}

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
          <BeatHeader totalBeats={song.totalBeats} beatsPerMeasure={song.beatsPerMeasure} cellW={cellW} />

          <div
            ref={gridRef}
            className={[
              'relative',
              suggestion.status === 'ready' ? 'cursor-not-allowed' : drag ? 'cursor-grabbing' : 'cursor-crosshair',
            ].join(' ')}
            style={{ width: gridWidth, height: gridHeight }}
            onMouseDown={handleGridMouseDown}
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

            {/* Vertical grid lines */}
            {Array.from({ length: Math.round(song.totalBeats / resolution) + 1 }, (_, i) => {
              const beat = i * resolution;
              const isMeasure = beat % song.beatsPerMeasure < 1e-6;
              const isBeat = beat % 1 < 1e-6;
              return (
                <div
                  key={i}
                  className={[
                    'absolute top-0 w-px',
                    isMeasure ? 'bg-zinc-600' : isBeat ? 'bg-zinc-700/60' : 'bg-zinc-700/30',
                  ].join(' ')}
                  style={{ left: beat * cellW, height: gridHeight }}
                />
              );
            })}

            {/* Notes (with diff overlay) */}
            {displayNotes.map(({ note, variant }) => {
              const pitchIndex = PITCHES.indexOf(note.pitch);
              if (pitchIndex === -1) return null;
              return (
                <NoteBlock key={`${note.id}-${variant}`} note={note} pitchIndex={pitchIndex} cellW={cellW} variant={variant} />
              );
            })}

            {/* Playhead */}
            {playing && <Playhead beat={playhead} cellW={cellW} />}
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
