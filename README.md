# Chronolist

ToDo、予定、タイムブロッキングを扱うWebアプリ。FrontendはReact / TypeScript / Vite、
BackendはJava 25 / Spring Bootで構成する。

## 開発環境を起動する

Docker Composeでリポジトリルートから実行する。

```sh
docker compose up -d --build backend frontend
```

Frontendは `http://localhost:5173`、Backendは `http://localhost:8080`。
開発用H2はBackend再起動で初期化される。開発環境に本番DBやクラウドのSecretは不要。

## 設定・テスト

- [Backend](backend/README.md)：プロファイル、DB・認証設定、Dockerビルドと起動
- [Frontend](frontend/README.md)：API URL、Nginx転送、ビルドと検証方法
- [DB migration](backend/flyway/README.md)：Flywayの独立実行、SQL管理、TiDBの前提
- [APIテスト](backend/src/test/README.md)：テストの追加・実行・保証範囲
- [TiDB共有セッション検証](backend/verification/README.md)：外部DBでの明示的な結合検証

## 配置先を選ぶ

本番用Dockerイメージは特定のホスティングサービスを必要としない。
現在のprod設定はTiDB Cloud向けのMySQL接続を使い、セッションも共有DBへ保存する。
DBスキーマはアプリ起動前にFlywayで用意する。本番のCookie認証にはHTTPSと、
公開Origin・CORS・信頼するプロキシの設定が必要。任意のDBや構成での互換性を保証するものではない。

[Cloud Runへの配置例](examples/cloud-run/README.md)には、NginxとBackendの2コンテナと
Flyway Jobを使う方法を掲載する。Cloud Runの利用はアプリの必須条件ではない。
実環境の識別情報、費用や運用判断、個別リリースの実施記録は、このリポジトリの利用手順に含めない。
