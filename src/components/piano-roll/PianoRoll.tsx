'use client';

import { useState, useRef } from 'react';
import { useComposition } from '../../hooks/useComposition';
import { usePlayback } from '../../hooks/usePlayback';
import { useNoteInteraction } from '../../hooks/useNoteInteraction';
import { useAgentSuggestion } from '../../hooks/useAgentSuggestion';
import { useMusicGen } from '../../hooks/useMusicGen';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { useZoom } from '../../hooks/useZoom';
import { toResolution } from '../../lib/snap';
import type { SnapDiv } from '../../lib/snap';
import type { ChordType } from '../../lib/music/chord';
import { NUM_WHITE_KEYS, WHITE_H } from './layout';
import TransportBar from '../transport/TransportBar';
import TracksBar from '../streams/TracksBar';
import MusicGenBar from '../agent/MusicGenBar';
import AgentBar from '../agent/AgentBar';
import ProblemsPanel from '../diagnostics/ProblemsPanel';
import Keyboard from './Keyboard';
import BeatHeader from './BeatHeader';
import Grid from './Grid';
import NoteLayer from './NoteLayer';
import Playhead from './Playhead';

export default function PianoRoll() {
  const comp = useComposition();
  const { composition, setComposition, globalKey, setGlobalKey, activePartId, setActivePartId, spreadChord, setSpreadChord,
    handleAddTrack, handleRemoveTrack, handleRenameTrack, handleApplySATB,
    handleExport, handleImport, handleBpmChange } = comp;

  const [snapDiv, setSnapDiv] = useState<SnapDiv>('1/4');
  const [triplet, setTriplet] = useState(false);
  const [chordType, setChordType] = useState<ChordType>('note');
  const [problemsOpen, setProblemsOpen] = useState(false);

  const { suggestion, handleAgentSubmit, handleAccept, handleReject } = useAgentSuggestion(composition, setComposition);
  const { musicGen, handleMusicGenToggle, handleMusicGen, closeMusicGen } = useMusicGen();
  const { cellW, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom();
  const { diagnostics } = useDiagnostics(composition);

  const activeComposition = suggestion.status === 'ready' ? suggestion.suggestedComposition : composition;
  const { playing, playhead, togglePlay } = usePlayback(activeComposition);

  const gridRef = useRef<HTMLDivElement>(null);
  const { drag, handleGridMouseDown } = useNoteInteraction({
    composition,
    suggestionStatus: suggestion.status,
    snapDiv,
    triplet,
    cellW,
    chordType,
    activePartId,
    spreadChord,
    setComposition,
    gridRef,
  });

  const resolution = toResolution(snapDiv, triplet);
  const gridWidth = composition.totalBeats * cellW;
  const gridHeight = NUM_WHITE_KEYS * WHITE_H;

  return (
    <div className="flex flex-col h-screen bg-zinc-900 text-white overflow-hidden">
      <TransportBar
        playing={playing}
        beat={playhead}
        bpm={composition.bpm}
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
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        chordType={chordType}
        onChordTypeChange={setChordType}
        globalKey={globalKey}
        onGlobalKeyChange={setGlobalKey}
      />
      <TracksBar
        tracks={composition.tracks}
        activePartId={activePartId}
        onActivePartChange={setActivePartId}
        onAddTrack={handleAddTrack}
        onRemoveTrack={handleRemoveTrack}
        onRenameTrack={handleRenameTrack}
        onApplySATB={handleApplySATB}
        spreadChord={spreadChord}
        onSpreadChordToggle={() => setSpreadChord(v => !v)}
      />
      {musicGen.status !== 'hidden' && (
        <MusicGenBar
          state={musicGen}
          onGenerate={handleMusicGen}
          onClose={closeMusicGen}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Keyboard globalKey={globalKey} />

        {/* Scrollable grid */}
        <div className="flex-1 overflow-auto">
          <BeatHeader
            totalBeats={composition.totalBeats}
            beatsPerMeasure={composition.beatsPerMeasure}
            cellW={cellW}
          />

          <div
            ref={gridRef}
            className={[
              'relative',
              suggestion.status === 'ready' ? 'cursor-not-allowed' : drag ? 'cursor-grabbing' : 'cursor-crosshair',
            ].join(' ')}
            style={{ width: gridWidth, height: gridHeight }}
            onMouseDown={handleGridMouseDown}
          >
            <Grid
              totalBeats={composition.totalBeats}
              beatsPerMeasure={composition.beatsPerMeasure}
              cellW={cellW}
              resolution={resolution}
              globalKey={globalKey}
            />
            <NoteLayer
              composition={composition}
              activeComposition={activeComposition}
              suggestion={suggestion}
              drag={drag}
              cellW={cellW}
            />
            {playing && <Playhead beat={playhead} cellW={cellW} />}
          </div>
        </div>
      </div>

      <AgentBar
        suggestion={suggestion}
        onSubmit={handleAgentSubmit}
        onAccept={handleAccept}
        onReject={handleReject}
      />
      <ProblemsPanel
        diagnostics={diagnostics}
        open={problemsOpen}
        onToggle={() => setProblemsOpen(v => !v)}
      />
    </div>
  );
}
