# 本番DBのマイグレーション

FlywayはJavaアプリに組み込まず、専用イメージで実行する。
ベースイメージは `redgate/flyway:11.15.0` に固定する。
MySQL Connector/J 9.4.0をSHA-256固定で `/flyway/drivers/` に追加する。
`jdbc:mysql` の `sslMode=VERIFY_IDENTITY` を使うため、付属MariaDBドライバーだけに依存しない。
ビルド時にMaven CentralへのHTTPS接続が必要。取得内容の不一致はビルドエラーとなる。
TiDB Cloud実機での初期構築・再実行・差分適用の結果と互換性上の残課題は、
末尾のローカル検証記録を参照。CHECK有効化後の制約追加・違反データ拒否も確認済み。
専用コンテナでも、CHECKがONの状態からのV1初回適用と再実行時のデータ保持を確認済み。
Cloud Run Jobと共有VSCodeからの実起動等の確認は残っている。
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

初回検証終了時点では、検証DBをV2適用済み・検証データ各1件の状態で残した。
このDBを本番用V1だけのlocationsで検証しても、V2のSQLが不足するため検証時と同じ状態にはならない。
次の作業では対象と履歴を再確認し、検証専用V2の履歴をrepairや削除で消さない。
`clean`・`repair`・`baseline`、既存データの削除、クラスタ設定変更は行っていない。

### 初回の制約確認で見つかった問題（再検証結果は次項）

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

### CHECK有効化後の再検証（2026-10-22 JST）

ユーザーがSQL Editorから有効化した後、新しい接続で
`@@GLOBAL.tidb_enable_check_constraint` がONであることを確認した。
接続情報は表示せず、同じ使い捨て検証DB・Windows版Flyway 11.15.0・Connector/J 9.4.0を使用した。
エージェントによるGLOBAL設定変更は行っていない。

1. V1・検証専用V2がSuccess、履歴成功2件・失敗0件で、元の8件・全既存列の値が保持されていることを確認。
2. V1に記載した8件のCHECK式で既存データを事前検査し、各条件の違反件数がすべて0件であることを確認。
3. リポジトリ外の検証用SQLディレクトリに `V3__verification_only_add_checks.sql` を作成。
   V1から同じ名前・条件式を抽出し、`ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` で8件を追加した。
   V1・V2は変更せず、本番用SQLやGitへこの検証専用V3を追加していない。
4. `info` でV3 Pendingを確認してから `migrate`。終了0、V3のみ1件適用、バージョン3に到達。
   `validate` は終了0で3件成功、`info` はV1・V2・V3すべてSuccess、Pendingなし。
5. `information_schema.CHECK_CONSTRAINTS` でCHECK制約8件を確認。
   role・kind・予定時刻の逆転・日時列の排他・priority・due_kind・期日条件・statusの
   違反UPDATEを各1ケース実行し、8ケースすべてCHECK違反（エラー3819）として拒否された。
   不正roleのINSERT、外部キー違反、login_id重複の拒否とCASCADEも再確認した。
   DML試験は各ケース後にロールバックし、元の8件・全既存列の値が投入直後と一致することを再確認した。
6. V3適用後の `migrate` 再実行も終了0・適用0件となり、重複適用がないことを確認した。

制約件数の確認には `TABLE_CONSTRAINTS` ではなく `CHECK_CONSTRAINTS` を使用する。
今回のTiDB 8.5.3では `TABLE_CONSTRAINTS` のCHECK行数は0となり、`ENFORCED` 列への参照も
エラー1054になったため、読み取り確認のSQLを修正した。これはFlyway適用失敗ではない。
初回の不正roleのINSERTが受け入れられた事実は変わらないが、制約の実体確認は専用ビューを使う。

検証DBの現在状態はV3適用済み、CHECK8件・外部キー9件、アプリデータ各1件、履歴成功3件・失敗0件。
今後このDBで検証する場合はV1と検証専用V2・V3を含む同じlocationsを使う。
このDBは本番用イメージの適用先に流用せず、適用済みSQL・履歴を編集・削除しない。
既存データの削除、`clean`・`repair`・`baseline` は行っていない。

### 専用コンテナの接続確認とドライバー修正（2026-10-22 JST）

ユーザーの通常のPowerShellではDocker APIへ接続できた。
エージェントの実行環境からは名前付きパイプのアクセス拒否が続くため、
接続情報を表示しない確認スクリプトをユーザーのターミナルで実行した。

- 修正前の `docker compose build flyway` は終了0。
- イメージ内にMySQL Connector/Jはなく、MariaDBドライバーのみ存在した。
- `info` は終了1・`DB_CONNECTION`。insecure transport禁止のエラーを検出。
  DNS・TLSハンドシェイク・認証のエラーは検出されていないが、TLS接続や認証の成功を意味しない。
  この確認ではDBへの書き込みは行っていない。
