@AGENTS.md

## Project Overview

**Swell** — 音楽理論を学びながらLLM対話（vibe composing）で作曲するWebツール。
既存DAWにないvibe composing要素と音楽理論の制約を統合した作曲体験を提供する。

- 入力: Roman numeral記法 / 自然言語vibe / ピアノロール直接編集
- 出力: MIDI Format 1（GarageBand互換）/ swell独自JSON
- 詳細要件: `docs/REQUIREMENTS.md`
- 設計判断記録: `docs/ADR/`
- リファクタリング計画: `docs/REFACTORING-PLAN.md`

## Architecture

2層構造:

- **Generative layer**: vibe入力・コード進行 → 4声部配置 → MIDI生成
- **Analytical layer**: ハーモニー診断（voice leading, 並行5度等）

診断UXは VSCode Problems tab に準拠（Error / Warning / Info + Quick Fix）。
静的ルールで確定的禁則を検出し、LLMが文脈依存のQuick Fixを提案するハイブリッド方式。

## Directory Structure

```
src/
├── components/
│   ├── piano-roll/          # ピアノロール描画。PianoRoll.tsxは合成のみ (~60行)
│   │   ├── PianoRoll.tsx    # hooks呼び出し + コンポーネント合成
│   │   ├── Grid.tsx         # 行背景 + 垂直グリッド線
│   │   ├── NoteBlock.tsx    # 個別ノート描画
│   │   ├── NoteLayer.tsx    # ノート群 + diff overlay + drag preview
│   │   ├── Keyboard.tsx     # ピアノ鍵盤列
│   │   ├── BeatHeader.tsx   # 小節/拍ヘッダー
│   │   ├── Playhead.tsx     # 再生カーソル
│   │   └── layout.ts       # レイアウト定数 + pitchY/yToPitch（React依存なし）
│   ├── transport/           # ツールバー系UI
│   ├── streams/             # ストリーム管理UI
│   ├── agent/               # AgentBar, MusicGenBar
│   └── diagnostics/         # ProblemsPanel
├── hooks/                   # 状態管理。lib/の純粋関数とcomponents/の橋渡し
│   ├── useComposition.ts    # song状態、BPM/key変更、import/export
│   ├── usePlayback.ts       # AudioContext、play/stop、playhead
│   ├── useNoteInteraction.ts # drag、click-to-add/delete
│   ├── useAgentSuggestion.ts
│   ├── useMusicGen.ts
│   ├── useZoom.ts
│   └── useDiagnostics.ts
├── lib/                     # 純粋関数のみ。React依存禁止。単体テスト対象
│   ├── music/               # 音楽ドメインロジック
│   │   ├── chord.ts         # コードタイプ・インターバル定義
│   │   ├── note-operations.ts # ノート追加・移動・転調・和音展開
│   │   ├── voice.ts         # 声部単位のノート操作（add/remove/move/find）
│   │   └── score-repr.ts    # Composition → LLM可読テキスト変換
│   ├── swell-format/        # Import/Export
│   ├── harmony.ts           # 和声分析（既存）
│   ├── snap.ts
│   ├── diff.ts
│   ├── audio.ts             # Web Audio API ユーティリティ
│   └── id.ts                # ID生成
└── types/
    ├── song.ts              # Composition, Voice, Note, SpelledPitch 等
    ├── ui-state.ts          # SnapDiv, ChordType, SuggestionState, DragState, MusicGenState
    └── app-state.ts         # AppState（複数Composition管理）
```

## Internal Data Model

正準形は**記譜表現（SpelledNote）**。MIDIはエクスポート形式に徹する。

```
spelledPitch: { letter, accidental, octave }  ← 正準形
pitch: number                                  ← 導出値
```

詳細は `docs/ADR/001-spelled-note-as-canonical-form.md` を参照。

## Dev Notes

- LLMへの楽譜情報の渡し方は `score-repr.ts` の `compositionToText()` で実装済み
- MusicGen統合は試行したが conditioning精度に課題あり