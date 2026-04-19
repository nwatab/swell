# ADR-009: 音符列が一次データであり、和音帰属はオプショナルなアノテーションである

## Status

Accepted

## Context

Swell は「和音入力」と「個別音符入力」の2つの入力経路を持つ。

和音入力（コード進行 → SATB展開）では、各音符がどのコードのどの音度に属するかが確定している。
個別音符入力（ピアノロール直接編集）では、音符は和音ラベルなしに存在する。

ここで設計上の問題が生じる: 和音帰属（`chordId`）を`Note`の**必須フィールド**にしてしまうと、
個別音符入力が「不正な状態」として扱われ、ピアノロール直接編集が二級市民になる。

## Decision

**音符列は一次データである。和音帰属（`NoteBinding.chord_tone`の`chordId`）はオプショナルなアノテーションである。**

```typescript
// NoteBinding（ADR-008）は Note のオプショナルフィールド
export interface Note {
  readonly id: string;
  readonly spelledPitch: SpelledPitch;
  readonly startBeat: number;
  readonly duration: NoteDuration;
  readonly binding?: NoteBinding; // ← オプショナル。なくても有効な Note
}
```

`chordId`は`NoteBinding`の`chord_tone`バリアントの内部フィールドであり、
`binding`自体がオプショナルであるため、`chordId`は二重の意味でオプショナルになる。

### 和音帰属の意味

`binding`フィールドの有無は入力モードを表してはならない。

| 状態 | 意味 |
|------|------|
| `binding: { kind: 'chord_tone', chordId, role }` | 確定した和音帰属——作者が「このコードのこの音度として置いた」と宣言した |
| `binding: undefined` | 未確定——個別入力、または将来の解析エンジンが補完する余地がある |

### 診断の2モード

`binding`の有無によってリンターの振る舞いを分ける:

- **`binding`あり** → 厳密な診断（voice-leading、声部交差、倍音規則など）
- **`binding`なし** → 推定ベースの診断（Warningレベルにとどめる）

### 個別音符入力の正当性

`chordId`がない音符を不正な状態として弾いてはならない。
楽譜がコードラベルなしで成立するのと同様に、音符列は和音ラベルなしで完結した情報である。

Analytical層が将来的に`binding`を推定で補完する経路を確保しておく（PoC段階では未実装）。

## Consequences

**得られるもの:**
- ピアノロール直接編集が一級市民として扱われる
- 将来の「解析エンジンによる和音帰属の自動補完」経路が確保される
- `chordId`必須化への意図しない退行を防ぐ

**コスト:**
- `binding`なし音符への診断は推定ベースになり、精度が下がる

## 却下した代替案

**和音と音符を対等な2レイヤーとして設計する案**（却下）

和音と音符を同等の存在として並列に持ち、それぞれが独立したデータとして管理する設計。
音符列の一次性を損なうため却下。音符を和音の「子」にすると個別入力の正当性が失われる。

## 関連 ADR

- ADR-008: NoteBinding（`chord_tone`バリアントが`chordId`を保持）
- ADR-007: NoteFunction（Analytical層の出力——NoteBindingとは直交）
- ADR-003: ハイブリッド診断アプローチ（診断の2モード化の根拠）
