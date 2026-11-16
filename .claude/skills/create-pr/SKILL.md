---
name: create-pr
description: 指定したブランチから Chronolist の PR を作成する。既存 PR は本文を更新する。
argument-hint: <source-branch> [--base <branch>] [--ticket CHRON-123]
disable-model-invocation: true
---

このファイルは Claude Code 用の入口。リポジトリルートの
`.agents/skills/create-pr/SKILL.md` を読み、その全手順に従う。
入力は `$ARGUMENTS`。共有スキル内の相対参照は `.agents/skills/create-pr/` を基準に解決する。
共有ファイルを読めなければ停止・報告する。
