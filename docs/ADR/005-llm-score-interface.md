# ADR-005: LLM への楽譜情報の渡し方

## Status

**Open** — 設計未確定。プロトタイピングで検証が必要。

## Context

ユーザーが「このコード進行をもっと暗くして」「3小節目に代理和音を入れて」と相談する際、
LLM は現在の楽譜状態を理解する必要がある。

現在の内部表現（notes JSON）をそのまま LLM に渡す場合の問題:

```json
[
  { "spelledPitch": {"letter":"D","accidental":0,"octave":4}, "startBeat":1, "durationBeats":1 },
  { "spelledPitch": {"letter":"F","accidental":1,"octave":4}, "startBeat":1, "durationBeats":1 },
  { "spelledPitch": {"letter":"A","accidental":0,"octave":4}, "startBeat":1, "durationBeats":1 }
]
```

LLM にとって「これは D major トライアドである」という認識が即座にできない。
コード進行の文脈（I → V → vi → IV）はさらに読み取りにくい。

## Options Under Consideration

### Option A: Notes → コード進行変換レイヤー

LLM に渡す前に notes を分析し、コード進行表現に変換する。

```
入力方向: notes → chord analysis → "D: I - V - vi - IV" → LLM
出力方向: LLM → "I - V7 - vi - IV" → chord-to-notes expansion → notes
```

利点: LLM が最も得意な形式で受け取れる。トークン効率が良い。
課題: コード認識の精度（転回形、非和声音の扱い）。双方向パイプラインの実装コスト。

### Option B: 要約表現の併記

notes JSON に加えて、人間/LLM 可読な要約を併記する。

```json
{
  "summary": "D major, 4/4, 120bpm | m1: D(I) | m2: A(V) | m3: Bm(vi) | m4: G(IV)",
  "notes": [...]
}
```

利点: 実装が比較的容易。notes の完全性を維持しつつ LLM にコンテキストを渡せる。
課題: summary と notes の同期をどう保証するか。

### Option C: LLM に直接コード認識させる

notes JSON をそのまま渡し、LLM 側でコード認識・分析させる。

利点: 変換ロジックの実装不要。
課題: トークン消費が大きい。LLM の認識精度がボトルネック。レイテンシ。

## Preliminary Recommendation

Option A を基本とし、認識に失敗したケース（コードとして解析不能な音の集まり）では
Option B のフォールバックを使う段階的アプローチ。

ただしプロトタイピングで各 Option の実用性を検証してから決定する。