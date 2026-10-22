# 本番DBのマイグレーション

FlywayはJavaアプリに組み込まず、専用イメージで実行する。
ベースイメージは `redgate/flyway:11.15.0` に固定する。
TiDB Cloud実機での初期構築・再実行・差分適用の結果と互換性上の残課題は、
末尾のローカル検証記録を参照。CHECK制約が欠落する問題があり、実機互換性の確認は未完了。
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

TiDBでは適用前に `SHOW VARIABLES LIKE 'tidb_enable_check_constraint'` を確認する。
2026-10-22の検証ではOFFで、V1のCHECK制約が作成されなかった。
有効化の権限・影響範囲を管理者と確認し、設定と制約の実体を確認するまでは本番適用へ進まない。
`migrate`・`validate` の成功だけで、DDLに記述した全制約が機能すると判断しない。

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

## ステップ3でのCloud実行環境からの接続確認（2026-10-22、過去の試行）

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

## ステップ3でのローカルTiDB実機検証（2026-10-22 JST）

### 対象と実行方法

- `feature/CHRON-145-db-initialization`、コミット `13dc17d` のV1・設定を使用。
  ユーザーに、ローカル `.env` の対象DBがCHRON-145用の使い捨て検証DBであり、
  V1・検証データ・検証専用差分を適用してよいことを確認してから書き込んだ。
- Process・User・Machineの環境変数には3変数とも未設定だったが、Git管理外の `.env` に
  `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` が空でない値として存在した。
  `.env` がignore対象かつ未追跡であることも確認。値は表示・記録していない。
- URLのホスト・ポート4000・DB指定・`sslMode=VERIFY_IDENTITY` の一致を値の出力なしで確認。
  ローカルではDNS解決・TCP 4000接続とも成功した。
- Docker DesktopのAPI（名前付きパイプ）は `Permission denied` で利用できなかったため、
  コンテナの代わりにWindows版Flyway Community Edition 11.15.0を直接実行した。
  リポジトリの `conf/flyway.conf` と本番用V1を読み込み、SQLの場所のみローカルパスへ指定。
  `cleanDisabled=true`・`baselineOnMigrate=false` 等の設定は維持した。
- Windows配布物の付属MariaDBドライバーでは `info` がエラー1105
  （insecure transport禁止）で失敗した。MySQL Connector/J 9.4.0を検証用CLIの
  `drivers/` に追加すると、URLを変更せず接続に成功した。
  Connector/JのSHA-256は
  `49ed93c8b2bea9cb0929b85a8a28837b191d0f8eac6919fdcef16e36e2cd53b3`。
  専用コンテナのドライバー構成・動作は今回未確認であり、同等性を保証する結果ではない。
- 接続先はTiDB 8.5.3。Connector/Jで接続し、TLS暗号スイートが空でないことも確認した。
  ログはメモリ内で処理し、接続情報を除いた適用状態・終了コード・件数・真偽値のみ確認した。

### 初期構築・再実行・差分適用の結果

| 確認 | 実機での結果 |
| --- | --- |
| 適用前のDB | テーブル・ビュー0件、トリガー0件、ルーチン0件、履歴テーブルなし |
| 初回 `info` | 終了0、V1 Pending |
| 初回 `migrate` | 終了0、適用1件、バージョン1 |
| V1の `validate` / `info` | ともに終了0、検証1件成功、V1 Success |
| 検証データ投入 | アプリの8テーブルへ関連する合成データを各1件投入、コミット |
| V1の `migrate` 再実行 | 終了0、適用0件、履歴成功1件・失敗0件 |
| 再実行後のデータ | 全8件・全既存列の値をSHA-256で比較し、すべて一致 |
| 検証専用差分の `info` | V1 Success、検証専用V2 Pending |
| 検証専用差分の `migrate` | 終了0、V2のみ1件適用、バージョン2 |
| 差分後の `validate` / `info` | ともに終了0、検証2件成功、V1・V2 Success、Pendingなし |
| 差分後のデータ | 追加列1本を確認。全8件・全既存列の値は投入直後と一致。履歴成功2件・失敗0件 |

