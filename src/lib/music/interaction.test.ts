import type { Composition, Note, SpelledPitch } from '../../types/song';
import { DEFAULT_COMPOSITION } from '../../types/song';
import type { DragState, Selection } from '../../types/ui-state';
import { spelledPitchToMidi } from '../harmony';
import {
  hitNote,
  computeDragStart,
  computeDragUpdate,
  applyDrag,
  resolveClickSelection,
  resolutionToDuration,
} from './interaction';

// ── Fixtures ────────────────────────────────────────────────────────────────

const C4: SpelledPitch = { letter: 'C', accidental: 0, octave: 4 }; // MIDI 60
const E4: SpelledPitch = { letter: 'E', accidental: 0, octave: 4 }; // MIDI 64
const G4: SpelledPitch = { letter: 'G', accidental: 0, octave: 4 }; // MIDI 67
const D4: SpelledPitch = { letter: 'D', accidental: 0, octave: 4 }; // MIDI 62

const CHORD_ID = 'chord-1';
const C_MAJOR_KEY = DEFAULT_COMPOSITION.keySignature; // { tonic: C, mode: 'major' }

const chordNoteC: Note = {
  id: 'note-c',
  spelledPitch: C4,
  startBeat: 0,
  duration: 'quarter',
  binding: { kind: 'chord_tone', chordId: CHORD_ID, role: 'root' },
};

const chordNoteE: Note = {
  id: 'note-e',
  spelledPitch: E4,
  startBeat: 0,
  duration: 'quarter',
  binding: { kind: 'chord_tone', chordId: CHORD_ID, role: 'third' },
};

const chordNoteG: Note = {
  id: 'note-g',
  spelledPitch: G4,
  startBeat: 0,
  duration: 'quarter',
  binding: { kind: 'chord_tone', chordId: CHORD_ID, role: 'fifth' },
};

const freeNote: Note = {
  id: 'note-free',
  spelledPitch: D4,
  startBeat: 2,
  duration: 'quarter',
};

const composition: Composition = {
  ...DEFAULT_COMPOSITION,
  voices: [
    { id: 'v1', role: 'soprano', notes: [chordNoteC, freeNote] },
    { id: 'v2', role: 'alto',    notes: [chordNoteE] },
    { id: 'v3', role: 'tenor',   notes: [chordNoteG] },
  ],
};

// ── resolutionToDuration ────────────────────────────────────────────────────

describe('resolutionToDuration', () => {
  it('returns whole for resolution >= 4', () => {
    expect(resolutionToDuration(4)).toBe('whole');
    expect(resolutionToDuration(8)).toBe('whole');
  });
  it('returns half for resolution >= 2 and < 4', () => {
    expect(resolutionToDuration(2)).toBe('half');
    expect(resolutionToDuration(3)).toBe('half');
  });
  it('returns quarter for resolution >= 1 and < 2', () => {
    expect(resolutionToDuration(1)).toBe('quarter');
  });
  it('returns eighth for resolution < 1', () => {
    expect(resolutionToDuration(0.5)).toBe('eighth');
  });
});

// ── hitNote ─────────────────────────────────────────────────────────────────

describe('hitNote', () => {
  it('ノートの範囲内をヒットする（開始拍）', () => {
    expect(hitNote(composition, 0, 60)).toBe(chordNoteC);
  });

  it('ノートの範囲内をヒットする（終端直前）', () => {
    // quarter = 1 beat, so beat 0.99 should hit
    expect(hitNote(composition, 0.99, 60)).toBe(chordNoteC);
  });

  it('ノートの終端（開始+duration）はヒットしない', () => {
    expect(hitNote(composition, 1.0, 60)).toBeNull();
  });

  it('MIDIが一致しない場合はヒットしない', () => {
    expect(hitNote(composition, 0, 61)).toBeNull();
  });

  it('別の拍のノートをヒットする', () => {
    // freeNote: D4 (MIDI 62), startBeat 2, quarter
    expect(hitNote(composition, 2.5, 62)).toBe(freeNote);
  });

  it('ノートがない座標はnullを返す', () => {
    expect(hitNote(composition, 5, 60)).toBeNull();
  });
});

// ── computeDragStart ────────────────────────────────────────────────────────