- Dockerfileへ、Windows版CLIで接続に成功したMySQL Connector/J 9.4.0を追加した。
  Maven Centralの配布物を `ADD --checksum` で取得し、SHA-256を
  `49ed93c8b2bea9cb0929b85a8a28837b191d0f8eac6919fdcef16e36e2cd53b3` に固定。
  ファイルを0644で配置し、非root実行時にも読み取れるようにした。
- **修正後のコンテナのビルド・接続に成功。** ユーザーのターミナルで確認スクリプトを再実行し、
  ビルド終了0、MySQL Connector/Jの存在・SHA-256一致、Flyway 11.15.0の `info` 終了0を確認した。
  この確認でもDBへの書き込みは行っていない。
- `info` はSchemaVersion=3、V1 Success、検証専用V2・V3 Futureだった。
  Futureは、接続先にある適用済みSQLの履歴を、本番用V1だけを含むイメージでは解決できないため。
  このDBの履歴をrepairや削除で消さず、検証用locationsを必要に応じて使う。
- 続いて新しい使い捨て検証DBでV1初回適用とデータ保持も確認した。結果は次項を参照。

### 専用コンテナによる空DBへのV1初回適用（2026-10-22 JST）

ユーザーの通常のPowerShellから、接続情報を表示しない検証スクリプトを実行した。
本番用V1だけを含む専用イメージを再ビルドし、同じTiDB接続先に新しい使い捨て検証DBを作成した。
検証識別子は `792d36ad3051`（スクリプトが生成した識別子）。
従来のV3適用済み検証DBと `.env` は変更していない。
エージェントのDocker APIアクセス制限は継続しており、以下はユーザーから受領した実行結果に基づく。

| 確認 | 結果 |
| --- | --- |
| イメージのビルド・MySQLドライバー | ビルド終了0、Connector/JのSHA-256一致 |
| 接続条件 | CHECK機能ON、TLS暗号スイートあり、選択DBと新規検証DBの一致を確認 |
| 適用前 | 新規DB作成成功。テーブル・ビュー・ルーチン・トリガーなしを確認。`info` はV1 Pending |
| V1初回 `migrate` | 終了0、適用1件、バージョン1 |
| 初回 `validate` | 終了0、検証1件成功 |
| スキーマの実体 | アプリテーブル8件と履歴テーブル、CHECK制約8件、外部キー9件 |
| 初期データと履歴 | アプリデータ0件、履歴成功1件・失敗0件 |
| 合成データ投入 | アプリ8テーブルに各1件、計8件をコミット |
| CHECK違反の拒否 | role・kind・予定時刻の逆転・日時列の排他・priority・due_kind・期日条件・statusの違反UPDATE8ケースをすべて拒否 |
| 制約試験後のデータ | 各ケースをロールバック後、元の8件・全列の値のSHA-256が一致 |
| `migrate` 再実行 | 終了0、適用0件、履歴成功1件・失敗0件のまま |
| 再実行後のデータ | 元の8件・全列の値のSHA-256が一致 |
| 最終 `validate` / `info` | ともに終了0、検証1件成功、SchemaVersion=1、V1 Success、Future・Pendingなし |

総合判定 `InitialContainerMigrationVerificationPassed=True`。
新規検証DBはV1適用済み・合成データ8件の状態で残している。既存DBの削除、
`clean`・`repair`・`baseline`、GLOBAL設定変更は行っていない。
この検証では検証専用V2・V3を使用せず、本番SQLの編集・追加も行っていない。
差分適用時のデータ保持は先述のWindows版CLIでの結果と区別する。

補助スクリプトでComposeの設定をJSON取得する場合は、
`docker compose --profile migration config --format json` のようにプロファイルを明示する。
通常の `config` ではFlywayサービスが含まれない。このJSONには認証情報が含まれるため表示・保存しない。

### 残作業と完了判定

- TiDBでの初期構築、再実行時の重複適用防止、差分適用時のデータ保持は確認済み。
  差分はWindows版CLIで検証。専用コンテナではCHECKがONの空DBへのV1初回適用、
  CHECK8件の作成・違反更新の拒否と、再実行時のデータ保持まで確認済み。
- 共有の既存DBに制約が不足する場合は事前検査と正規の差分SQLを検討し、適用済みV1を変更しない。
- Cloud Run Jobでの作成・マイグレーション実行と成功・失敗の確認、バックアップからの復元試験は未実施。
  GCPプロジェクト・リージョン・Artifact Registry等の確定が必要。詳細は `CLOUD_RUN.md` を参照。
- 共有VSCode `launch.json` からの実際のアプリ起動は未確認。
- 既報のテスト2件（`updateStartAtPreservesScheduleLink`、`getHoldBlocksIncludesTasks`）の
  原因と今回の変更との関連は未調査。既存不具合とは断定しない。今回は全テストを再実行していない。

**CHRON-145は未完了。** TiDBのローカル検証の成功と、Cloud Run Job・VSCode起動・復元試験の未確認を区別する。
