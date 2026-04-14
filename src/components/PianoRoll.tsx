'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { playSong } from '../lib/audio';
import type { Note, Song, Stream } from '../types/song';
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
const WHITE_H = 28;   // px per white-key row
const BLACK_H = 16;   // px for black-key overlay band
const KEY_W = 64;
const HEADER_H = 32;

const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6

const PITCHES = Array.from(
  { length: MAX_PITCH - MIN_PITCH + 1 },
  (_, i) => MAX_PITCH - i
);

// ── Keyboard layout ──────────────────────────────────────────────────────────
// Map each white-key pitch to its display index (0 = C6 at top, incrementing downward)
const WHITE_INDEX: Map<number, number> = (() => {
  const m = new Map<number, number>();
  let idx = 0;
  for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
    if (!isBlack(p)) m.set(p, idx++);
  }
  return m;
})();

const WHITE_PITCH_AT: Map<number, number> = (() => {
  const m = new Map<number, number>();
  for (const [pitch, idx] of WHITE_INDEX) m.set(idx, pitch);
  return m;
})();

const NUM_WHITE_KEYS = WHITE_INDEX.size; // 29 for C2–C6

// Top y-coordinate of the visual block for a pitch in the grid
const pitchY = (pitch: number): number =>
  isBlack(pitch)
    // Black keys float centred on the boundary between lower (pitch-1) and upper (pitch+1) white keys
    ? WHITE_INDEX.get(pitch - 1)! * WHITE_H - BLACK_H / 2
    : WHITE_INDEX.get(pitch)! * WHITE_H;

// Visual block height for a pitch
const pitchBlockH = (pitch: number): number => (isBlack(pitch) ? BLACK_H : WHITE_H);

// Grid y-coordinate → MIDI pitch; black key bands take visual priority
const yToPitch = (y: number): number | null => {
  for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
    if (isBlack(p)) {
      const top = pitchY(p);
      if (y >= top && y < top + BLACK_H) return p;
    }
  }
  const idx = Math.floor(y / WHITE_H);
  return WHITE_PITCH_AT.get(idx) ?? null;
};

// ── Import / export helpers ──────────────────────────────────────────────────
const parseSwell = (text: string): Song => {
  const d = JSON.parse(text);
  if (d.version !== '1.0') throw new Error(`Unsupported version: ${d.version}`);
  if (typeof d.bpm !== 'number' || typeof d.beatsPerMeasure !== 'number' || typeof d.totalBeats !== 'number')
    throw new Error('Invalid song format');
  if (!Array.isArray(d.notes)) throw new Error('Invalid notes');
  return { ...d, streams: Array.isArray(d.streams) ? d.streams : [] } as Song;
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

// ── Scale / Roman numeral helpers ────────────────────────────────────────────
type RootNote = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
type ScaleMode = 'major' | 'minor';
type GlobalKey = { root: RootNote; mode: ScaleMode } | null;

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;
const ROMAN_NUMERALS: Record<ScaleMode, readonly string[]> = {
  major: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
  minor: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'],
};

const getScaleDegree = (pitch: number, key: GlobalKey): number | null => {
  if (!key) return null;
  const rootIdx = NOTE_NAMES.indexOf(key.root);
  const intervals = key.mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const semitone = ((pitch % 12) - rootIdx + 12) % 12;
  const idx = (intervals as readonly number[]).indexOf(semitone);
  return idx === -1 ? null : idx;
};

const romanNumeral = (pitch: number, key: GlobalKey): string | null => {
  const degree = getScaleDegree(pitch, key);
  if (degree === null || !key) return null;
  return ROMAN_NUMERALS[key.mode][degree];
};

// ── Stream helpers ────────────────────────────────────────────────────────────
const STREAM_COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // rose
  '#a78bfa', // violet
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#e879f9', // fuchsia
] as const;

// SATB order: low → high so spread distributes bass-up
const SATB_NAMES  = ['Bass', 'Tenor', 'Alto', 'Soprano'] as const;
const SATB_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa'] as const;

const nextStreamColor = (streams: readonly Stream[]): string => {
  const used = new Set(streams.map(s => s.color));
  return STREAM_COLORS.find(c => !used.has(c)) ?? STREAM_COLORS[streams.length % STREAM_COLORS.length];
};

