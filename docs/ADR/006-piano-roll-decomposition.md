# ADR-006: PianoRoll の3層分離（lib / hooks / components）

## Status

Accepted

## Context

`PianoRoll.tsx` が 1496行に肥大化し、以下の責務が単一ファイルに混在していた:

- レイアウト定数・座標変換（純粋な計算）
- 音楽ドメインロジック: コード構築・ストリーム操作・ノートCRUD（純粋関数）
- Import/Export（純粋関数）
- React 状態管理: song, playback, zoom, drag, suggestion（useState + useCallback）
- DOM イベントハンドリング: window mousemove/mouseup（useEffect）
- 7つのサブコンポーネント定義（プレゼンテーション）
- メインコンポーネントのレンダリング

問題:

1. **テスト不能**: 音楽ロジックが React コンポーネント内にあるため、ロジック単体のテストが書けない
2. **変更の波及**: コード構築ロジックの修正が PianoRoll 全体の再レンダリングに影響する
3. **認知負荷**: 1496行のファイルで変更箇所を特定するコストが高い
4. **再利用不能**: ストリーム操作・スナップ計算などが PianoRoll に閉じており、他のコンポーネントから使えない

## Decision

**3層アーキテクチャに分離する。**

```
lib/          純粋関数のみ。React 依存禁止。単体テスト対象
    ↓ import
hooks/        状態管理。lib/ の純粋関数と components/ の橋渡し
    ↓ return value
components/   プレゼンテーションのみ。props で受け取って描画する
```

PianoRoll.tsx はコンテナとして hooks を呼び出し、子コンポーネントに props を渡すだけの薄いファイル（~60行）にする。

### 検討した代替案

**A: Context API で状態を共有**

`CompositionContext` を作り、Provider 配下の子コンポーネントが直接 consume する方式。

却下理由: Context の値が変わると Provider 配下の全コンポーネントが再レンダリングされる。ピアノロールのように高頻度で更新される UI（ドラッグ中の毎フレーム更新）では性能問題になる。hooks + props の方が再レンダリング範囲を制御しやすい。

**B: 状態管理ライブラリ（Zustand / Jotai）導入**

却下理由: 現時点では単一画面・単一コンポーネントツリーのアプリケーション。hooks で十分に管理できる規模であり、外部依存の追加は過剰。規模が拡大した場合に再検討する。

**C: 分割せず PianoRoll.tsx 内でリージョン分け**

コメントやリージョンで区切るだけで、ファイルは分割しない。

却下理由: テスト不能の問題が解決しない。Code Style で functional programming と単一責務を掲げている以上、ファイル分割が整合的。

## Consequences

**得られるもの:**

- `lib/music/` の関数が単体テスト可能になる
- コンポーネントの変更がロジックに波及しない（逆も同様）
- 音楽ロジック（chord.ts, stream.ts, note-operations.ts）が他の画面・機能から再利用可能
- PianoRoll.tsx が ~60行になり、構造が一目で把握できる

**コスト:**

- ファイル数が増加する（1ファイル → 約25ファイル）
- import パスが深くなる（`../../lib/music/note-operations` 等）
- hooks 間の依存関係の設計が必要（useNoteInteraction が useComposition と useZoom に依存する等）

## Directory Structure

```
src/
├── components/
│   ├── piano-roll/       # Grid, NoteBlock, NoteLayer, Keyboard, BeatHeader, Playhead, layout.ts
│   ├── transport/        # TransportBar, SnapSelector, ChordSelector, KeySelector, ZoomControls
│   ├── streams/          # StreamsBar, StreamNameInput
│   ├── agent/            # AgentBar, MusicGenBar
│   └── diagnostics/      # ProblemsPanel
├── hooks/                # useComposition, usePlayback, useNoteInteraction, useAgentSuggestion, useMusicGen, useZoom, useDiagnostics
├── lib/
│   ├── music/            # chord.ts, stream.ts, note-operations.ts
│   ├── swell-format/     # serialize.ts, deserialize.ts
│   ├── harmony.ts        # (既存)
│   ├── audio.ts          # (既存)
│   ├── snap.ts
│   └── diff.ts
└── types/
    ├── song.ts           # (既存)
    └── ui-state.ts       # SnapDiv, ChordType, SuggestionState, DragState, MusicGenState
```

## Notes

- 各層の制約は AGENTS.md の Directory Rules / Component Composition Rules に記載
- リファクタリングは依存の葉（types → lib → components → hooks → PianoRoll縮小）の順で実行