describe('computeDragStart', () => {
  it('和音が選択中の場合、その和音音符はコードドラッグになる', () => {
    const sel: Selection = { kind: 'chord', chordId: CHORD_ID };
    const drag = computeDragStart(chordNoteC, sel, 'select', 0.3);
    expect(drag.chordId).toBe(CHORD_ID);
    expect(drag.pitchDelta).toBe(0);
  });

  it('drawモードではコードが選択中でもコードドラッグにならない', () => {
    const sel: Selection = { kind: 'chord', chordId: CHORD_ID };
    const drag = computeDragStart(chordNoteC, sel, 'draw', 0.3);
    expect(drag.chordId).toBeUndefined();
    expect(drag.pitchDelta).toBeUndefined();
  });

  it('別の和音が選択中の場合はコードドラッグにならない', () => {
    const sel: Selection = { kind: 'chord', chordId: 'chord-other' };
    const drag = computeDragStart(chordNoteC, sel, 'select', 0.3);
    expect(drag.chordId).toBeUndefined();
  });

  it('ダブルクリック後（note選択）のドラッグは単音のみ', () => {
    const sel: Selection = { kind: 'note', noteId: chordNoteC.id };
    const drag = computeDragStart(chordNoteC, sel, 'select', 0.3);
    expect(drag.chordId).toBeUndefined();
  });

  it('選択なしの場合はコードドラッグにならない', () => {
    const drag = computeDragStart(chordNoteC, null, 'select', 0.3);
    expect(drag.chordId).toBeUndefined();
  });

  it('自由ノートはコードドラッグにならない', () => {
    const sel: Selection = { kind: 'chord', chordId: CHORD_ID };
    const drag = computeDragStart(freeNote, sel, 'select', 2.3);
    expect(drag.chordId).toBeUndefined();
  });

  it('beatOffsetはクリック位置とノート開始拍の差', () => {
    const drag = computeDragStart(chordNoteC, null, 'select', 0.3);
    expect(drag.beatOffset).toBeCloseTo(0.3 - 0); // rawBeat - startBeat
  });

  it('初期状態はhasMoved=false', () => {
    const drag = computeDragStart(chordNoteC, null, 'select', 0.3);
    expect(drag.hasMoved).toBe(false);
  });

  it('originalBeatとoriginalMidiはノートの初期位置', () => {
    const drag = computeDragStart(chordNoteC, null, 'select', 0.3);
    expect(drag.originalBeat).toBe(0);
    expect(drag.originalMidi).toBe(60); // C4
  });
});

// ── computeDragUpdate ────────────────────────────────────────────────────────

const baseSingleDrag: DragState = {
  noteId: 'note-c',
  originalBeat: 0,
  originalMidi: 60,
  beatOffset: 0,
  previewBeat: 0,
  previewSpelledPitch: C4,
  hasMoved: false,
};

const baseChordDrag: DragState = {
  ...baseSingleDrag,
  chordId: CHORD_ID,
  pitchDelta: 0,
};

describe('computeDragUpdate', () => {
  it('拍が変化するとhasMoved=trueになる', () => {
    const result = computeDragUpdate(baseSingleDrag, 2, 60, 15, 1, C_MAJOR_KEY);
    expect(result.hasMoved).toBe(true);
    expect(result.previewBeat).toBe(2);
  });

  it('MIDIが変化するとhasMoved=trueになる', () => {
    const result = computeDragUpdate(baseSingleDrag, 0, 62, 15, 1, C_MAJOR_KEY);
    expect(result.hasMoved).toBe(true);
  });

  it('位置が変化しない場合はhasMoved=false', () => {
    const result = computeDragUpdate(baseSingleDrag, 0, 60, 15, 1, C_MAJOR_KEY);
    expect(result.hasMoved).toBe(false);
  });

  it('beatは0以下にクランプされる', () => {
    const result = computeDragUpdate(baseSingleDrag, -5, 60, 15, 1, C_MAJOR_KEY);
    expect(result.previewBeat).toBe(0);
  });

  it('beatはmaxBeatを超えない', () => {
    const result = computeDragUpdate(baseSingleDrag, 999, 60, 15, 1, C_MAJOR_KEY);
    expect(result.previewBeat).toBe(15);
  });

  it('beatOffsetが考慮される', () => {
    const dragWithOffset: DragState = { ...baseSingleDrag, beatOffset: 0.5 };
    const result = computeDragUpdate(dragWithOffset, 3.5, 60, 15, 1, C_MAJOR_KEY);
    // rawBeat - beatOffset = 3.5 - 0.5 = 3.0, snapped to 1 → 3
    expect(result.previewBeat).toBe(3);
  });

  it('コードドラッグではpitchDeltaが更新される', () => {
    const result = computeDragUpdate(baseChordDrag, 0, 64, 15, 1, C_MAJOR_KEY);
    expect(result.pitchDelta).toBe(4); // 64 - 60
  });

  it('単音ドラッグではpitchDeltaは更新されない', () => {
    const result = computeDragUpdate(baseSingleDrag, 0, 64, 15, 1, C_MAJOR_KEY);
    expect(result.pitchDelta).toBeUndefined();
  });
});

