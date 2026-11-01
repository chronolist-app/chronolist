# 本番DBのマイグレーション

FlywayはJavaアプリに組み込まず、専用イメージで実行する。
ベースイメージは `redgate/flyway:11.15.0` に固定する。
MySQL Connector/J 9.4.0をSHA-256固定で `/flyway/drivers/` に追加する。
`jdbc:mysql` の `sslMode=VERIFY_IDENTITY` を使うため、付属MariaDBドライバーだけに依存しない。
ビルド時にMaven CentralへのHTTPS接続が必要。取得内容の不一致はビルドエラーとなる。
実行先は任意。ローカルComposeから実行でき、Cloud Run Jobを使う場合は
[Cloud Runの配置例](../../examples/cloud-run/README.md) を参照する。

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

TiDBでは適用前に `SHOW VARIABLES LIKE 'tidb_enable_check_constraint'` を確認する。
OFFのままでは、DDLに記述したCHECK制約が作成・適用されない場合がある。
有効化の権限・影響範囲を管理者と確認し、設定と制約の実体を確認するまでは本番適用へ進まない。
`migrate`・`validate` の成功だけで、DDLに記述した全制約が機能すると判断しない。

## SQLの管理

- `sql/V1__initial_schema.sql` は業務テーブルの初期構築用。
  DROPや開発用サンプルデータは含まない。TIMESTAMPのNULL許容を明示している。
- 以降は `V2__説明.sql`、`V3__説明.sql` のように、重複しない番号付き差分SQLを追加する。
  検証用の架空の差分を本番SQLとして追加しない。
- `sql/V2__add_session_tables.sql` はSpring Session JDBC用の2テーブルと索引を追加する。
  対応Backendのデプロイ前に適用する。既存業務テーブルやV1は変更しない。
  Spring Session 3.5のMySQL標準スキーマを元にしている。
  共有・再起動・期限切れの再実行方法は [共有セッション検証](../verification/README.md) を参照。
  H2の開発スキーマではMySQLのENGINE / ROW_FORMAT指定のみ省略する。
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
再実行・repairしない。実際の接続先でCHECK・外部キー・CASCADE等も確認する。

## デプロイ前の確認

1. 適用先と、既存のスキーマ・Flyway履歴・チェックサムを照合する。初回は空DBであることを確認する。
2. 既存データがある場合はバックアップを取得し、別環境での復元方法・復旧可能時点を確認する。
3. migrationをアプリ更新より先に1回実行し、失敗時は後続デプロイを止める。
4. validate/infoに加え、期待したテーブル・列・索引・制約が存在し、既存データが保持されることを確認する。
5. 対応アプリを更新し、HTTPS経由の認証・CSRF・主要機能を確認する。

## 失敗時の扱い

接続失敗・タイムアウト・DDL失敗を区別し、実行ログ・DB側DDL・履歴・実スキーマを保存する。
待機が中断しても処理中の可能性があるので、同じDBへ並行実行や無条件の再実行をしない。
clean・履歴削除・自動baseline・無条件のrepairは行わない。repairは実スキーマを復元しない。

整合した前進修正を検証環境で確認するか、書き込みを止めて別DBへバックアップを復元する。
復元先のデータ・制約・履歴を確認し、アプリとmigrationの両接続先をそろえて切り替える。
アプリだけを旧版へ戻してもDBは戻らない。旧版のスキーマ・セッション保存形式との互換性を確認する。
業務データ投入後に、空DBへの再構築をデータ復旧の代用にしない。
