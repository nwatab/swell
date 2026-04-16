# ADR-008: NoteBinding — 作者意図の明示化

## Status

Accepted（プロトタイピング段階）

## Context

ADR-001 が SpelledPitch を正準形として確立し、ADR-002 が調性変換の可逆性を保証している。
しかし、同じ SpelledPitch `E4` であっても、それが：

1. **絶対ピッチ** として意図された音（key が変わっても E4 のまま保持）
2. **スケール音度** として意図された音（key が変わればその音度の音に追従）
3. **コードトーン** として意図された音（chord が変わればそのコードの同じ役割に追従）

かによって、調性変換時の振る舞いが異なるべきだ。

### 具体例: C major → C minor

| 音符 | 作者の意図 | 変換後 |
|------|-----------|--------|
| E4   | 絶対ピッチ | E4（bIII の 3rd として解釈） |
| E4   | スケール音度3番 | Eb4（minor の 3rd） |
| E4   | I コードの 3rd | Eb4（C minor の I の 3rd） |

ADR-002 は推論ベースでダイアトニック音を変換するため、曖昧性が残る。
NoteBinding は作者意図を宣言することで一意に変換先を決定できる。

## Decision

**`Note` に `binding?: NoteBinding` フィールドを追加し、作者意図を明示化する。**

```typescript
export type NoteRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ninth';

export type NoteBinding =
  | { readonly kind: 'absolute' }
  | { readonly kind: 'chord_tone'; readonly chordId: string; readonly role: NoteRole; readonly alteration: number }
  | { readonly kind: 'scale_degree'; readonly degree: 1|2|3|4|5|6|7; readonly alteration: number };
```

### binding の意味

**`absolute`**: このピッチは絶対値として保持。調性変換でも変わらない。
- 用途: クロマチック経過音、固定ペダルポイント、意図的な借用音

**`chord_tone`**: 特定のコード（`chordId`）の `role` の位置に属するコードトーン。
コードの root が変わればそれに追従する。`alteration` は root からの半音修飾。
- 用途: I の 3rd（古典的和声のメインケース）、V7 の 7th など

**`scale_degree`**: キーのスケールの `degree` 番に対応する音。
key が変わればその音度の音に変換される。`alteration` は音度からの半音修飾。
- 用途: モーダル音楽（Dorian、Mixolydian 等）でのスケールトーン

### SpelledPitch の役割変化

NoteBinding 導入後の SpelledPitch の位置づけ：

| binding | SpelledPitch の役割 |
|---------|-------------------|
| `absolute` | 一次データ（ADR-001 の定義通り） |
| `chord_tone` / `scale_degree` | binding + context からの**派生値のキャッシュ** |

ADR-001 の「記譜の正準形」という役割は保たれるが、「意図の正準形」は NoteBinding に移管される。

### binding が未設定の場合（後方互換）

省略可能フィールド。未設定の場合は ADR-002 のフォールバック動作が適用される：
- ダイアトニック音 → 音度対応で変換（実質的に `scale_degree` として扱われる）
- クロマチック音 → 半音オフセットのみ適用（実質的に `absolute` として扱われる）

### Chord エンティティ

`chord_tone` binding が参照する `chordId` は、`Composition` の `chords` 配列内のエントリを指す。

```typescript
export interface Chord {
  readonly id: string;
  readonly romanNumeral: string;     // 'I', 'ii', 'V7', 'viio', 'bII' など
  readonly startBeat: number;
  readonly durationBeats: number;
  readonly root: SpelledPitch;       // context 内の実際のルート音
  readonly quality: ChordQuality;
  readonly inversion: 0 | 1 | 2 | 3; // 根音位置=0、第1転回=1、第2転回=2、第3転回=3
}
```

### コード入力フロー（F03）

```
ユーザー: "I  V  vi  IV"
      ↓
システム: Chord エンティティ生成 (root = key から導出)
      ↓
SATB voice assignment: 各声部の音に chord_tone binding を設定
      ↓
SpelledPitch はキャッシュとして保持（表示・MIDI出力用）
```

## LLM 表現への効果（ADR-005）

NoteBinding により、ADR-005 Option A（Notes → コード進行変換）が tractable になる：

```
// Before NoteBinding
{ "spelledPitch": {"letter":"E","accidental":0,"octave":4}, "startBeat":0 }
// LLM にとって意味が不明

// After NoteBinding (chord_tone)
beat 1 [C major: I/T]  S=E4(3rd) A=C4(root) T=G3(5th) B=C3(root)
beat 2 [G major: V/D]  S=D5(5th) A=B4(3rd) T=G3(root) B=G2(root)
// コード構造が明確
```

## NoteFunction（ADR-007）との関係

NoteBinding と NoteFunction は直交する概念：

| 概念 | 層 | 設定者 | 意味 |
|------|---|------|------|
| `NoteBinding` | Generative | 作者（ユーザー） | この音を何として意図したか |
| `NoteFunction` | Analytical | 解析エンジン | この音が和声上どう機能しているか |

両者が不一致の場合、それ自体が診断情報となる可能性がある。
例: `chord_tone` と宣言されているが解析では `passing_tone` と判定される場合。

## Consequences

**得られるもの:**

- 調性変換の振る舞いが予測可能（宣言的、推論不要）
- LLM への楽譜情報渡しが tractable に（ADR-005 Option A の実現）
- コード認識の精度問題から独立（binding は宣言であり推論結果ではない）
- 転回形・voicing の情報が binding から読み取れる

**コスト:**

- chord-first ワークフロー（F03）の実装が binding 設定と連動する
- 直接ピアノロール編集では `binding` が自動設定されない（`absolute` がデフォルト）
- binding のないレガシー音符との混在を考慮した変換ロジックが必要

## 関連 ADR

- ADR-001: SpelledNote 正準形（SpelledPitch の役割を一部再定義）
- ADR-002: 調性変換の可逆性（binding が未設定の場合のフォールバック動作）
- ADR-005: LLM への楽譜情報の渡し方（chord_tone binding で Option A が tractable に）
- ADR-007: NoteFunction（Analytical layer の出力 — NoteBinding とは直交）

## Notes

- `scale_degree` binding は modal music（Dorian、Mixolydian 等）で主に使用
- Classical/functional harmony では `chord_tone` が主な binding
- 経過音等のクロマチック非和声音: `absolute` binding + NoteFunction（ADR-007）での機能分類
- 将来: secondary dominant の chord_tone（V/V の 3rd 等）も表現可能
- 将来: `chord_tone` binding で 借用和音（mode mixture）の声部追跡も可能
