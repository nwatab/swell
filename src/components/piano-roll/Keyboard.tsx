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
  CHORD_HEADER_H,
  DEGREE_HEADER_H,
} from './layout';

function WhiteKey({ pitch, idx, globalKey, onKeyClick }: { pitch: number; idx: number; globalKey: KeySignature; onKeyClick: (midi: number) => void }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute w-full flex items-center px-1 text-[10px] border-b select-none bg-zinc-100 text-zinc-500 border-zinc-300 cursor-pointer active:bg-zinc-300"
      style={{ top: idx * WHITE_H, height: WHITE_H }}
      onMouseDown={() => onKeyClick(pitch)}
    >
      <span className="flex-1 font-semibold">{roman ?? ''}</span>
      <span className="text-[9px]">{pitch % 12 === 0 ? pitchName(pitch) : ''}</span>
    </div>
  );
}

function BlackKey({ pitch, globalKey, onKeyClick }: { pitch: number; globalKey: KeySignature; onKeyClick: (midi: number) => void }) {
  const roman = romanNumeral(pitch, globalKey);
  return (
    <div
      className="absolute flex items-center pl-1 text-[9px] select-none bg-zinc-800 text-zinc-400 rounded-r z-10 cursor-pointer active:bg-zinc-600"
      style={{ top: pitchY(pitch), height: BLACK_H, left: 0, width: Math.round(KEY_W * 0.72) }}
      onMouseDown={e => { e.stopPropagation(); onKeyClick(pitch); }}
    >
      {roman && <span className="font-semibold">{roman}</span>}
    </div>
  );
}

interface KeyboardProps {
  globalKey: KeySignature;
  scrollRef: RefObject<HTMLDivElement | null>;
  onKeyClick: (midi: number) => void;
}

export default function Keyboard({ globalKey, scrollRef, onKeyClick }: KeyboardProps) {
  return (
    <div
      ref={scrollRef}
      className="flex-shrink-0 overflow-hidden border-r border-zinc-700"
      style={{ width: KEY_W }}
    >
      <div style={{ height: DEGREE_HEADER_H + CHORD_HEADER_H + HEADER_H }} className="bg-zinc-800 border-b border-zinc-600" />
      <div className="relative" style={{ height: NUM_WHITE_KEYS * WHITE_H }}>
        {[...WHITE_INDEX.entries()].map(([pitch, idx]) => (
          <WhiteKey key={pitch} pitch={pitch} idx={idx} globalKey={globalKey} onKeyClick={onKeyClick} />
        ))}
        {PITCHES.filter(isBlack).map(pitch => (
          <BlackKey key={pitch} pitch={pitch} globalKey={globalKey} onKeyClick={onKeyClick} />
        ))}
      </div>
    </div>
  );
}
