'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { Composition } from '../types/song';
import type { SuggestionState, DragState } from '../types/ui-state';
import type { ChordType } from '../lib/music/chord';
import { CHORD_INTERVALS } from '../lib/music/chord';
import { snapBeat, snapBeatFloor, toResolution } from '../lib/snap';
import type { SnapDiv } from '../lib/snap';
import {
  addChord,
  removeNote,
  moveNote,
  spreadChordAcrossParts,
} from '../lib/music/note-operations';
import { keyAtBeat, getDiatonicChordIntervals, snapToDiatonic } from '../lib/harmony';
import { yToPitch } from '../components/piano-roll/layout';

export interface UseNoteInteractionReturn {
  drag: DragState | null;
  handleGridMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface UseNoteInteractionOptions {
  composition: Composition;
  suggestionStatus: SuggestionState['status'];
  snapDiv: SnapDiv;
  triplet: boolean;
  cellW: number;
  chordType: ChordType;
  activePartId: string | null;
  spreadChord: boolean;
  setComposition: React.Dispatch<React.SetStateAction<Composition>>;
  gridRef: RefObject<HTMLDivElement | null>;
}

export const useNoteInteraction = ({
  composition,
  suggestionStatus,
  snapDiv,
  triplet,
  cellW,
  chordType,
  activePartId,
  spreadChord,
  setComposition,
  gridRef,
}: UseNoteInteractionOptions): UseNoteInteractionReturn => {
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const compositionRef = useRef<Composition>(composition);
  compositionRef.current = composition;

  const cellWRef = useRef(cellW);
  cellWRef.current = cellW;

  const resolutionRef = useRef(toResolution(snapDiv, triplet));
  resolutionRef.current = toResolution(snapDiv, triplet);

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
      const s = compositionRef.current;
      const res = resolutionRef.current;
      const newBeat = Math.max(0, Math.min(s.totalBeats - 1, snapBeat(rawBeat - d.beatOffset, res)));
      const hasMoved = newBeat !== d.originalBeat || pitch !== d.originalPitch;
      setDrag({ ...d, previewBeat: newBeat, previewPitch: pitch, hasMoved });
    };

    const handleMouseUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved) {
        setComposition(s => moveNote(s, d.noteId, d.previewBeat, d.previewPitch));
      } else {
        setComposition(s => removeNote(s, d.noteId));
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
      if (suggestionStatus === 'ready') return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const rawBeat = (e.clientX - rect.left) / cellW;
      const pitch = yToPitch(e.clientY - rect.top);
      const resolution = toResolution(snapDiv, triplet);
      if (pitch === null || rawBeat < 0 || rawBeat >= composition.totalBeats) return;

      // Hit-test uses raw position for accuracy
      const hit = composition.notes.find(
        n => n.pitch === pitch && rawBeat >= n.startBeat && rawBeat < n.startBeat + n.durationBeats,
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
        const snapped = Math.max(0, Math.min(composition.totalBeats - resolution, snapBeatFloor(rawBeat, resolution)));

        // Resolve chord intervals: diatonic types depend on the active key.
        const isDia = chordType === 'dia' || chordType === 'dia7';
        let intervals: readonly number[];
        let rootPitch = pitch; // may be snapped for diatonic mode
        if (isDia) {
          const key = keyAtBeat(composition, snapped);
          // Snap chromatic pitches to the nearest diatonic note so Dia mode
          // always produces a chord even when the user clicks a black key.
          rootPitch = snapToDiatonic(pitch, key);
          intervals = getDiatonicChordIntervals(rootPitch, key, chordType === 'dia7') ?? [0];
        } else {
          intervals = CHORD_INTERVALS[chordType];
        }

        if (spreadChord && intervals.length > 1 && composition.parts.length >= 2) {
          setComposition(s => spreadChordAcrossParts(s, rootPitch, snapped, resolution, intervals));
        } else {
          setComposition(s => addChord(s, rootPitch, snapped, resolution, intervals, activePartId ?? undefined));
        }
      }
    },
    [composition, suggestionStatus, snapDiv, triplet, cellW, chordType, activePartId, spreadChord, setComposition],
  );

  return { drag, handleGridMouseDown };
};
