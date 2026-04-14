'use client';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export default function ZoomControls({ onZoomIn, onZoomOut, canZoomIn, canZoomOut }: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 text-sm transition-colors"
        title="Zoom out"
      >
        −
      </button>
      <button
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className="w-7 h-7 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-zinc-300 text-sm transition-colors"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );
}
