'use client';

import { useState } from 'react';

interface TrackNameInputProps {
  name: string;
  color: string;
  onRename: (name: string) => void;
}

export default function TrackNameInput({ name, color, onRename }: TrackNameInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onRename(draft || name); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { onRename(draft || name); setEditing(false); }
          if (e.key === 'Escape') { setDraft(name); setEditing(false); }
          e.stopPropagation();
        }}
        onClick={e => e.stopPropagation()}
        className="w-14 bg-zinc-800 rounded px-0.5 outline-none text-xs"
        style={{ color }}
      />
    );
  }

  return (
    <span
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(name); }}
      title="Double-click to rename"
      className="select-none"
    >
      {name}
    </span>
  );
}
