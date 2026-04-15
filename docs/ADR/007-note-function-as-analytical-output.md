# ADR-007: NoteFunction を Analytical layer の出力とする

## Status

Accepted（プロトタイピング段階、変更の可能性あり）

## Context

ADR-001 で `isDiatonic` という語の多義性が問題になった。

- **意味1（Scale membership）**: ある音が現在の調のスケールに含まれるか。`spelledPitch + key` から常に導出可能 → `Note` フィールド不要。
- **意味2（Harmonic function）**: コードトーン・経過音・刺繍音などの機能。ビート上の和声文脈（他の声部との関係、前後の動き）を解析して初めて確定できる。

意味2 の情報は `Note` 構造体に収めることができない。理由:

1. **依存方向の逆転**: `Note` は Generative layer のデータ。和声機能の判定には他の `Note` との関係が必要であり、単一 `Note` の属性ではない。
2. **更新コスト**: 一音を追加・移動するたびに周辺音すべての機能を再計算して `Note` を書き換えるのはコストが高く、かつバグを招く。
3. **分離原則**: データ（`Composition`）と解析結果（`Analytical layer`）は分離すべき。`Composition` は常に「純粋なデータ」として扱いたい。

## Decision

**`NoteFunction` を Analytical layer の出力として定義し、`Map<noteId, NoteFunction>` で保持する。`Note` フィールドには追加しない。**

```typescript
export type NoteFunction =
  | 'chord_tone'
  | 'passing_tone'
  | 'neighbor_tone'
  | 'suspension'
  | 'appoggiatura'
  | 'chromatic'
  | 'unanalyzed';

export type NoteFunctionMap = ReadonlyMap<string, NoteFunction>;
```

`computeNoteFunctions(composition: Composition): NoteFunctionMap` が解析エントリポイント。
`useDiagnostics` hook が `analyzeHarmony` と合わせて `noteFunctions` を返す。

## Consequences

**得られるもの:**

- `Composition` / `Note` の構造がシンプルに保たれる（Analytical layer の出力で汚染されない）
- `NoteFunction` の計算はメモ化（`useMemo`）できる。`Composition` が変わらない限り再計算不要
- 将来の精緻化（機械学習ベースの機能検出など）が `Composition` 型に影響しない
- `NoteFunction` を表示レイヤ（ピアノロールの色分けなど）から切り離せる

**コスト:**

- `Note` から直接 `note.isDiatonic` のように参照できない。`noteFunctions.get(note.id)` が必要
- `computeNoteFunctions` の初期実装は簡易（同時発音があれば `chord_tone`、そうでなければ `chromatic` or `unanalyzed`）。精度は将来改善予定

## 初期実装の制限

現在の `computeNoteFunctions` は:

- 同時発音（オーバーラップする音）を `chord_tone` と見なす
- 単音かつ非ダイアトニックを `chromatic`、それ以外を `unanalyzed` とする
- `passing_tone`、`neighbor_tone`、`suspension`、`appoggiatura` の判定は未実装（`unanalyzed` が返る）

## Notes

- Analytical layer の他の出力（`Diagnostic`、平行5度・8度など）と同じ設計思想に従う（ADR-005 参照）
- `isDiatonic`（意味1、scale membership）の除去については ADR-001 を参照
