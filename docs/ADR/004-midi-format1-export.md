# ADR-004: MIDI Format 1 エクスポートと Key Signature Meta Event

## Status

Accepted

## Context

GarageBand への出力が主要なエクスポート先。MIDI には Format 0（単一トラック）と
Format 1（マルチトラック）がある。

また、調性情報をMIDIファイルに埋め込む手段として Key Signature Meta Event が存在する。

## Decision

### Format 1（マルチトラック）を採用

```
Track 0: テンポトラック（テンポ・拍子・Key Signature Meta Event）
Track 1〜N: 声部トラック（SATB、将来的にメロディトラック追加）
```

Format 0 ではすべてのイベントが1トラックに混在し、GarageBand でのチャンネル分離が不自然になる。

### Key Signature Meta Event の挿入

転調点ごとに Key Signature Meta Event を Track 0 に挿入する。

```
FF 59 02 [sf] [mi]
sf: シャープ/フラット数（符号付き、-7〜+7）
    例: G major / E minor = +1, F major / D minor = -1
mi: 0 = major, 1 = minor
```

GarageBand はこのイベントを読み取り、楽譜表示の調号に反映する。

### ticks/beat の設定

一般的なタプレット（三連符、五連符等）を整数 tick で表現するため、
ticks/beat は LCM ベースの値を使用する。

- 基本: 480（三連符まで対応）
- 拡張: 2520（17連符まで対応、LCM(1..10) に基づく）

当面は 480 で十分。

## Consequences

**得られるもの:**

- GarageBand でトラックが自然に分離される
- 調号が GarageBand の楽譜表示に正しく反映される
- 将来のメロディトラック追加がトラック追加で対応可能

**コスト:**

- Format 1 の生成ロジックが Format 0 よりやや複雑
- Key Signature Meta Event の sf 値計算が必要