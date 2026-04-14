# ADR-002: 調性変換の可逆性保証

## Status

Accepted（プロトタイピング段階、変更の可能性あり）

## Context

ユーザーが key を D major → A major → F# minor → D major と変換したとき、
元の音符配置が完全に復元される必要がある。

変換には2種類が混在する:

| 変換種別 | 定義 | 全単射か |
|---------|------|---------|
| クロマチック転調（N半音シフト） | 全音符を N 半音シフト | 無条件に全単射 |
| モーダル変換（major ↔ minor） | 各音度を対応付け | ダイアトニック音のみなら全単射 |

問題はモーダル変換における非ダイアトニック音。MIDI 整数空間では E(64) と Eb(63) の
変換先が衝突し得るが、SpelledNote 空間では letter + accidental が異なるため衝突しない。

## Decision

**SpelledNote 空間上で変換を定義する。**

### ダイアトニック音の変換

音度（scale degree）を保って変換先の調の対応する音に写す。

```
D major:  D  E  F# G  A  B  C#    (音度 1 2 3 4 5 6 7)
D minor:  D  E  F  G  A  Bb C     (音度 1 2 3 4 5 6 7)

D major の F#（音度3）→ D minor の F（音度3）
```

### 非ダイアトニック音の変換

key の差分（半音オフセット）のみ適用する。SpelledNote の accidental を調整。

```
D major 上の Eb（非ダイアトニック）→ D minor 上の Eb（オフセット 0、そのまま）
C major → G major: Eb → Bb（5半音シフト、letter + accidental 調整）
```

### originalMidi の扱い

安全弁として `originalMidi`（音符作成時の MIDI pitch、以降不変）を保持する。
SpelledNote 空間での変換が全単射であるため理論上は不要だが、
非ダイアトニック音のモーダル変換ルールが未確定のエッジケースがあるため、
設計が安定するまで残す。安定後に削除を検討する。

## Consequences

**得られるもの:**

- X → Y → Z → X のサイクルで元の音符が完全に復元される
- C major ↔ C# minor のような根音もモードも異なる変換でも可逆
- ユーザーが安心して調を試行錯誤できる

**コスト:**

- SpelledNote 空間での変換ロジックの実装が MIDI 整数のシフトより複雑
- 非ダイアトニック音のモーダル変換ルールの詳細設計が残っている

**未解決:**

- 非ダイアトニック音のモーダル変換で、letter をどう対応させるかの詳細ルール
  （例: D major の Eb → D minor では？ Eb のまま？ D# に読み替え？）
- エンハーモニック的に「正しい」spelling の選択基準