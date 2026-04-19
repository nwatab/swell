'use client';

import type { KeySignature, NoteLetter, Accidental, PitchClass } from '../../types/song';

interface KeySelectorProps {
  keySignature: KeySignature;
  onKeyChange: (key: KeySignature) => void;
}

type TonicEntry = {
  major: PitchClass;
  minor: PitchClass;
};

// Indexed by chromatic position 0–11.
// Major uses flat spellings where conventional; minor uses sharp spellings.
// Position 1: major=D♭ (5♭), minor=C♯ (4♯)
// Position 3: major=E♭ (3♭), minor=D♯ (6♯)
// Position 8: major=A♭ (4♭), minor=G♯ (5♯)
const TONIC_ENTRIES: TonicEntry[] = [
  { major: { letter: 'C', accidental: 0 as Accidental },  minor: { letter: 'C', accidental: 0 as Accidental } },
  { major: { letter: 'D', accidental: -1 as Accidental }, minor: { letter: 'C', accidental: 1 as Accidental } },
  { major: { letter: 'D', accidental: 0 as Accidental },  minor: { letter: 'D', accidental: 0 as Accidental } },
  { major: { letter: 'E', accidental: -1 as Accidental }, minor: { letter: 'D', accidental: 1 as Accidental } },
  { major: { letter: 'E', accidental: 0 as Accidental },  minor: { letter: 'E', accidental: 0 as Accidental } },
  { major: { letter: 'F', accidental: 0 as Accidental },  minor: { letter: 'F', accidental: 0 as Accidental } },
  { major: { letter: 'F', accidental: 1 as Accidental },  minor: { letter: 'F', accidental: 1 as Accidental } },
  { major: { letter: 'G', accidental: 0 as Accidental },  minor: { letter: 'G', accidental: 0 as Accidental } },
  { major: { letter: 'A', accidental: -1 as Accidental }, minor: { letter: 'G', accidental: 1 as Accidental } },
  { major: { letter: 'A', accidental: 0 as Accidental },  minor: { letter: 'A', accidental: 0 as Accidental } },
  { major: { letter: 'B', accidental: -1 as Accidental }, minor: { letter: 'B', accidental: -1 as Accidental } },
  { major: { letter: 'B', accidental: 0 as Accidental },  minor: { letter: 'B', accidental: 0 as Accidental } },
];

const PITCH_CLASS: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const tonicIndex = (tonic: PitchClass): number =>
  (PITCH_CLASS[tonic.letter] + tonic.accidental + 12) % 12;

const toLabel = (pc: PitchClass): string => {
  const acc = pc.accidental === 1 ? '♯' : pc.accidental === -1 ? '♭' : '';
  return `${pc.letter}${acc}`;
};

const selectClass = 'bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 text-xs';

export default function KeySelector({ keySignature, onKeyChange }: KeySelectorProps) {
  const currentIndex = tonicIndex(keySignature.tonic);
  const currentMode = keySignature.mode;

  const handleTonicChange = (index: number) => {
    const entry = TONIC_ENTRIES[index];
    const tonic = currentMode === 'major' ? entry.major : entry.minor;
    onKeyChange({ tonic, mode: currentMode });
  };

  const handleModeChange = (mode: 'major' | 'minor') => {
    const entry = TONIC_ENTRIES[currentIndex];
    const tonic = mode === 'major' ? entry.major : entry.minor;
    onKeyChange({ tonic, mode });
  };

  return (
    <div className="flex items-center gap-1 text-xs text-zinc-400">
      Key
      <select
        value={currentIndex}
        onChange={e => handleTonicChange(Number(e.target.value))}
        className={selectClass}
      >
        {TONIC_ENTRIES.map((entry, i) => {
          const pc = currentMode === 'major' ? entry.major : entry.minor;
          return (
            <option key={i} value={i}>
              {toLabel(pc)}
            </option>
          );
        })}
      </select>
      <select
        value={currentMode}
        onChange={e => handleModeChange(e.target.value as 'major' | 'minor')}
        className={selectClass}
      >
        <option value="major">Major</option>
        <option value="minor">minor</option>
      </select>
    </div>
  );
}
