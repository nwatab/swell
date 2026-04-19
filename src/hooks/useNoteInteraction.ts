'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { Composition, NoteDuration } from '../types/song';
import { DURATION_BEATS, totalBeats } from '../types/song';
import type { SuggestionState, DragState } from '../types/ui-state';
import type { ChordType } from '../lib/music/chord';
import { CHORD_INTERVALS } from '../lib/music/chord';
import { snapBeat, snapBeatFloor, toResolution } from '../lib/snap';
import type { SnapDiv } from '../lib/snap';
import { addNote, removeNote, removeChord, moveNote, spreadChordAcrossVoices, upsertHarmonicDeclaration } from '../lib/music/note-operations';
import { keyAtBeat, getDiatonicChordIntervals, snapToDiatonic, spellMidi, spelledPitchToMidi, diatonicChordQuality } from '../lib/harmony';
import type { ChordQuality } from '../types/song';
import { yToPitch } from '../components/piano-roll/layout';

export interface UseNoteInteractionReturn {
  drag: DragState | null;
  handleGridMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface UseNoteInteractionOptions {
  composition: Composition;
  suggestionStatus: SuggestionState['status'];
  snapDiv: SnapDiv;
  cellW: number;
  chordType: ChordType;
  activeVoiceId: string | null;
  setComposition: React.Dispatch<React.SetStateAction<Composition>>;
  gridRef: RefObject<HTMLDivElement | null>;
}

// Snap resolution → NoteDuration (approximate)
const resolutionToDuration = (resolution: number): NoteDuration => {
  if (resolution >= 4) return 'whole';
  if (resolution >= 2) return 'half';
  if (resolution >= 1) return 'quarter';
  return 'eighth';
};

export const useNoteInteraction = ({
  composition,
  suggestionStatus,
  snapDiv,
  cellW,
  chordType,
  activeVoiceId,
  setComposition,
  gridRef,
}: UseNoteInteractionOptions): UseNoteInteractionReturn => {
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const compositionRef = useRef<Composition>(composition);
  const cellWRef = useRef(cellW);
  const resolutionRef = useRef(toResolution(snapDiv));

  useLayoutEffect(() => {
    dragRef.current = drag;
    compositionRef.current = composition;
    cellWRef.current = cellW;
    resolutionRef.current = toResolution(snapDiv);
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawBeat = (e.clientX - rect.left) / cellWRef.current;
      const midi = yToPitch(e.clientY - rect.top);
      if (midi === null) return;
      const s = compositionRef.current;
      const res = resolutionRef.current;
      const newBeat = Math.max(0, Math.min(totalBeats(s) - 1, snapBeat(rawBeat - d.beatOffset, res)));
      const key = keyAtBeat(s, newBeat);
      const hasMoved = newBeat !== d.originalBeat || midi !== d.originalMidi;
      setDrag({ ...d, previewBeat: newBeat, previewSpelledPitch: spellMidi(midi, key), hasMoved });
    };

    const handleMouseUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved) {
        setComposition(s => moveNote(s, d.noteId, d.previewBeat, d.previewSpelledPitch));
      } else {
        const note = compositionRef.current.voices.flatMap(v => v.notes).find(n => n.id === d.noteId);
        const binding = note?.binding;
        if (binding?.kind === 'chord_tone') {
          setComposition(s => removeChord(s, binding.chordId));
        } else {
          setComposition(s => removeNote(s, d.noteId));
        }
      }
      setDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gridRef, setComposition]); // stable refs — gridRef.current and setState setter never change

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suggestionStatus === 'ready') return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const rawBeat = (e.clientX - rect.left) / cellW;
      const midi = yToPitch(e.clientY - rect.top);
      const resolution = toResolution(snapDiv);
      if (midi === null || rawBeat < 0 || rawBeat >= totalBeats(composition)) return;

      // Hit-test: find a note at this position across all voices
      const allNotes = composition.voices.flatMap(v =>
        v.notes.map(n => ({ note: n, voiceId: v.id }))
      );
      const hit = allNotes.find(({ note: n }) => {
        const noteMidi = spelledPitchToMidi(n.spelledPitch);
        return noteMidi === midi &&
          rawBeat >= n.startBeat &&
          rawBeat < n.startBeat + DURATION_BEATS[n.duration];
      });

      if (hit) {
        const { note } = hit;
        setDrag({
          noteId: note.id,
          originalBeat: note.startBeat,
          originalMidi: spelledPitchToMidi(note.spelledPitch),
          beatOffset: rawBeat - note.startBeat,
          previewBeat: note.startBeat,
          previewSpelledPitch: note.spelledPitch,
          hasMoved: false,
        });
      } else {
        const snapped = Math.max(0, Math.min(totalBeats(composition) - resolution, snapBeatFloor(rawBeat, resolution)));
        const duration = resolutionToDuration(resolution);
        const key = keyAtBeat(composition, snapped);

        const isDia = chordType === 'dia' || chordType === 'dia7';
        let intervals: readonly number[];
        let rootMidi = midi;
        if (isDia) {
          rootMidi = snapToDiatonic(midi, key);
          intervals = getDiatonicChordIntervals(rootMidi, key, chordType === 'dia7') ?? [0];
        } else {
          intervals = CHORD_INTERVALS[chordType] ?? [0];
        }

        const voiceId = activeVoiceId ?? composition.voices[0]?.id;
        if (!voiceId) return;

        if (intervals.length > 1) {
          const chordRoot = spellMidi(rootMidi, key);
          const measureIndex = Math.floor(snapped / composition.timeSignature.numerator);
          let quality: ChordQuality | null = null;
          if (chordType === 'maj') quality = 'maj';
          else if (chordType === 'min') quality = 'min';
          else if (chordType === 'maj7') quality = 'maj7';
          else if (chordType === 'min7') quality = 'min7';
          else if (chordType === 'dia') quality = diatonicChordQuality(rootMidi, key, false);
          else if (chordType === 'dia7') quality = diatonicChordQuality(rootMidi, key, true);
          setComposition(s => {
            const withNotes = spreadChordAcrossVoices(s, rootMidi, snapped, duration, intervals, key);
            if (quality === null) return withNotes;
            return upsertHarmonicDeclaration(withNotes, {
              measureIndex,
              root: { letter: chordRoot.letter, accidental: chordRoot.accidental },
              quality,
            });
          });
        } else {
          setComposition(s => addNote(s, voiceId, spellMidi(rootMidi, key), snapped, duration));
        }
      }
    },
    [composition, suggestionStatus, snapDiv, cellW, chordType, activeVoiceId, setComposition],
  );

  return { drag, handleGridMouseDown };
};
