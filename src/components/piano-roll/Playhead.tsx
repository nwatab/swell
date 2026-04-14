'use client';

interface PlayheadProps {
  beat: number;
  cellW: number;
}

export default function Playhead({ beat, cellW }: PlayheadProps) {
  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-400 z-20 pointer-events-none"
      style={{ left: beat * cellW }}
    />
  );
}
