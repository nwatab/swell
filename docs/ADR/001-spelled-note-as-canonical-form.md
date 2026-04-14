# ADR-001: SpelledNote を内部データの正準形とする

## Status

Accepted（プロトタイピング段階、変更の可能性あり）

## Context

ピアノロール・和声診断・調性変換など、ほぼすべての機能が「ピッチをどう表現するか」に依存する。
表現の選択肢は大きく2つ:

1. **MIDI整数**（0〜127）: Z/12Z の商集合。エンハーモニック同値（Eb = D# = 63）
2. **SpelledNote**（letter + accidental + octave）: エンハーモニック同値を割らない。Eb ≠ D#

## Decision

**SpelledNote を正準形とし、MIDI整数は導出値・エクスポート形式として扱う。**

```typescript
type SpelledPitch = {
  letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  accidental: number; // -2=bb, -1=b, 0=natural, 1=#, 2=##
  octave: number;
};
```

MIDI pitch は `spelledPitchToMidi(sp)` で常に導出する。

## Consequences

**得られるもの:**

- 和声診断で Eb と D# を区別できる（機能和声で意味が異なる）
- 調性変換が SpelledNote 空間上の全単射として定義できる（ADR-002 参照）
- ダイアトニック判定が spelledPitch + key から純粋に計算可能
- ピアノロールの表示で正しい臨時記号を出せる
- isDiatonic, pitch などの冗長フィールドが不要になる（導出可能）

**コスト:**

- MIDI インポート時に pitch spelling problem（MIDI整数 → SpelledNote の推定）が発生する。
  当面は全音符を non-diatonic 扱いにして回避する。
- 既存の MIDI ベースのライブラリ（Tone.js 等）とのインターフェースで変換が必要
- データサイズがやや増加（整数1つ → オブジェクト1つ）

## Notes

- 音楽情報検索（MIR）分野では pitch spelling problem として知られる（Meredith, 2006）
- Tonal.js は内部的に spelled pitch を扱っており、SpelledNote との相互変換は比較的容易