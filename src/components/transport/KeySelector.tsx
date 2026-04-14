'use client';

import type { KeySignature } from '../../types/song';
import { PITCH_CLASS_NAMES } from '../../types/song';

interface KeySelectorProps {
  globalKey: KeySignature | null;
  onGlobalKeyChange: (key: KeySignature | null) => void;
}

export default function KeySelector({ globalKey, onGlobalKeyChange }: KeySelectorProps) {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-400">
      Key
      <select
        value={globalKey ? `${globalKey.root}-${globalKey.mode}` : ''}
        onChange={e => {
          if (!e.target.value) { onGlobalKeyChange(null); return; }
          const sep = e.target.value.lastIndexOf('-');
          const root = e.target.value.slice(0, sep) as KeySignature['root'];
          const mode = e.target.value.slice(sep + 1) as KeySignature['mode'];
          onGlobalKeyChange({ root, mode });
        }}
        className="bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-zinc-200 text-xs"
      >
        <option value="">—</option>
        {PITCH_CLASS_NAMES.map(root => (
          <optgroup key={root} label={root}>
            <option value={`${root}-major`}>{root} major</option>
            <option value={`${root}-minor`}>{root} minor</option>
          </optgroup>
        ))}
      </select>
    </label>
  );
}
