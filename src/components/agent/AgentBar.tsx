'use client';

import { useState, useRef, useEffect } from 'react';
import type { SuggestionState } from '../../types/ui-state';

interface AgentBarProps {
  suggestion: SuggestionState;
  onSubmit: (instruction: string) => void;
  onAccept: () => void;
  onReject: () => void;
}

export default function AgentBar({ suggestion, onSubmit, onAccept, onReject }: AgentBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || suggestion.status === 'loading') return;
    onSubmit(text.trim());
    setText('');
  };

  // Keyboard shortcut: Enter to accept, Escape to reject when suggestion is ready
  useEffect(() => {
    if (suggestion.status !== 'ready') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT') {
        onAccept();
      }
      if (e.key === 'Escape') onReject();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [suggestion.status, onAccept, onReject]);

  return (
    <div className="flex-shrink-0 border-t border-zinc-700 bg-zinc-900">
      {/* Diff legend when suggestion is ready */}
      {suggestion.status === 'ready' && (
        <div className="flex items-center gap-6 px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-xs">
          <span className="text-zinc-400">Review suggestion:</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
            Added {suggestion.diff.added.length}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500/60" />
            Removed {suggestion.diff.removed.length}
          </span>
          {suggestion.diff.modified.length > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500/70" />
              Modified {suggestion.diff.modified.length}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onAccept}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Accept (Enter)
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1 rounded bg-zinc-600 hover:bg-zinc-500 text-white transition-colors"
            >
              Reject (Esc)
            </button>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              suggestion.status === 'loading'
                ? 'Claude is thinking…'
                : 'Enter instructions (e.g. Add a melody in C major, create a I-IV-V-I chord progression)'
            }
            disabled={suggestion.status === 'loading'}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400 disabled:opacity-50"
          />
          {suggestion.status === 'loading' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs animate-pulse">
              ●●●
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={suggestion.status === 'loading' || !text.trim()}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm text-white transition-colors flex-shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
