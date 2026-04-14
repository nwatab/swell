'use client';

import { useState } from 'react';
import type { Diagnostic } from '../../lib/harmony';

const SEVERITY_ICON: Record<Diagnostic['severity'], string> = {
  error:   '●',
  warning: '▲',
  info:    'ℹ',
};

const SEVERITY_COLOR: Record<Diagnostic['severity'], string> = {
  error:   'text-red-400',
  warning: 'text-yellow-400',
  info:    'text-blue-400',
};

interface ProblemsPanelProps {
  diagnostics: readonly Diagnostic[];
  open: boolean;
  onToggle: () => void;
}

export default function ProblemsPanel({ diagnostics, open, onToggle }: ProblemsPanelProps) {
  const errors   = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  const infos    = diagnostics.filter(d => d.severity === 'info').length;

  return (
    <div className="flex-shrink-0 border-t border-zinc-700 bg-zinc-900">
      {/* Header bar */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
      >
        <span className="font-medium text-zinc-300">Problems</span>
        {errors > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <span>●</span>{errors}
          </span>
        )}
        {warnings > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <span>▲</span>{warnings}
          </span>
        )}
        {infos > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <span>ℹ</span>{infos}
          </span>
        )}
        {diagnostics.length === 0 && <span className="text-zinc-600">No issues</span>}
        <span className="ml-auto text-zinc-600">{open ? '▾' : '▸'}</span>
      </button>

      {/* List */}
      {open && (
        <div className="max-h-40 overflow-y-auto border-t border-zinc-800">
          {diagnostics.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-600">No harmony issues detected.</div>
          ) : (
            diagnostics.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-4 py-1.5 text-xs border-b border-zinc-800 last:border-0 hover:bg-zinc-800"
              >
                <span className={`flex-shrink-0 mt-px ${SEVERITY_COLOR[d.severity]}`}>
                  {SEVERITY_ICON[d.severity]}
                </span>
                <span className="text-zinc-300 flex-1">{d.message}</span>
                <span className="flex-shrink-0 text-zinc-600 font-mono">beat {d.beat + 1}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
