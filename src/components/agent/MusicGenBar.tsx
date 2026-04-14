'use client';

import { useState } from 'react';
import type { MusicGenState } from '../../types/ui-state';

interface MusicGenBarProps {
  state: MusicGenState;
  onGenerate: (prompt: string) => void;
  onClose: () => void;
}

export default function MusicGenBar({ state, onGenerate, onClose }: MusicGenBarProps) {
  const [prompt, setPrompt] = useState('');
  const isLoading = state.status === 'loading';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt.trim());
  };

  return (
    <div className="flex-shrink-0 border-b border-zinc-700 bg-zinc-850">
      {state.status === 'error' && (
        <div className="px-4 py-1 bg-red-900/40 text-red-400 text-xs border-b border-zinc-700">
          {state.message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs text-purple-400 flex-shrink-0 font-medium">MusicGen</span>
        <div className="relative flex-1">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. calm ambient piano with soft reverb"
            disabled={isLoading}
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          {isLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs animate-pulse">
              ●●●
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-sm text-white transition-colors flex-shrink-0"
        >
          Generate
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-400 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          ✕
        </button>
      </form>
    </div>
  );
}
