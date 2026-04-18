'use client';

import { useRef } from 'react';
import type { Composition, KeySignature } from '../../types/song';
import type { SnapDiv } from '../../lib/snap';
import type { ChordType } from '../../lib/music/chord';
import { parseSwell } from '../../lib/swell-format/deserialize';
import SnapSelector from './SnapSelector';
import ChordSelector from './ChordSelector';
import KeySelector from './KeySelector';
import ZoomControls from './ZoomControls';

interface TransportBarProps {
  playing: boolean;
  beat: number;
  bpm: number;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onMusicGenToggle: () => void;
  musicGenActive: boolean;
  onExport: () => void;
  onImport: (composition: Composition) => void;
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
  globalKey: KeySignature;
  onGlobalKeyChange: (key: KeySignature) => void;
}

export default function TransportBar({
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
}: TransportBarProps) {
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
      <SnapSelector
        snapDiv={snapDiv}
        triplet={triplet}
        onSnapDivChange={onSnapDivChange}
        onTripletToggle={onTripletToggle}
      />
      <ChordSelector chordType={chordType} onChordTypeChange={onChordTypeChange} />
      <KeySelector keySignature={globalKey} onKeyChange={onGlobalKeyChange} />
      <ZoomControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
      />
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
