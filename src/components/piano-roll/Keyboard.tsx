'use client';

import type { RefObject } from 'react';
import type { KeySignature } from '../../types/song';
import { romanNumeral } from '../../lib/harmony';
import {
  WHITE_INDEX,
  PITCHES,
  isBlack,
  pitchY,
  pitchName,
  WHITE_H,
  BLACK_H,
  KEY_W,
  NUM_WHITE_KEYS,
  HEADER_H,
} from './layout';

function WhiteKey({ pitch, idx, globalKey }: { pitch: number; idx: number; globalKey: KeySignature }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute w-full flex items-center px-1 text-[10px] border-b select-none bg-zinc-100 text-zinc-500 border-zinc-300"
      style={{ top: idx * WHITE_H, height: WHITE_H }}
    >
      <span className="flex-1 font-semibold">{roman ?? ''}</span>
      <span className="text-[9px]">{pitch % 12 === 0 ? pitchName(pitch) : ''}</span>
    </div>
  );
}

function BlackKey({ pitch, globalKey }: { pitch: number; globalKey: KeySignature }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute flex items-center pl-1 text-[9px] select-none bg-zinc-800 text-zinc-400 rounded-r z-10"
      style={{ top: pitchY(pitch), height: BLACK_H, left: 0, width: Math.round(KEY_W * 0.72) }}
    >
      {roman && <span className="font-semibold">{roman}</span>}
    </div>
  );
}

interface KeyboardProps {
  globalKey: KeySignature;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export default function Keyboard({ globalKey, scrollRef }: KeyboardProps) {
  return (
    <div
      ref={scrollRef}
      className="flex-shrink-0 overflow-hidden border-r border-zinc-700"
      style={{ width: KEY_W }}
    >
      <div style={{ height: HEADER_H }} className="bg-zinc-800 border-b border-zinc-600" />
      <div className="relative" style={{ height: NUM_WHITE_KEYS * WHITE_H }}>
        {[...WHITE_INDEX.entries()].map(([pitch, idx]) => (
          <WhiteKey key={pitch} pitch={pitch} idx={idx} globalKey={globalKey} />
        ))}
        {PITCHES.filter(isBlack).map(pitch => (
          <BlackKey key={pitch} pitch={pitch} globalKey={globalKey} />
        ))}
      </div>
    </div>
  );
}
