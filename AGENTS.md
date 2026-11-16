# Chronolist 開発ガイド

## 1. プロジェクト概要

ToDo・予定・タイムブロッキングを扱う Web アプリ。全体の入口は [README.md](README.md)。

- `frontend/`: React 19 / TypeScript / Vite。機能別の実装は `src/feature/`。
- `backend/`: Java 25 / Spring Boot 3.5 / MyBatis / Spring Security。実装は `src/main/`、API 統合テストは `src/test/`。
- 開発・テスト DB は H2、本番は TiDB Cloud（MySQL 接続）。本番スキーマは `backend/flyway/` で管理する。
- `compose.yaml`・`.devcontainer/`: 開発環境。`examples/cloud-run/`: 配置例。`.github/workflows/`: CI・リリース設定。

## 2. 開発規約

コーディング規約の正本は Confluence の
[コーディング規約](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5963809)。
変更対象の言語に関する規約を参照し、詳細はこのファイルに転載しない。
既存コードの構成・責務分担を尊重し、実装・検証時は
[ESLint 設定](frontend/eslint.config.js)、[TypeScript 設定](frontend/tsconfig.app.json)、
[API テストの追加規約](backend/src/test/README.md)、各ディレクトリの README も参照する。

依頼範囲外の不具合を見つけた場合は、影響・再現条件を報告し、無断で修正範囲を広げない。
認証情報や実環境の秘密情報をコード・ログ・作業メモに保存しない。

### コミットメッセージ

- 件名・本文は日本語で記述する。識別子や技術用語は原表記でよい。
- `feat:`、`fix:` などの Prefix は付けない。
- 件名は変更内容が伝わる短い文章にする。
- 件名の後に空行を入れ、変更内容を簡潔な箇条書きで網羅する。
  ファイルごとの編集履歴ではなく、意味のある変更単位で記述する。

### マージコミット

- ブランチをマージする際は、必ず `--no-ff` を使用してマージコミットを作成する。
- 件名には、そのブランチの対応 Jira チケット番号とチケット名を記載する。
- 本文には、ブランチ全体の変更内容を簡潔な箇条書きで網羅する。
- GitHub 上でもマージコミットを作成する方式を使い、
  squash merge・rebase merge は使用しない。

## 3. 情報源と優先順位

- [Jira CHRON プロジェクト](https://magu.atlassian.net/jira/software/projects/CHRON): 対象チケットの要求・完了条件・進捗。
- [Confluence Chronolist スペース](https://magu.atlassian.net/wiki/spaces/Chronolist): 設計・仕様・作業メモ。
- [要件定義](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5963800): プロジェクト全体の要件を参照する。
- 正式仕様書の入口は [Apps](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/3342337)。
  各アプリの仕様は [ToDoList 仕様書](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5963777)、
  [Scheduler 仕様書](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/3342394)、
  [Timeblocking 仕様書](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/3309608)、
  [User 仕様書](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5931020) を参照する。
- リポジトリの実装・設定・README は現状の挙動と開発・検証方法の根拠。作業メモは正式仕様書の代替にしない。

原則、対象 Jira チケットの要求を既存仕様書より優先する。矛盾があり、仕様書更新が
チケットの完了条件に含まれない場合は、矛盾箇所と変更要求を必ず報告し、勝手に仕様書を更新しない。
資料へアクセスできない場合はその旨を報告し、未確認の要求や仕様を推測で補完しない。

## 4. 作業メモ

[Confluence「開発memo」](https://magu.atlassian.net/wiki/spaces/Chronolist/folder/132116) に、
原則1チケット1ドキュメントで残す。冒頭に関連チケット番号と Jira URL を明示する。
本文形式・粒度は自由で、作業計画・調査仮説・些細な備忘録も記録できる。
エージェントは自律的に作成・追記してよく、毎回の承認は不要。
同じチケットの既存メモへの追記を優先し、新規作成した際は Jira にリンクを残す。
Jira コメントには進捗・結論・作業結果を共有する。

## 5. 開発環境・ツール

起動は [ルート README](README.md#開発環境を起動する)、詳細は
[Backend](backend/README.md)、[Frontend](frontend/README.md)、[Flyway](backend/flyway/README.md) を参照する。
通常の開発に本番 DB・クラウド Secret は不要。dev の H2 は再起動で初期化される。

検証コマンドの正本は [CI](.github/workflows/ci.yml) と各 README。
Backend は Java 25 で `backend/` から `sh ./gradlew test bootJar --no-daemon`。
Frontend は Node.js 24 で `frontend/` から `npm ci`、`npm run lint`、`npm test`、`npm run build`。
Compose 内の Backend テストは [API テスト手順](backend/src/test/README.md) のプロファイル除外方法に従う。
[ローカル HTTPS](frontend/README.md#転送設定とローカルhttpsの検証) と
[TiDB 共有セッション](backend/verification/README.md) の検証範囲は区別し、未実施を成功と報告しない。

共通ルールはこのファイルを正本とする。Codex は `AGENTS.md`、Claude Code は対応版の直接読み込み、
または `CLAUDE.md` のインポートで参照する。ツールの設定と利用可能な専用スキルは
[エージェント利用案内](docs/agent-tools.md) を参照する。個別ワークフローは専用スキルに委ねる。