const addStreamToSong = (song: Song, name: string, color: string): Song => ({
  ...song,
  streams: [...song.streams, { id: genId(), name, color }],
});

const removeStreamFromSong = (song: Song, streamId: string): Song => ({
  ...song,
  streams: song.streams.filter(s => s.id !== streamId),
  notes: song.notes.map(n => n.streamId === streamId ? { ...n, streamId: undefined } : n),
});

const renameStream = (song: Song, streamId: string, name: string): Song => ({
  ...song,
  streams: song.streams.map(s => s.id === streamId ? { ...s, name } : s),
});

const applySATB = (song: Song): Song => ({
  ...song,
  streams: SATB_NAMES.map((name, i) => ({ id: genId(), name, color: SATB_COLORS[i] })),
});

// Find the nearest chord tone strictly above `abovePitch`
const findNextChordTone = (abovePitch: number, intervals: readonly number[], rootPitch: number): number => {
  const rootClass = rootPitch % 12;
  for (let p = abovePitch + 1; p <= MAX_PITCH; p++) {
    const semitone = ((p % 12) - rootClass + 12) % 12;
    if ((intervals as number[]).includes(semitone)) return p;
  }
  return abovePitch + 12; // fallback: octave above
};

// Distribute chord tones across streams low → high.
// stream[0] gets rootPitch; each subsequent stream gets the next chord tone above.
const spreadChordAcrossStreams = (
  song: Song,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
): Song => {
  const { streams } = song;
  const pitches: number[] = [rootPitch];
  for (let i = 1; i < streams.length; i++) {
    pitches.push(findNextChordTone(pitches[i - 1], intervals, rootPitch));
  }
  return {
    ...song,
    notes: [
      ...song.notes,
      ...streams.map((stream, i) => ({
        id: genId(),
        pitch: pitches[i],
        startBeat,
        durationBeats,
        velocity: 100,
        streamId: stream.id,
      })),
    ],
  };
};

// ── Song state helpers ───────────────────────────────────────────────────────
const addNote = (song: Song, pitch: number, startBeat: number, durationBeats = 1, streamId?: string): Song => ({
  ...song,
  notes: [...song.notes, { id: genId(), pitch, startBeat, durationBeats, velocity: 100, streamId }],
});

const addChord = (
  song: Song,
  rootPitch: number,
  startBeat: number,
  durationBeats: number,
  intervals: readonly number[],
  streamId?: string,
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
      streamId,
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

function WhiteKey({ pitch, idx, globalKey }: { pitch: number; idx: number; globalKey: GlobalKey }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute w-full flex items-center px-1 text-[10px] border-b select-none bg-zinc-100 text-zinc-500 border-zinc-300"
      style={{ top: idx * WHITE_H, height: WHITE_H }}
    >
      <span className="flex-1 font-semibold">{roman ?? ''}</span>
      <span className="text-[9px]">{pitch % 12 === 0 ? pitchName(pitch) : ''}</span>
    </div>
  );
}

