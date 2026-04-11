@AGENTS.md

## Project Overview
GaradebandのようなVerticalなキーボードをUIとした、WEB作曲ツール。自然言語で指示を与えることで、コード進行の相談や、編集を行うことができる。Garageband互換の出力やMIDI出力と和声診断を行うことが可能。

## Architecture

- Generative layer: コード進行 → MIDI生成
- Analytical layer: ハーモニー診断（voice leading, 並行5度等）
andothers

## Features
- 和声の禁則に反するものは、Error / Warning / Infoのようにして、VSCodeのようにProblemsに表示。
