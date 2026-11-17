# エージェント向けブラウザ検証の実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CHRON-217 / CHRON-219 のローカル専用ブラウザ検証を再現可能にする。

**Architecture:** CHRON-218 の worktree 別 Compose を使用し、実 API とヘッドレス Chromium を Playwright Test で操作する。ユーザーは実行時生成し認証状態を再利用しない。結果は worktree 内で URL と実行ごとに分離する。

**Tech Stack:** Node.js 24、TypeScript、Playwright Test、既存 Compose / H2。

**Spec:** CHRON-217 の承認済み設計・ユーザー追加要求（成功時の trace / screenshot 保存を選択可能にする）。

## Global Constraints

- スキル設計、本番インフラ、全機能 E2E、CI 全体の再設計は対象外。
- 検証専用の `*.localhost` URL だけを許可し、通常のアカウント・実環境を使用しない。
- 日本語の開発文書・TSDoc、非 component の TypeScript は kebab-case とする。
- ステージ・コミットと環境起動・複数 worktree 検証は親エージェントが担当する。

## Review Focus

- URL 未指定・不正 URL・実環境 URL は起動前に拒否する。
- peer の片側指定、同じホスト指定は隔離確認にならないため拒否する。
- 誤った artifact 設定は暗黙に無視せず拒否する。
- H2 再起動後も毎回ユーザーと初期 ToDo を再作成する。
- 成功・失敗とも結果ディレクトリを上書きしない。

### Task 1: 設定と成果物の分離

**Files:** `frontend/e2e/environment.ts`, `frontend/tests/e2e-environment.test.ts`, `frontend/playwright.config.ts`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/.gitignore`

**Interfaces:** `loadE2eEnvironment(env, generatedEnv)` は検証対象 URL、任意の peer URL、成果物保存方針を返す。

- [x] URL・peer・保存方針のテストを先に書き、未実装で失敗することを確認する。
- [x] 設定を実装し `npm test` で成功を確認する。
- [x] Playwright 依存・設定・コマンドと生成物の ignore を追加する。

### Task 2: 実ブラウザの smoke と隔離検証

**Files:** `frontend/e2e/fixtures.ts`, `frontend/e2e/smoke.spec.ts`, `frontend/e2e/isolation.spec.ts`, `docs/browser-verification.md`, `frontend/README.md`

**Interfaces:** fixture は実行時ユーザーを登録し、UI でログイン、実 API で初期 ToDo を作成する。

- [x] smoke の期待をテストとして記述する（主要 3 画面、ToDo 作成・リロード永続化）。
- [x] fixture を実装する。ネットワーク・API の mock は使用しない。
- [x] peer 指定時は同一ブラウザ context で両 URL を使い、未認証・ユーザー・データの分離を検証する。
- [x] セットアップ・起動・実行・成果物・終了・制約を日本語で記録する。
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e -- --list` を実行する。
- [x] 親エージェントがコンテナ環境で成功・意図的失敗・2 worktree の隔離を確認する。

## 実装記録

- 判断: 設計と実装方法は既にユーザー承認済みのため、計画の再承認は求めず実装する。
- 合意: 成功時の trace / screenshot は設定または実行オプションで保存可能にする。常時保存は必須とせず、スキル設計は対象外とする。
- 設定テスト: 未実装の import 失敗を確認後、5件 PASS。Frontend 単体テスト全72件 PASS。
- Frontend 全体 lint はエラー0件・既存の警告11件、build PASS。追加 E2E / config の TypeScript 型検査 PASS。Playwright の `--list` は2件を列挙。
- Backend は Java 25 で `test bootJar` PASS（20 suites / 199 tests、失敗・エラー・skip 各0件）。既存 scripts テストは17件中、プラットフォーム依存の2件を skip し、残り15件 PASS。
- 新規 worktree A / B とも `npm ci` 成功。それぞれ2件の E2E を並行実行し、両環境とも PASS。
- A の `all` 保存方針では trace 2件・screenshot 3件とレポートを確認。B の `failures` 保存方針では成功時 trace 0件を確認。
- API URL を未使用ポートへ向けた意図的失敗で終了コード1となり、trace / screenshot が保存されることを確認。
- A の logout・stop・restart 中にも B の認証・データが保持されることを確認。
- A 再起動後の H2 初期化と古いユーザーでのログイン401を確認し、その間も B の認証・データ保持を確認。A の `destroy` 後も B の認証・データが保持された。A の検証環境は削除済み。
- 判断: Windows Node では `*.localhost` の DNS 解決に失敗するため、準備・照合 API もブラウザ内 fetch を使用する。恒久 hosts 編集は不要で、CORS と Cookie も実経路で検証する。
- worker ごとの結果先再生成を検出し、実行 ID の環境変数継承で修正。再現テストの未実装失敗→成功を確認した。
- E2E 証跡は Git と Docker ビルドコンテキストから除外し、認証情報を含み得る trace / screenshot のイメージ混入を防ぐ。
