# 本番DBのマイグレーション

FlywayはJavaアプリに組み込まず、専用イメージで実行する。
ベースイメージは `redgate/flyway:11.15.0` に固定する。
TiDB Cloud実機との互換性確認（初期構築・再実行・差分適用）はステップ3で実施する。
Cloud Run Jobの設定とバックアップ・実行・復旧・アプリデプロイ前の手順は
[CLOUD_RUN.md](CLOUD_RUN.md) を参照。実機での確認状況も同ファイルに記録する。

## 実行

空の検証用データベースをあらかじめ用意し、接続情報を環境変数で渡す。
認証情報はイメージや追跡対象ファイルに保存しない。

- `FLYWAY_URL`: `jdbc:mysql://<host>:4000/<database>?sslMode=VERIFY_IDENTITY`
- `FLYWAY_USER`: TiDB Cloudのユーザー名
- `FLYWAY_PASSWORD`: TiDB Cloudのパスワード

リポジトリルートから実行する。

```sh
docker compose build flyway
docker compose run --rm flyway info
docker compose run --rm flyway migrate
docker compose run --rm flyway validate
```

`migration`プロファイルに属するため、通常の `docker compose up` では起動しない。
サービス名を明示した `run` ではプロファイル指定なしで実行できる。
接続変数が未設定でも開発用Composeは使えるが、Flywayのmigrateは接続情報不足で失敗する。
イメージ単体では環境変数を渡して `docker run --rm --env FLYWAY_URL --env FLYWAY_USER
--env FLYWAY_PASSWORD <image> migrate` でも実行できる。

## SQLの管理

- `sql/V1__initial_schema.sql` はCHRON-125のスキーマを元にした初期構築用。
  DROPや開発用サンプルデータは含まない。TIMESTAMPのNULL許容を明示している。
- 以降は `V2__説明.sql`、`V3__説明.sql` のように、重複しない番号付き差分SQLを追加する。
  検証用の架空の差分を本番SQLとして追加しない。
- 一度いずれかの共有環境へ適用したSQLは編集・削除・改名しない。
  Flywayの履歴テーブルとチェックサムで適用済みSQLを管理する。
- スキーマ変更時は同じ変更で開発用 `src/main/resources/schema.sql` も更新する。
  新規DBへ全マイグレーションを適用した最終状態と、開発スキーマのテーブル・列・
  制約が一致するようレビューする。DB方言差は理由を記録する。
  開発用DROPとdata.sqlは本番マイグレーションへコピーしない。
- 旧アプリが稼働した状態でも使える追加変更を先行させ、削除・名前変更は段階的に行う。
- `clean` は無効。既存スキーマの自動baselineも無効。
  既存DBに履歴がない場合はそのまま適用せず、別途移行計画を作成する。

TiDBはDDL全体をトランザクションとして取り消せないため、適用失敗後に無条件で
再実行・repairしない。実機の制約対応（CHECK・外部キー・CASCADE等）もステップ3で確認する。

## ステップ2での検証結果

- 専用イメージのビルド、Flyway Community Edition 11.15.0のCLI起動に成功。
  TiDBプラグインの同梱を確認。
- 使い捨てH2（MySQLモード）でV1のmigrate・validate・infoに成功。
  これはSQL同梱とFlyway実行の検証であり、TiDB互換性の証明ではない。
- 開発schema.sqlとの比較で、DROPの除外とTIMESTAMPのNULL明示以外のDDLが一致。
- Composeの通常サービス一覧にflywayが含まれず、migrationプロファイルでのみ含まれることを確認。

## ステップ3での接続確認（2026-10-22）

- `feature/CHRON-145-db-initialization` で専用イメージのビルドに成功。
- 実行環境に `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` が空でない値として
  存在することを確認。値は表示・記録していない。
- URLは指定のTiDBホスト、ポート4000、`sslMode=VERIFY_IDENTITY`、DB名指定を
  満たすことを値の出力なしで確認。
- `docker compose run --rm flyway -connectRetries=0 info` はFlyway 11.15.0で起動したが、
  `UnknownHostException`（SQL State `08000`、終了コード1）で接続に失敗。
  コンテナ外の実行環境でも同じホストのDNS解決に失敗した。
  TLS・認証・DB状態は未確認。
- 環境のネットワークポリシーではTiDBホストはHTTP許可一覧に存在するが、
  `tcp_network_access.domains` と `ip_ranges` は空。
  指定のTCP CONNECTプロキシへの診断接続も `ConnectionRefusedError` となった。
  HTTPのドメイン許可だけではMySQL用TCP接続が可能とは判断できない。
- `migrate` は未実行。初期構築・再実行・差分適用・データ保持の検証は未着手。

再開には、実行環境の設定でTiDBホストのTCP接続（4000番ポート）を許可し、
対応する名前解決とTCP接続経路が利用可能になっていることを確認する。
環境への設定反映後、環境変数の存在確認と `info` を再実行し、接続成功後に
検証DBの状態を確認してから初期構築へ進む。
