'use client';

import type { KeySignature, NoteLetter, Accidental } from '../../types/song';

interface KeySelectorProps {
  keySignature: KeySignature;
  onKeyChange: (key: KeySignature) => void;
}

type KeyOption = { label: string; tonic: { letter: NoteLetter; accidental: Accidental }; mode: 'major' | 'minor' };

const KEY_OPTIONS: KeyOption[] = [
  { label: 'C major',  tonic: { letter: 'C', accidental:  0 }, mode: 'major' },
  { label: 'G major',  tonic: { letter: 'G', accidental:  0 }, mode: 'major' },
  { label: 'D major',  tonic: { letter: 'D', accidental:  0 }, mode: 'major' },
  { label: 'A major',  tonic: { letter: 'A', accidental:  0 }, mode: 'major' },
  { label: 'E major',  tonic: { letter: 'E', accidental:  0 }, mode: 'major' },
  { label: 'B major',  tonic: { letter: 'B', accidental:  0 }, mode: 'major' },
  { label: 'F♯ major', tonic: { letter: 'F', accidental:  1 }, mode: 'major' },
  { label: 'F major',  tonic: { letter: 'F', accidental:  0 }, mode: 'major' },
  { label: 'B♭ major', tonic: { letter: 'B', accidental: -1 }, mode: 'major' },
  { label: 'E♭ major', tonic: { letter: 'E', accidental: -1 }, mode: 'major' },
  { label: 'A♭ major', tonic: { letter: 'A', accidental: -1 }, mode: 'major' },
  { label: 'D♭ major', tonic: { letter: 'D', accidental: -1 }, mode: 'major' },
  { label: 'A minor',  tonic: { letter: 'A', accidental:  0 }, mode: 'minor' },
  { label: 'E minor',  tonic: { letter: 'E', accidental:  0 }, mode: 'minor' },
  { label: 'B minor',  tonic: { letter: 'B', accidental:  0 }, mode: 'minor' },
  { label: 'F♯ minor', tonic: { letter: 'F', accidental:  1 }, mode: 'minor' },
  { label: 'C♯ minor', tonic: { letter: 'C', accidental:  1 }, mode: 'minor' },
  { label: 'G♯ minor', tonic: { letter: 'G', accidental:  1 }, mode: 'minor' },
  { label: 'D minor',  tonic: { letter: 'D', accidental:  0 }, mode: 'minor' },
  { label: 'G minor',  tonic: { letter: 'G', accidental:  0 }, mode: 'minor' },
  { label: 'C minor',  tonic: { letter: 'C', accidental:  0 }, mode: 'minor' },
  { label: 'F minor',  tonic: { letter: 'F', accidental:  0 }, mode: 'minor' },
  { label: 'B♭ minor', tonic: { letter: 'B', accidental: -1 }, mode: 'minor' },
  { label: 'E♭ minor', tonic: { letter: 'E', accidental: -1 }, mode: 'minor' },
];

const keyToValue = (k: KeySignature): string =>
  `${k.tonic.letter}${k.tonic.accidental}${k.mode}`;

export default function KeySelector({ keySignature, onKeyChange }: KeySelectorProps) {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-400">
      Key
      <select
        value={keyToValue(keySignature)}
        onChange={e => {
          const opt = KEY_OPTIONS.find(o => keyToValue({ tonic: o.tonic, mode: o.mode }) === e.target.value);
          if (opt) onKeyChange({ tonic: opt.tonic, mode: opt.mode });
        }}
        className="bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 text-xs"
      >
        {KEY_OPTIONS.map(opt => (
          <option key={opt.label} value={keyToValue({ tonic: opt.tonic, mode: opt.mode })}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