function BlackKey({ pitch, globalKey }: { pitch: number; globalKey: GlobalKey }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute flex items-center pl-1 text-[9px] select-none bg-zinc-800 text-zinc-400 rounded-r z-10"
      style={{ top: pitchY(pitch), height: BLACK_H, left: 0, width: Math.round(KEY_W * 0.72) }}
    >
      {roman && <span className="font-semibold">{roman}</span>}
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
  cellW,
  variant = 'normal',
  streamColor,
}: {
  note: Note;
  cellW: number;
  variant?: 'normal' | 'added' | 'removed' | 'dragging';
  streamColor?: string;
}) {
  const color = streamColor ?? '#3b82f6';
  const style: React.CSSProperties =
    variant === 'added'   ? { backgroundColor: '#10b981', borderColor: '#6ee7b7' } :
    variant === 'removed' ? { backgroundColor: 'rgba(239,68,68,0.6)', borderColor: '#f87171', opacity: 0.7 } :
    variant === 'dragging'? { backgroundColor: color, borderColor: color, opacity: 0.8 } :
                            { backgroundColor: color, borderColor: color };

  return (
    <div
      className="absolute rounded-sm border pointer-events-none"
      style={{
        left: note.startBeat * cellW + 1,
        top: pitchY(note.pitch) + 2,
        width: note.durationBeats * cellW - 2,
        height: pitchBlockH(note.pitch) - 4,
        zIndex: isBlack(note.pitch) ? 4 : 3,
        ...style,
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

// ── Streams bar ──────────────────────────────────────────────────────────────

function StreamNameInput({ name, color, onRename }: {
  name: string;
  color: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onRename(draft || name); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { onRename(draft || name); setEditing(false); }
          if (e.key === 'Escape') { setDraft(name); setEditing(false); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="w-14 bg-zinc-800 rounded px-0.5 outline-none text-xs"
        style={{ color }}
      />
    );
  }

  return (
    <span
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(name); }}
      title="Double-click to rename"
      className="select-none"
    >
      {name}
    </span>
  );
}

function StreamsBar({
  streams,
  activeStreamId,
  onActiveStreamChange,
  onAddStream,
  onRemoveStream,
  onRenameStream,
  onApplySATB,
  spreadChord,
  onSpreadChordToggle,
}: {
  streams: readonly Stream[];
  activeStreamId: string | null;
  onActiveStreamChange: (id: string | null) => void;
  onAddStream: () => void;
  onRemoveStream: (id: string) => void;
  onRenameStream: (id: string, name: string) => void;
  onApplySATB: () => void;
  spreadChord: boolean;
  onSpreadChordToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 bg-zinc-900 border-b border-zinc-700 h-10 flex-shrink-0 overflow-x-auto">
      <span className="text-xs text-zinc-500 flex-shrink-0">Streams</span>

      {/* "none" selector */}
      <button
        onClick={() => onActiveStreamChange(null)}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0',
          activeStreamId === null
            ? 'bg-zinc-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="No stream (untagged)"
      >
        —
      </button>

      {/* Per-stream buttons */}
      {streams.map(stream => (
        <div key={stream.id} className="flex items-center flex-shrink-0">
          <button
            onClick={() => onActiveStreamChange(stream.id)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded-l text-xs font-medium transition-colors',
              activeStreamId === stream.id ? 'bg-zinc-600' : 'bg-zinc-700 hover:bg-zinc-600',
            ].join(' ')}
            style={{ color: stream.color }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stream.color }} />
            <StreamNameInput
              name={stream.name}
              color={stream.color}
              onRename={name => onRenameStream(stream.id, name)}
            />
          </button>
          <button
            onClick={() => onRemoveStream(stream.id)}
            className="px-1.5 py-1 rounded-r bg-zinc-700 hover:bg-zinc-600 text-zinc-500 hover:text-zinc-300 text-xs border-l border-zinc-600 transition-colors"
            title="Remove stream"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAddStream}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-colors flex-shrink-0"
        title="Add stream"
      >
        +
      </button>
      <button
        onClick={onApplySATB}
        className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-400 transition-colors flex-shrink-0"
        title="Replace streams with SATB preset (Bass → Tenor → Alto → Soprano)"
      >
        SATB
      </button>
      <button
        onClick={onSpreadChordToggle}
        disabled={streams.length < 2}
        className={[
          'px-2 py-1 rounded text-xs transition-colors flex-shrink-0 font-mono disabled:opacity-30',
          spreadChord
            ? 'bg-teal-700 text-teal-100'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="Spread chord across all streams (bass → soprano)"
      >
        Spread
      </button>
    </div>
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
  globalKey,
  onGlobalKeyChange,
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
  globalKey: GlobalKey;
  onGlobalKeyChange: (key: GlobalKey) => void;
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
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        Key
        <select
          value={globalKey ? `${globalKey.root}-${globalKey.mode}` : ''}
          onChange={e => {
            if (!e.target.value) { onGlobalKeyChange(null); return; }
            const sep = e.target.value.lastIndexOf('-');
            const root = e.target.value.slice(0, sep) as RootNote;
            const mode = e.target.value.slice(sep + 1) as ScaleMode;
            onGlobalKeyChange({ root, mode });
          }}
          className="bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 text-xs"
        >
          <option value="">—</option>
          {NOTE_NAMES.map(root => (
            <optgroup key={root} label={root}>
              <option value={`${root}-major`}>{root} major</option>
              <option value={`${root}-minor`}>{root} minor</option>
            </optgroup>
          ))}
        </select>
      </label>
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

  // ── Global key ────────────────────────────────────────────────────────────
  const [globalKey, setGlobalKey] = useState<GlobalKey>(null);

  // ── Streams ───────────────────────────────────────────────────────────────
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [spreadChord, setSpreadChord] = useState(false);

  const handleAddStream = useCallback(() => {
    setSong(s => {
      const color = nextStreamColor(s.streams);
      const name = `Stream ${s.streams.length + 1}`;
      const updated = addStreamToSong(s, name, color);
      setActiveStreamId(updated.streams[updated.streams.length - 1].id);
      return updated;
    });
  }, []);

  const handleRemoveStream = useCallback((streamId: string) => {
    setSong(s => removeStreamFromSong(s, streamId));
    setActiveStreamId(id => id === streamId ? null : id);
  }, []);

  const handleRenameStream = useCallback((streamId: string, name: string) => {
    setSong(s => renameStream(s, streamId, name));
  }, []);

  const handleApplySATB = useCallback(() => {
    setSong(s => {
      const updated = applySATB(s);
      setActiveStreamId(updated.streams[0]?.id ?? null);
      return updated;
    });
  }, []);

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
      const pitch = yToPitch(e.clientY - rect.top);
      if (pitch === null) return;
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
      const pitch = yToPitch(e.clientY - rect.top);
      if (pitch === null || rawBeat < 0 || rawBeat >= song.totalBeats) return;
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
        if (spreadChord && chordType !== 'note' && song.streams.length >= 2) {
          setSong(s => spreadChordAcrossStreams(s, pitch, snapped, resolution, CHORD_INTERVALS[chordType]));
        } else {
          setSong(s => addChord(s, pitch, snapped, resolution, CHORD_INTERVALS[chordType], activeStreamId ?? undefined));
        }
      }
    },
    [song.notes, song.totalBeats, suggestion.status, resolution, cellW, chordType, activeStreamId, spreadChord, song.streams.length]
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
  const gridHeight = NUM_WHITE_KEYS * WHITE_H;

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
        globalKey={globalKey}
        onGlobalKeyChange={setGlobalKey}
      />
      <StreamsBar
        streams={song.streams}
        activeStreamId={activeStreamId}
        onActiveStreamChange={setActiveStreamId}
        onAddStream={handleAddStream}
        onRemoveStream={handleRemoveStream}
        onRenameStream={handleRenameStream}
        onApplySATB={handleApplySATB}
        spreadChord={spreadChord}
        onSpreadChordToggle={() => setSpreadChord(v => !v)}
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
          <div className="relative" style={{ height: NUM_WHITE_KEYS * WHITE_H }}>
            {[...WHITE_INDEX.entries()].map(([pitch, idx]) => (
              <WhiteKey key={pitch} pitch={pitch} idx={idx} globalKey={globalKey} />
            ))}
            {PITCHES.filter(isBlack).map(pitch => (
              <BlackKey key={pitch} pitch={pitch} globalKey={globalKey} />
            ))}
          </div>
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
            {/* Row backgrounds — white key rows */}
            {[...WHITE_INDEX.entries()].map(([pitch, idx]) => {
              const outOfScale = globalKey !== null && getScaleDegree(pitch, globalKey) === null;
              return (
                <div
                  key={pitch}
                  className={[
                    'absolute w-full border-b',
                    outOfScale ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900 border-zinc-700/50',
                  ].join(' ')}
                  style={{ top: idx * WHITE_H, height: WHITE_H }}
                />
              );
            })}
            {/* Row backgrounds — black key overlay bands */}
            {PITCHES.filter(isBlack).map(pitch => {
              const outOfScale = globalKey !== null && getScaleDegree(pitch, globalKey) === null;
              return (
                <div
                  key={pitch}
                  className={outOfScale ? 'absolute w-full bg-zinc-900' : 'absolute w-full bg-zinc-800'}
                  style={{ top: pitchY(pitch), height: BLACK_H, zIndex: 1 }}
                />
              );
            })}

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
              if (note.pitch < MIN_PITCH || note.pitch > MAX_PITCH) return null;
              const streamColor = (variant === 'normal' || variant === 'dragging')
                ? activeSong.streams.find(s => s.id === note.streamId)?.color
                : undefined;
              return (
                <NoteBlock
                  key={`${note.id}-${variant}`}
                  note={note}
                  cellW={cellW}
                  variant={variant}
                  streamColor={streamColor}
                />
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
