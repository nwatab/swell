'use client';

import { useState, useCallback } from 'react';
import type { Song, KeySignature } from '../types/song';
import { DEFAULT_SONG } from '../types/song';
import { keyAtBeat, applyKeyTransform } from '../lib/harmony';
import { annotateNote } from '../lib/music/note-operations';
import { downloadSwell } from '../lib/swell-format/serialize';
import {
  nextStreamColor,
  addStreamToSong,
  removeStreamFromSong,
  renameStream,
  applySATB,
} from '../lib/music/stream';

export interface UseCompositionReturn {
  song: Song;
  setSong: React.Dispatch<React.SetStateAction<Song>>;
  globalKey: KeySignature | null;
  setGlobalKey: (key: KeySignature | null) => void;
  activeStreamId: string | null;
  setActiveStreamId: React.Dispatch<React.SetStateAction<string | null>>;
  spreadChord: boolean;
  setSpreadChord: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddStream: () => void;
  handleRemoveStream: (streamId: string) => void;
  handleRenameStream: (streamId: string, name: string) => void;
  handleApplySATB: () => void;
  handleExport: () => void;
  handleImport: (imported: Song) => void;
  handleBpmChange: (bpm: number) => void;
}

export const useComposition = (): UseCompositionReturn => {
  const [song, setSong] = useState<Song>(DEFAULT_SONG);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [spreadChord, setSpreadChord] = useState(false);

  const globalKey = song.globalKey ?? null;

  const setGlobalKey = useCallback((newKey: KeySignature | null) => {
    setSong(s => {
      const oldKey = s.globalKey ?? null;
      const songWithNewKey = { ...s, globalKey: newKey ?? undefined };

      // Remap diatonic notes so each keeps its scale degree in the new key.
      const transformedNotes =
        oldKey && newKey
          ? applyKeyTransform(s.notes, oldKey, newKey)
          : s.notes;

      // Re-annotate all notes with the new key context.
      return {
        ...songWithNewKey,
        notes: transformedNotes.map(n => ({
          ...n,
          ...annotateNote(n.pitch, keyAtBeat(songWithNewKey, n.startBeat)),
        })),
      };
    });
  }, []);

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

  const handleExport = useCallback(() => downloadSwell(song), [song]);
  const handleImport = useCallback((imported: Song) => setSong(imported), []);
  const handleBpmChange = useCallback((bpm: number) => {
    setSong(s => ({ ...s, bpm }));
  }, []);

  return {
    song,
    setSong,
    globalKey,
    setGlobalKey,
    activeStreamId,
    setActiveStreamId,
    spreadChord,
    setSpreadChord,
    handleAddStream,
    handleRemoveStream,
    handleRenameStream,
    handleApplySATB,
    handleExport,
    handleImport,
    handleBpmChange,
  };
};
