@AGENTS.md

## Project Overview

**Swell** — 音楽理論を学びながらLLM対話（vibe composing）で作曲するWebツール。
既存DAWにないvibe composing要素と音楽理論の制約を統合した作曲体験を提供する。

- 入力: Roman numeral記法 / 自然言語vibe / ピアノロール直接編集
- 出力: MIDI Format 1（GarageBand互換）/ swell独自JSON
- 詳細要件: `docs/REQUIREMENTS.md`
- 設計判断記録: `docs/ADR/`

## Architecture

2層構造:

- **Generative layer**: vibe入力・コード進行 → 4声部配置 → MIDI生成
- **Analytical layer**: ハーモニー診断（voice leading, 並行5度等）

診断UXは VSCode Problems tab に準拠（Error / Warning / Info + Quick Fix）。
静的ルールで確定的禁則を検出し、LLMが文脈依存のQuick Fixを提案するハイブリッド方式。

## Internal Data Model

正準形は**記譜表現（SpelledNote）**。MIDIはエクスポート形式に徹する。

```
spelledPitch: { letter, accidental, octave }  ← 正準形
pitch: number                                  ← 導出値（spelledPitchから計算）
isDiatonic: boolean                            ← 導出値（spelledPitch + keyから計算）
originalMidi: number                           ← 安全弁（設計安定後に削除検討）
```

詳細は `docs/ADR/001-spelled-note-as-canonical-form.md` を参照。

## Current Phase

プロトタイピング段階。内部表現は機能追加に伴い変更の可能性あり。

## Dev Notes

- ブラウザ内試聴はTone.jsで実装済み
- LLMへの楽譜情報の渡し方（notes JSON → コード進行変換）は未確定
- MusicGen統合は試行したが conditioning精度に課題あり