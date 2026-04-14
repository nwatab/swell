# Agent Rules

## Stack Constraints

- Framework: Next.js (App Router)
- Audio playback: Tone.js のみ。Web Audio API を直接叩くな
- Music theory logic: Tonal.js のみ。音程計算・スケール生成を独自実装するな
- Notation rendering: VexFlow のみ
- LLM calls: Claude API（claude-sonnet-4-20250514）経由のみ

## Architecture Rules

- Generative layer と Analytical layer は必ず分離すること
- ハーモニー診断ロジックをMIDI生成コードに混在させるな
- 確定的な禁則（並行5度等）は静的ルールで実装。LLMに判定させるな
- LLMは文脈依存のQuick Fix提案・vibe解釈・トレードオフ説明に使う

## Data Model Rules

- 内部の正準形は SpelledNote（letter + accidental + octave）。MIDI整数を正準形として扱うな
- pitch（MIDI整数）は spelledPitch からの導出値。直接編集するな
- MIDI はエクスポート形式。内部処理で MIDI pitch を比較・演算に使うな
- 新しいフィールドを追加する前に、既存フィールドから導出可能でないか確認せよ

## Directory Rules

- `lib/` には純粋関数のみ置く。React の import 禁止。副作用禁止。単体テスト対象
- `hooks/` は lib/ の純粋関数と components/ を橋渡しする。状態管理はここに集約
- `components/` はプレゼンテーションのみ。ビジネスロジック禁止。props で受け取って描画する
- `types/` は型定義のみ。ロジック禁止

## Component Composition Rules

- コンテナコンポーネント（PianoRoll.tsx 等）は hooks 呼び出し + 子コンポーネント合成のみ。ロジックを書くな
- 1ファイル200行を超えたら責務の分離を検討せよ
- イベントハンドラのロジックは hooks に置く。コンポーネント内で useCallback + 複雑なロジック を書くな
- window イベントリスナー（mousemove, mouseup 等）は専用 hook に隔離する
- useMemo / useCallback の依存配列が4つ以上になったら hook の分割を検討せよ

## Input Format

- コード入力は Roman numeral 記法で統一（例: `I V vi IV`）
- 生の MIDI ノート番号を UI レイヤーに露出させるな
- ユーザーに見せるピッチ表記は常に spelledPitch ベース（例: F#4, Bb3）

## Diagnostic Output Format

- Problems 出力は Error / Warning / Info の3段階で統一
- 診断結果の型定義を変える場合は schema ファイルを先に更新せよ

## MIDI Export Rules

- Format 1（マルチトラック）を使用。Format 0 は使うな
- ticks/beat は 480（三連符対応）を基本値とする
- 転調情報は Key Signature Meta Event（FF 59）で埋め込む

## Prohibited Patterns

- エンハーモニック同値を前提としたピッチ比較（Eb === D# のような判定）
- spelledPitch を経由せず MIDI 整数から直接音名を導出すること
- UI コンポーネント内での音楽理論計算（lib/ 経由で hooks/ に集約）
- 1つのコンポーネントファイルに複数の export されるコンポーネントを定義すること
- hooks/ から直接 DOM を操作すること（ref 経由で components/ に委譲）