'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { Composition, NoteDuration } from '../types/song';
import { DURATION_BEATS, totalBeats } from '../types/song';
import type { SuggestionState, DragState, Selection, EditMode } from '../types/ui-state';
import type { ChordType } from '../lib/music/chord';
import { CHORD_INTERVALS } from '../lib/music/chord';
import { snapBeat, snapBeatFloor, toResolution } from '../lib/snap';
import type { SnapDiv } from '../lib/snap';
import { addNote, removeNote, removeChord, moveNote, spreadChordAcrossVoices } from '../lib/music/note-operations';
import { keyAtBeat, getDiatonicChordIntervals, snapToDiatonic, spellMidi, spelledPitchToMidi } from '../lib/harmony';
import { yToPitch } from '../components/piano-roll/layout';

export interface UseNoteInteractionReturn {
  drag: DragState | null;
  selection: Selection;
  handleGridMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleGridDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export interface UseNoteInteractionOptions {
  composition: Composition;
  suggestionStatus: SuggestionState['status'];
  snapDiv: SnapDiv;
  cellW: number;
  chordType: ChordType;
  editMode: EditMode;
  activeVoiceId: string | null;
  setComposition: React.Dispatch<React.SetStateAction<Composition>>;
  gridRef: RefObject<HTMLDivElement | null>;
}

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
  editMode,
  activeVoiceId,
  setComposition,
  gridRef,
}: UseNoteInteractionOptions): UseNoteInteractionReturn => {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  const dragRef = useRef<DragState | null>(null);
  const compositionRef = useRef<Composition>(composition);
  const cellWRef = useRef(cellW);
  const resolutionRef = useRef(toResolution(snapDiv));
  const selectionRef = useRef<Selection>(null);
  const editModeRef = useRef<EditMode>(editMode);

  useLayoutEffect(() => {
    dragRef.current = drag;
    compositionRef.current = composition;
    cellWRef.current = cellW;
    resolutionRef.current = toResolution(snapDiv);
    selectionRef.current = selection;
    editModeRef.current = editMode;
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
      const next = { ...d, previewBeat: newBeat, previewSpelledPitch: spellMidi(midi, key), hasMoved };
      dragRef.current = next;
      setDrag(next);
    };

    const handleMouseUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.hasMoved) {
        setComposition(s => moveNote(s, d.noteId, d.previewBeat, d.previewSpelledPitch));
        setSelection(null);
      } else if (editModeRef.current === 'select') {
        const note = compositionRef.current.voices.flatMap(v => v.notes).find(n => n.id === d.noteId);
        const binding = note?.binding;
        const cur = selectionRef.current;
        if (binding?.kind === 'chord_tone') {
          const alreadySelected =
            (cur?.kind === 'chord' && cur.chordId === binding.chordId) ||
            (cur?.kind === 'note' && cur.noteId === d.noteId);
          if (!alreadySelected) setSelection({ kind: 'chord', chordId: binding.chordId });
        } else if (note) {
          if (!(cur?.kind === 'note' && cur.noteId === note.id)) {
            setSelection({ kind: 'note', noteId: note.id });
          }
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
  }, [gridRef, setComposition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const sel = selectionRef.current;
      if (!sel) return;
      e.preventDefault();
      if (sel.kind === 'chord') {
        setComposition(s => removeChord(s, sel.chordId));
      } else {
        setComposition(s => removeNote(s, sel.noteId));
      }
      setSelection(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setComposition]);

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suggestionStatus === 'ready') return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const rawBeat = (e.clientX - rect.left) / cellW;
      const midi = yToPitch(e.clientY - rect.top);
      const resolution = toResolution(snapDiv);
      if (midi === null || rawBeat < 0 || rawBeat >= totalBeats(composition)) return;

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
        // ダブルクリックの2回目 mousedown では drag を開始しない（dblclick で処理）
        if (e.detail >= 2 && note.binding?.kind === 'chord_tone') return;
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
        setSelection(null);
        if (editMode === 'select') return;

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
          setComposition(s => spreadChordAcrossVoices(s, rootMidi, snapped, duration, intervals, key));
        } else {
          setComposition(s => addNote(s, voiceId, spellMidi(rootMidi, key), snapped, duration));
        }
      }
    },
    [composition, suggestionStatus, snapDiv, cellW, chordType, editMode, activeVoiceId, setComposition],
  );

  const handleGridDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suggestionStatus === 'ready') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const rawBeat = (e.clientX - rect.left) / cellW;
      const midi = yToPitch(e.clientY - rect.top);
      if (midi === null || rawBeat < 0 || rawBeat >= totalBeats(composition)) return;

      const hit = composition.voices.flatMap(v => v.notes).find(n => {
        const noteMidi = spelledPitchToMidi(n.spelledPitch);
        return noteMidi === midi &&
          rawBeat >= n.startBeat &&
          rawBeat < n.startBeat + DURATION_BEATS[n.duration];
      });

      if (hit?.binding?.kind === 'chord_tone') {
        setSelection({ kind: 'note', noteId: hit.id });
      }
    },
    [composition, suggestionStatus, cellW],
  );

  return { drag, selection, handleGridMouseDown, handleGridDoubleClick };
};
