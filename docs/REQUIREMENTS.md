# Swell — 要件定義書

## プロジェクト概要

音楽理論を学びつつ、LLMとの対話（vibe composing）を通じて実践的に作曲するWebツール。
既存DAW（GarageBandなど）にはvibe composing要素がなく自由度が高すぎるため、
音楽理論の制約とAI支援を統合した作曲体験を提供する。

---

## 機能要件

### F01: 調性（Key）設定

グローバル調性（root + mode）を設定できること。

転調サポート: 小節単位で転調点を追加できるハイブリッド方式。
デフォルトはグローバル調性、小節クリックで転調点を追加する。
内部表現は `{ bar: 9, key: 'E', mode: 'minor' }` の配列。
MIDIエクスポート時に転調情報を Key Signature Meta Event として埋め込む。

### F02: 調性変換（Key Transposition）

ダイアトニック音は major/minor 間で音度対応に基づき変換する。
非ダイアトニック音は key の差分（半音オフセット）のみ適用する。

可逆性の保証: SpelledNote 空間での変換は全単射（letter + accidental の整数軸上の平行移動）。
根音やモードが異なる変換（例: C major ↔ C# minor）を経ても楽譜空間の要素が一対一対応で復元可能であること。

設計判断の詳細は `ADR/002-key-transposition-reversibility.md` を参照。

### F03: 和音入力

ドミソなどのトライアド、7th、9thなどの和音を簡単に入力できること。
key に合ったダイアトニックコードをワンクリックで配置できること。
Roman numeral 記法（`I V vi IV`）による入力をサポートすること。

### F04: 4声部配置（SATB）

コードをソプラノ・アルト・テナー・バスの4声部に配置して作成できること。
ストリーム（stream）単位で声部を管理する。

### F05: クラシック音楽の禁則バリデーション

voice leading 違反、並行5度・並行8度などを検出すること。
VSCode Problems tab 形式の診断UI（Error / Warning / Info）で表示すること。

静的ルールロジックで確定的な禁則を検出する。
文脈依存の修正提案（Quick Fix）は Claude API が担当するハイブリッド方式。

### F06: オートコンプリート（サジェスト）

次のコードや音符の配置をサジェストすること。
key とコンテキスト（直前のコード進行）に基づく候補提示。

### F07: コード表示

各小節にコード名を表示すること。
コード機能（T/S/D/P）のカラーコーディングで表示すること。

TSD の計算は spelledPitch + key からコード認識 → 音度判定 → 機能分類の順で導出する。
ダイアトニックのトライアド＋7th はルールベース、判定不能なケースは LLM に委ねる。

### F08: ピアノロール表示

ピアノロール形式で表示すること。
ドミソなどの和音は等間隔に並ぶ団子のように表示すること。
ダイアトニック音とスケール外音を視覚的に区別すること。

### F09: LLMとの対話（Vibe Composing）

#### F09a: 自然言語からの生成

テキストvibe入力（例:「melancholic rainy night」「4小節目で緊張感を持たせて解放したい」）からコード進行を生成すること。
会話形式の反復修正（「もっと暗く」「3小節目だけテンション上げて」）をサポートすること。

#### F09b: 楽譜についての相談

LLM に楽譜の追加・削除・修正を相談できること。
チャットUIで自然に質問・回答できること。

課題: 現在の notes JSON をそのまま LLM に渡してもコード進行として処理しにくい。
notes → コード進行（Roman numeral 等）への変換レイヤーが必要。
LLM に渡す前に楽譜情報をコード進行表現に変換し、LLM の応答を再び notes に展開する双方向パイプラインを要検討。

#### F09c: トレードオフ・理論解説

LLM の出力に tradeoffs フィールドを持たせ、設計判断の根拠を表示すること。
例: 「なぜ Dorian ではなく Natural Minor か」「ii-V-I の解決タイミングの選択理由」

#### F09d: 会話履歴の保持

assistant message に完全な composition JSON を保存し、Claude API が前回を参照して修正できること。

課題: JSON をそのまま参照してもコード進行が読みにくい。
LLM 向けの要約表現（Roman numeral 列等）を併記する設計を要検討。

### F10: ブラウザ内試聴

Tone.js によるブラウザ上での直接再生。（実装済み）

### F11: Import / Export

Export:
- MIDI Format 1（マルチトラック）: GarageBand 互換
- Swell 独自形式（JSON）: 完全な記譜表現を保持

Import:
- Swell 独自形式（JSON）: 完全復元
- MIDI: インポート時はすべての音符を non-diatonic 扱いとする（pitch spelling problem 回避）

---

## 将来的な拡張

### E01: メロディトラック生成

Claude API に melody 配列を出力させ、MIDI トラックとして追加する。
トラック機能の拡張が必要。4声部は1トラック内で管理するか、トラックとして分離するか、
3声部で和音を構成するケースも含めた柔軟な設計を要検討。

### E02: スタイルモード設定（Linter Config）

厳格対位法 / 機能和声 / ポップス理論など、モードによって診断 severity の閾値を変える。
ESLint の設定ファイルに相当するイメージ。

### E03: テンション曲線の可視化

各小節の tension 値（0.0〜1.0）を折れ線グラフで表示する。
コード機能カラーコーディング（F07）と連動する。

### E04: Neural Renderer 統合

MusicGen 等の neural audio codec を Layer 2 として接続し、スタジオクオリティの wav 出力を実現する。
現状の課題: Replit で MusicGen API を試したが、元の楽曲とかけ離れた出力になる。
melody conditioning の精度向上が必要。

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フレームワーク | Next.js |
| 音声再生 | Tone.js |
| 音楽理論ロジック | Tonal.js |
| 楽譜描画 | VexFlow |
| LLM | Claude API（claude-sonnet-4-20250514） |
| DAWターゲット | GarageBand（MIDI Import） |