// ── applyDrag ────────────────────────────────────────────────────────────────

describe('applyDrag', () => {
  it('単音ドラッグは指定のノートのみ移動する', () => {
    const drag: DragState = {
      ...baseSingleDrag,
      previewBeat: 2,
      previewSpelledPitch: E4,
      hasMoved: true,
    };
    const result = applyDrag(drag, composition);
    const movedNote = result.voices.flatMap(v => v.notes).find(n => n.id === 'note-c');
    expect(movedNote?.startBeat).toBe(2);
    expect(movedNote?.spelledPitch).toEqual(E4);
    // 他のノートは変化しない
    const untouched = result.voices.flatMap(v => v.notes).find(n => n.id === 'note-e');
    expect(untouched?.startBeat).toBe(0);
  });

  it('コードドラッグはそのchordIdを持つ全ノートを移動する', () => {
    const drag: DragState = {
      ...baseChordDrag,
      previewBeat: 2,         // originalBeat=0 → beatDelta=+2
      pitchDelta: 7,          // 半音7個上（G）
      hasMoved: true,
    };
    const result = applyDrag(drag, composition);
    const notes = result.voices.flatMap(v => v.notes);

    // 和音の3音すべてがbeatDelta=2移動している
    const movedC = notes.find(n => n.id === 'note-c');
    const movedE = notes.find(n => n.id === 'note-e');
    const movedG = notes.find(n => n.id === 'note-g');
    expect(movedC?.startBeat).toBe(2);
    expect(movedE?.startBeat).toBe(2);
    expect(movedG?.startBeat).toBe(2);

    // 自由ノートは変化しない
    const freeMoved = notes.find(n => n.id === 'note-free');
    expect(freeMoved?.startBeat).toBe(2);
  });

  it('コードドラッグでpitchDelta=0の場合、拍だけ移動してピッチは変わらない', () => {
    const drag: DragState = {
      ...baseChordDrag,
      previewBeat: 1,
      pitchDelta: 0,
      hasMoved: true,
    };
    const result = applyDrag(drag, composition);
    const notes = result.voices.flatMap(v => v.notes);
    const movedC = notes.find(n => n.id === 'note-c');
    expect(movedC?.startBeat).toBe(1);
    // MIDI値は変化しない（ピッチデルタ0）
    expect(spelledPitchToMidi(movedC!.spelledPitch)).toBe(60);
  });
});

// ── resolveClickSelection ────────────────────────────────────────────────────

describe('resolveClickSelection', () => {
  it('和音音符をクリックすると和音全体が選択される', () => {
    const result = resolveClickSelection('note-c', composition, null);
    expect(result).toEqual({ kind: 'chord', chordId: CHORD_ID });
  });

  it('自由ノートをクリックするとその音符が選択される', () => {
    const result = resolveClickSelection('note-free', composition, null);
    expect(result).toEqual({ kind: 'note', noteId: 'note-free' });
  });

  it('すでに選択済みの和音をクリックしても選択は変わらない', () => {
    const current: Selection = { kind: 'chord', chordId: CHORD_ID };
    const result = resolveClickSelection('note-c', composition, current);
    expect(result).toBe(current); // 同一参照
  });

  it('和音音符がnote選択されている場合も和音クリックで変化なし', () => {
    const current: Selection = { kind: 'note', noteId: 'note-c' };
    const result = resolveClickSelection('note-c', composition, current);
    expect(result).toBe(current);
  });

  it('すでに選択済みの自由ノートを再クリックしても変化なし', () => {
    const current: Selection = { kind: 'note', noteId: 'note-free' };
    const result = resolveClickSelection('note-free', composition, current);
    expect(result).toBe(current);
  });

  it('存在しないnoteIdはcurrentSelectionをそのまま返す', () => {
    const current: Selection = null;
    const result = resolveClickSelection('nonexistent', composition, current);
    expect(result).toBeNull();
  });
});
