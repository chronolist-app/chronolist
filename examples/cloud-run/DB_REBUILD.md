# CHRON-190のDB再構築とCloud Run切り替え

CHRON-190とCHRON-193を含むリリースでは、計画停止中に新しい空のTiDBデータベースを構築し、Cloud Runを切り替える。
旧DBのデータ、ユーザー、セッションは新DBへ移行しない。実行前にこの扱いと停止時間を承認し、
再ログインや必要なアカウント登録を利用者へ案内する。既存の本番DBは切り替え時に削除しない。
本番作業の実行には、対象を特定した上で別途承認が必要。この手順は今回の再構築に限定し、他のリリースは
[通常の配置手順](README.md)と[Flywayの復旧原則](../../backend/flyway/README.md#失敗時の扱い)に従う。

## 開発用H2とテスト

リポジトリルートで、更新したSQLを使うよう開発用Backendを再起動する。devのH2はインメモリで、
再起動時に `schema.sql` と開発用 `data.sql` から再作成される。既存のdevデータとセッションは消える。
起動ログでdev Profile、H2とアプリ起動を確認する。

```sh
docker compose restart backend
docker compose logs --tail 100 backend
docker compose exec -T backend env -u SPRING_PROFILES_ACTIVE sh ./gradlew test
```

Backendが未作成の場合は `docker compose up -d backend` で起動する。テストは専用のH2に
`schema.sql` と `sql/test-data.sql` を適用し、開発用の `data.sql` は読み込まない。
テストごとに `sql/cleanup.sql` で初期化する。検証範囲は[API統合テスト](../../backend/src/test/README.md)を参照する。

## 開発用TiDBでの事前検証

PowerShell 7で[使い捨てDBの検証手順](../../backend/verification/README.md)を実行する。
Composeの開発用 `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` を使用する。
TiDBのクラスタやホストを本番と共有する場合も、開発用DB名・DBユーザー・認証情報を本番と区別する。
`PROD_FLYWAY_*` を検証に渡さない。スクリプトは `chron151_verify_<ランダム12桁>` の空DBを
新規作成し、そのDBだけに適用する。`TiDBSessionChecksPassed=true` と `DisposableDatabaseRemoved=true` を確認する。

```powershell
docker compose up -d backend
docker compose build flyway
./backend/verification/tidb-session.ps1
```

V1・V2は適用済みSQLとして保持する。V1とV2を新規適用したTiDB Cloud v8.5.3-serverlessでは、
`time_blocks.schedule_id` の外部キー名と専用索引名が `fk_3` だった。V3は外部キー、索引、列の順に削除する。
対象のTiDBバージョンや生成される名前が異なる場合は作業を止め、同じ構成の使い捨てDBで確認する。

## 本番の事前照合と停止

1. 非公開の運用記録に、GCPプロジェクト・リージョン・サービス・Flyway Job、公開Origin、旧リビジョンと
   配信比率、旧DBと新DBのクラスタ・JDBCホスト・ポート・DB名を記録する。現在と切り替え後のJob・Backendの
   環境変数、DBユーザー、実行サービスアカウント、接続経路、Secret名と数値版を照合する。旧版・候補の
   Frontend・Backend・Flywayのコミットとイメージdigest、旧DBを使う復旧設定も記録する。パスワードや
   トークンを記録やリポジトリに含めない。実利用者や保持が必要なデータが見つかった場合は作業を止め、
   データの扱いを別途決めるまで旧DBを保持する。
2. 公開入口を閉じ、書き込みを止める。公開Origin、デフォルトの `run.app`、既存タグなど到達経路を洗い出す。
   実環境で確認済みの停止方法と、担当者だけが候補へ到達できる検証経路を別々に記録し、停止中も有効かを確認する。
   0%配信のタグ付きURLにも直接到達できるため、公開経路から候補へ書き込めないことを確認する。
3. 実行中のリクエストと書き込みの完了を待つ。別のデプロイ、定期処理、Flyway Jobや関連する書き込み元を停止し、
   競合する実行がないことを確認する。確認できない場合は新DBへの適用へ進まない。

## 新DBへの適用と確認

1. 承認済みのクラスタ上に、旧DBとは別名で新規DBを作成する。接続直後に `SELECT DATABASE()` と
   `information_schema.tables` で対象名と空の状態を確認する。TLS、外部キー、CHECKの設定も確認する。
2. Flyway Jobの `FLYWAY_URL` と候補Backendの `DB_URL` を新DBへ向ける。JDBC URLのクラスタ・ホスト・ポート・
   DB名・TLS設定（`sslMode=VERIFY_IDENTITY`）が同一であることを確認する。
   JobはDDL・履歴管理用、Backendは業務・セッション用の別DBユーザーと権限、別のSecret参照を使う。
   候補の起動前に、承認済みの検証経路からJDBCクライアントで各ユーザーの認証情報を使って個別に接続し、
   `SELECT DATABASE()`、TLSと制約設定を照合する。候補起動後は実際のサービスから疎通と権限を確認する。
3. [Job設定手順](README.md#3-migrationを先に実行する)を参照し、対象JobをV4まで含むdigestと新DBへの接続設定に固定する。
   既存の実行アカウント・ネットワーク等を照合し、必要な設定を保持する。1タスク・並列1・リトライ0で実行する。
   各Executionの終了を待ち、IDと結果を運用記録に残す。最初の `info` はV1〜V4がPendingであることを確認する。

   ```sh
   bash examples/cloud-run/flyway-job.sh info
   bash examples/cloud-run/flyway-job.sh migrate
   bash examples/cloud-run/flyway-job.sh validate
   bash examples/cloud-run/flyway-job.sh info
   ```

4. 以下の読み取り専用SQLを新DBに接続して実行する。TLS cipherが空でなく、外部キーとCHECKの設定が有効であることを確認する。
   JobとBackendの接続でも同じ制約設定を使う。履歴は順にV1・V2・V3・V4の成功4件のみで、最終 `info` にPendingがないことを確認する。

   ```sql
   SELECT DATABASE(), @@foreign_key_checks, @@tidb_enable_check_constraint;
   SHOW SESSION STATUS LIKE 'Ssl_cipher';
   SELECT table_name FROM information_schema.tables
     WHERE table_schema = DATABASE() ORDER BY table_name;
   SELECT installed_rank, version, type, script, success
     FROM flyway_schema_history ORDER BY installed_rank;

   SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = DATABASE() AND column_name = 'schedule_id'
       AND table_name IN ('time_blocks', 'calendar_event');
   SELECT table_name, constraint_name, column_name,
          referenced_table_schema, referenced_table_name, referenced_column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
     ORDER BY table_name, constraint_name, ordinal_position;
   SELECT table_name, index_name, seq_in_index, column_name
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name IN ('time_blocks', 'calendar_event', 'SPRING_SESSION', 'SPRING_SESSION_ATTRIBUTES')
     ORDER BY table_name, index_name, seq_in_index;

   SHOW CREATE TABLE time_blocks;
   SHOW CREATE TABLE time_block_tasks;
   SHOW CREATE TABLE calendar_event;
   SHOW CREATE TABLE schedule;
   ```

   `time_blocks.schedule_id`、その参照外部キー、専用索引 `fk_3` が存在しないことを確認する。
   `calendar_event.schedule_id` は同じDBの `schedule.id` を引き続き参照する。`time_blocks.user_id` → `users.id`、
   `time_blocks.table_id` → `time_tables.id` とタスク → ブロックの外部キー、V1のCASCADEとCHECK、
   V2のセッションテーブルと索引を保持する。V1・V2の他のテーブル・外部キー・制約もSQLと照合する。
   `schedule` にV4の `chk_all_day_nonempty` 制約があり、終日予定の終了日が開始日より後に制限されていることを確認する。
   すべての照合に通ってから候補を起動する。

## 候補の検証と公開切り替え

1. 旧リビジョンを保持し、新DBの設定と固定digestのFrontend・Backendを含む新リビジョンを、タグ付き・公開トラフィック0%で配置する。
   通常のCI/CDと `deploy.sh` は既存の接続設定を引き継ぎ、簡易スモーク後に自動で100%切り替えるため、
   今回は担当者が候補配置・検証・切り替えを個別に実施する。

   以下は既存サービスのコンテナ名が `frontend` と `backend` の場合。照合済みの値を設定する。
   `FRONTEND_IMAGE` と `BACKEND_IMAGE` は `@sha256:...` 付きのURI、`DB_PASSWORD_SECRET` は
   `<DB_PASSWORD_SECRET_NAME>:<NUMERIC_VERSION>`。`DB_URL` と `DB_USERNAME` に区切り文字 `|` や改行を含めない。
   一意な `CANDIDATE_TAG` を使い、現在の `API_BASE_URL` と `FRONTEND_ORIGIN` が公開Originと一致していることを確認する。

   ```sh
   gcloud run services update "$SERVICE_NAME" --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
     --no-traffic --tag="$CANDIDATE_TAG" --revision-suffix="$CANDIDATE_TAG" \
     --container=frontend --image="$FRONTEND_IMAGE" \
     --container=backend --image="$BACKEND_IMAGE" \
     --update-env-vars="^|^DB_URL=$DB_URL|DB_USERNAME=$DB_USERNAME" \
     --update-secrets="DB_PASSWORD=$DB_PASSWORD_SECRET"
   ```

   サービスのステータスで候補がReady、公開配信0%、タグが同じ候補を指し、旧リビジョンの配信比率が維持されていることを確認する。
   候補の両コンテナのdigest・接続先・Secret版を照合し、ステータスのタグ付きURLを `CANDIDATE_ORIGIN` に設定する。詳細は
   [gcloudのコンテナ別更新オプション](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update)を参照する。
2. 確認済みの候補URLで `bash examples/cloud-run/smoke.sh "$CANDIDATE_ORIGIN"` を実行する。
   `/config.js` の実際の `API_BASE_URL` とBackendの `FRONTEND_ORIGIN` は最終的な公開Originにそろえる。
   タグ上のブラウザ画面は絶対URLの `API_BASE_URL` に従うため、そのまま画面操作すると旧リビジョンへ送信し得る。
   切り替え前は、全リクエストのURLを候補タグに固定したHTTPSクライアントを使い、許可済みの公開Originを
   `Origin` に指定する。Cookieは候補専用のセッションに分け、リダイレクトで公開URLへ移動しない。
   Cloud Runのリクエストログで到達したリビジョンを確認し、公開経路や旧DBへ書き込まれていないことを照合する。
3. 候補でサインアップ、ログイン後のCSRF再取得、認証済みGET、ToDo・予定・タイムブロックのCRUDを試す。
   同日の予定を更新・削除してもブロックと子タスクが残り、ブロック変更後も予定が残ることを確認する。
   1日だけの終日予定を登録し、その日の検索に含まれ、翌日の検索に含まれないことを確認する。
   ログアウトと旧Cookie拒否も確認する。検証で作成したデータは対象を識別し、残すものと削除するものを記録する。
4. 公開入口を閉じたまま、候補をリビジョン名で100%へ切り替える。担当者の検証経路から公開Originの画面とAPIを
   確認し、ブラウザのリクエスト先・Cookie・認証付き操作と実際の到達リビジョンを照合する。

   ```sh
   gcloud run services update-traffic "$SERVICE_NAME" --project="$GCP_PROJECT_ID" \
     --region="$GCP_REGION" --to-revisions="$CANDIDATE_REVISION=100"
   ```

5. 新DBとJobの組み合わせ、公開Originでのスモーク、認証とCRUDがすべて確認できたら、公開入口を開く。
   公開経路から再確認し、結果を記録する。検証用タグや一時経路を整理し、止めていた運用を対象確認後に再開する。

## 失敗時の判断

- 停止・対象照合に失敗した場合は新DBへの適用を始めない。停止方法または設定を確認し、旧版・旧DBでの再開可否を判断する。
- Job失敗や待機タイムアウトでは候補を起動しない。Executionが終了したかを確認し、ログ、Flyway履歴、実スキーマを保存する。
  TiDBでは部分的にDDLが適用され得る。同じDBに無条件で再実行せず、`repair`、`clean`、履歴編集を行わない。
  原因を修正して検証した後、別名の新しい空DBを用意し、Jobと候補Backendの接続先をそろえて最初から実行する。
- 候補や公開前の確認に失敗した場合は入口を閉じたままにする。切り替え済みなら旧リビジョンを100%に戻し、
  旧DBと互換性のあるアプリのdigest・DB設定、同じ旧DBを指すJobのdigest・設定・Secret版を組み合わせて確認する。
  新DBに旧版をそのまま向けない。旧DBが失われている場合は、対応するイメージとマイグレーションの組を用意し、
  検証済みバックアップから復元するか、データなしでの再構築について承認を取り直す。
- 公開後に失敗した場合はまず書き込みを再停止し、新DBに入ったデータとセッションを保全する。旧DBへ戻した場合に
  公開後のデータが反映されないため、復旧点とデータの取り扱いを承認してから再開する。
