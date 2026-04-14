# Agent Rules

## Stack Constraints

- Framework: Next.js
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

## Input Format

- コード入力は Roman numeral 記法で統一（例: `I V vi IV`）
- 生の MIDI ノート番号を UI レイヤーに露出させるな
- ユーザーに見せるピッチ表記は常に spelledPitch ベース（例: F#4, Bb3）

## Diagnostic Output Format

- Problems 出力は Error / Warning / Info の3段階で統一
- 診断結果の型定義を変える場合は schema ファイルを先に更新せよ

## MIDI Export Rules

- Format 1（マルチトラック）を使用。Format 0 は使うな
- ticks/beat は一般的なタプレットを整数で表現できる値（420 or 2520）を使用
- 転調情報は Key Signature Meta Event（FF 59）で埋め込む

## Prohibited Patterns

- エンハーモニック同値を前提としたピッチ比較（Eb === D# のような判定）
- spelledPitch を経由せず MIDI 整数から直接音名を導出すること
- UI コンポーネント内での音楽理論計算（Tonal.js 呼び出しはロジック層に集約）