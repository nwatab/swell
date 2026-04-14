'use client';

import type { SnapDiv } from '../../lib/snap';

interface SnapSelectorProps {
  snapDiv: SnapDiv;
  triplet: boolean;
  onSnapDivChange: (div: SnapDiv) => void;
  onTripletToggle: () => void;
}

export default function SnapSelector({
  snapDiv,
  triplet,
  onSnapDivChange,
  onTripletToggle,
}: SnapSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {(['1/4', '1/8', '1/16'] as const).map(div => (
        <button
          key={div}
          onClick={() => onSnapDivChange(div)}
          className={[
            'px-2 py-1 rounded text-xs transition-colors font-mono',
            snapDiv === div
              ? 'bg-zinc-500 text-white'
              : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
          ].join(' ')}
        >
          {div}
        </button>
      ))}
      <button
        onClick={onTripletToggle}
        className={[
          'px-2 py-1 rounded text-xs transition-colors font-mono',
          triplet ? 'bg-zinc-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400',
        ].join(' ')}
        title="Triplet"
      >
        T
      </button>
    </div>
  );
}