検証データは `users`・`schedule`・`calendar_event`・`todo_tasks`・`time_tables`・
`time_blocks`・`time_block_tasks`・`template_blocks` に各1件。
差分はリポジトリ外の検証用SQLディレクトリにV1の同一コピーと
`V2__verification_only_add_note.sql` を置き、CLIのlocationsをそのディレクトリへ切り替えて実行した。
検証専用V2の内容は `ALTER TABLE users ADD COLUMN chron145_verification_note VARCHAR(64) NULL;`。
既存列の比較から、この追加列のみ除外した。
本番SQL・共有適用済みSQLは編集・削除・改名せず、検証専用V2も本番SQLやGitへ追加していない。

検証DBはV2適用済み・検証データ各1件の状態で残している。
このDBを本番用V1だけのlocationsで検証しても、V2のSQLが不足するため検証時と同じ状態にはならない。
次の作業では対象と履歴を再確認し、検証専用V2の履歴をrepairや削除で消さない。
`clean`・`repair`・`baseline`、既存データの削除、クラスタ設定変更は行っていない。

### 制約の互換性確認で見つかった未解決事項

- 外部キーは9件存在。参照先のない行のINSERTと、既存login_idと重複するINSERTは拒否された。
- トランザクション内に別途作成した試験行だけを使い、schedule削除に伴う
  time_blocks・time_block_tasksのCASCADEを確認。試験後はロールバックした。
- **CHECK制約は0件で、V1に記述された8件が存在しなかった。** 不正なrole値のINSERTも拒否されなかった。
  読み取り確認では `tidb_enable_check_constraint` がOFFだった。
  この試験もロールバックし、終了後に元の8件・全既存列の値が一致することを再確認した。
  制約確認処理は、この不一致を失敗（終了1）として扱った。Flywayの適用失敗ではない。
- TiDBの[CHECK制約の公式説明](https://docs.pingcap.com/tidb/stable/constraints/#check)でも、
  利用には `tidb_enable_check_constraint` の有効化が必要とされる。
  [システム変数の説明](https://docs.pingcap.com/tidb/stable/system-variables/#tidb_enable_check_constraint-new-in-v720)
  と対象プランの権限・影響範囲を確認してから対応する。今回は設定を変更していない。

### 残作業と完了判定

- TiDBでのV1適用、再実行時の重複適用防止、差分適用時のデータ保持は確認できた。
  ただしCHECK制約が欠落しており、スキーマ・制約の互換性確認と本番適用可否の判定は未完了。
- CHECKの有効化方針・対象プランの権限を確認し、隔離した検証環境で制約の作成と違反データの拒否を確認する。
  既存DBに制約を追加する場合はデータの事前検査と正規の差分SQLを検討し、適用済みV1を変更しない。
- 専用コンテナでMySQL Connector/JとTLS設定が有効になることを確認し、同じ検証を再現する。
  今回はWindows版CLIでの結果であり、コンテナのTiDB接続成功とは扱わない。
- Cloud Run Jobでの作成・マイグレーション実行と成功・失敗の確認、バックアップからの復元試験は未実施。
  GCPプロジェクト・リージョン・Artifact Registry等の確定が必要。詳細は `CLOUD_RUN.md` を参照。
- 共有VSCode `launch.json` からの実際のアプリ起動は未確認。
- 既報のテスト2件（`updateStartAtPreservesScheduleLink`、`getHoldBlocksIncludesTasks`）の
  原因と今回の変更との関連は未調査。既存不具合とは断定しない。今回は全テストを再実行していない。

**CHRON-145は未完了。** 初期構築・データ保持の成功と、制約・コンテナ・Cloud Run・起動の未確認を区別する。
