'use client';

import { useState, useRef, useEffect } from 'react';
import type { SuggestionState, ChatEntry } from '../../types/ui-state';

interface AgentBarProps {
  suggestion: SuggestionState;
  history: ChatEntry[];
  onSubmit: (instruction: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onClearHistory: () => void;
}

export default function AgentBar({ suggestion, history, onSubmit, onAccept, onReject, onClearHistory }: AgentBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || suggestion.status === 'loading') return;
    onSubmit(text.trim());
    setText('');
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

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
    <div className="flex flex-col w-80 border-l border-zinc-700 bg-zinc-900 flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 flex-shrink-0">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Chat</span>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {history.length === 0 && (
          <p className="text-xs text-zinc-600 text-center mt-6">
            Send instructions to Claude to modify your composition.
          </p>
        )}
        {history.map(entry => (
          <ChatEntryView key={entry.id} entry={entry} onAccept={onAccept} onReject={onReject} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-700 p-3 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={suggestion.status === 'loading' ? 'Claude is thinking…' : 'Instructions…'}
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
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm text-white transition-colors flex-shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatEntryView({ entry, onAccept, onReject }: {
  entry: ChatEntry;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (entry.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] px-3 py-2 rounded-lg bg-blue-700 text-sm text-white break-words">
          {entry.text}
        </div>
      </div>
    );
  }

  if (entry.status === 'loading') {
    return (
      <div className="flex justify-start">
        <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-400 animate-pulse">
          ●●●
        </div>
      </div>
    );
  }

  if (entry.status === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] px-3 py-2 rounded-lg bg-red-900/50 border border-red-700 text-xs text-red-300 break-words">
          Error: {entry.message}
        </div>
      </div>
    );
  }

  if (entry.status === 'ready') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] space-y-2">
          <div className="px-3 py-2 rounded-lg bg-zinc-800 text-xs">
            <div className="flex gap-3">
              {entry.diff.added.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                  +{entry.diff.added.length}
                </span>
              )}
              {entry.diff.removed.length > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" />
                  −{entry.diff.removed.length}
                </span>
              )}
              {entry.diff.modified.length > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <span className="w-2 h-2 rounded-sm bg-yellow-500/70 inline-block" />
                  ~{entry.diff.modified.length}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="flex-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-2 py-1 rounded bg-zinc-600 hover:bg-zinc-500 text-white text-xs transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (entry.status === 'accepted') {
    return (
      <div className="flex justify-start">
        <div className="px-3 py-2 rounded-lg bg-zinc-800 text-xs text-emerald-400">
          ✓ Accepted
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="px-3 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-500">
        Rejected
      </div>
    </div>
  );
}
