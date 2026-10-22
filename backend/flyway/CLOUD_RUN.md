# Cloud Run JobによるDBマイグレーション

`cloud-run-job.sh` は専用イメージをCloud Run Jobへ設定し、実行結果を待つ。
アプリの起動処理には組み込まない。検証用と本番用でJob・Secret・DBを分ける。
TiDB実機検証（ステップ3）に合格するまでは本番へのmigrateを行わない。

## 前提と権限

- `gcloud` とDockerを利用でき、対象GCPプロジェクトに認証済みであること。
  Cloud Run Admin API、Artifact Registry API、Secret Manager APIを有効にする。
- Docker形式のArtifact Registryリポジトリを用意する。
- Job専用サービスアカウントを用意し、参照する3つのSecretだけに
  `roles/secretmanager.secretAccessor` を付与する。アプリの実行アカウントと分ける。
  TiDB側もマイグレーション用ユーザーを使い、対象DBのDDL・履歴管理に必要な権限を付与する。
- 設定する担当者には `roles/run.developer`、Jobサービスアカウントへの
  `roles/iam.serviceAccountUser`、イメージの読み取り権限が必要。
  イメージをpushする担当者には対象リポジトリの `roles/artifactregistry.writer` が必要。
  スクリプトの実行は引数overrideを使うため `run.jobs.runWithOverrides` を含む
  `roles/run.developer` 等が必要（通常のJob実行権限だけでは不足する）。
- 別プロジェクトのArtifact Registryを使う場合は、Jobのプロジェクトの
  Cloud Runサービスエージェントにも対象リポジトリの読み取り権限を付与する。

TiDBのホストは `gateway01.ap-northeast-1.prod.aws.tidbcloud.com:4000`、
URLは `jdbc:mysql://<host>:4000/<database>?sslMode=VERIFY_IDENTITY` とする。
Cloud RunからのDNS解決と外向きTCP 4000接続が必要。TiDBのIPアクセス制限で
固定送信元IPが必要な場合は、VPC経由の全トラフィック送信とCloud NATの固定IPを
別途設定し、そのIPをTiDB側へ許可する。このスクリプトはVPC/NATを構築しない。
開発用環境のHTTP許可リストはCloud Runの通信設定とは別。

## Secretの用意

Secret Managerに `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` 相当の
3つのSecretを作り、値をバージョンとして登録する。
値はコンソールまたは保護された標準入力から登録し、シェル履歴・Git・Jobの平文環境変数へ
保存しない。末尾の改行が値へ混入しないようにする。`set -x` やFlywayの `-X` は使わない。
URL・ユーザー名も接続エラーのログに含まれることがあるため、Cloud Loggingの閲覧権限を
制限し、ログを共有する際は接続情報をマスクする。

次の変数は値そのものではなくSecret名と数値バージョンを指定する。
`latest` は使わず、ローテーション時はJobを再設定する。

## イメージの公開とJob設定

以下はリポジトリルートのBashで実行する。例示値は実際の環境に置き換える。

```sh
export GCP_PROJECT_ID=your-project
export GCP_REGION=asia-northeast1
export FLYWAY_JOB_NAME=chronolist-flyway-verification
export FLYWAY_SERVICE_ACCOUNT="chronolist-flyway@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
export FLYWAY_URL_SECRET=chronolist-verification-flyway-url:1
export FLYWAY_USER_SECRET=chronolist-verification-flyway-user:1
export FLYWAY_PASSWORD_SECRET=chronolist-verification-flyway-password:1
export ARTIFACT_REPOSITORY=your-repository

FLYWAY_IMAGE_PATH="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}/flyway"
FLYWAY_IMAGE_TAG="${FLYWAY_IMAGE_PATH}:$(git rev-parse HEAD)"
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev"
docker build --platform linux/amd64 -t "$FLYWAY_IMAGE_TAG" backend/flyway
docker push "$FLYWAY_IMAGE_TAG"
FLYWAY_IMAGE_DIGEST=$(gcloud artifacts docker images describe "$FLYWAY_IMAGE_TAG" \
  --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
export FLYWAY_IMAGE="${FLYWAY_IMAGE_PATH}@${FLYWAY_IMAGE_DIGEST}"
bash backend/flyway/cloud-run-job.sh deploy
```

適用対象のSQLを含むコミットから作業ツリーがクリーンな状態でビルドする。
Jobはdigest固定、タスク1・並列数1・リトライ0、タイムアウト10分、1 CPU・512 MiB。
タイムアウトは実測とDDLの所要時間を踏まえて見直す。DDLの途中終了時は復旧手順へ進む。
`deploy` はJobを作成・更新するだけで実行しない。標準引数は `info`。
既存Jobを更新する際は、VPC・送信経路等の既存設定も確認する。

## 検証環境での実行確認

1. Jobのimage digest、Secretのバージョン、DBの接続先、サービスアカウント、
   ネットワーク設定を確認する。他の実行が動いていないことを確認する。
2. `info` で接続・履歴・適用待ちSQLを確認する。
3. 空の検証DBに `migrate`、続いて `validate` と `info` を実行する。
4. 検証用データを投入し、`migrate` の再実行で追加適用がなくデータが保持されることを確認する。
5. 本番SQLへ架空の差分を追加せず、使い捨て検証DB・検証用イメージで差分適用と
   データ保持を確認する。検証用イメージを本番Jobへ設定しない。

```sh
bash backend/flyway/cloud-run-job.sh info
# 接続先・DB状態とバックアップを確認した後に実行
bash backend/flyway/cloud-run-job.sh migrate
bash backend/flyway/cloud-run-job.sh validate
bash backend/flyway/cloud-run-job.sh info
```

各実行は `--wait` で完了を待つ。非ゼロ終了なら後続手順を止める。
Jobのタスク数1は別Executionの同時起動を防がない。同じDBへの適用は運用または
CI/CDの排他制御で直列化し、Flywayの履歴ロックだけに依存しない。
`gcloud` の待機が切断・タイムアウトした場合も、再実行する前に実行状態を確認する。

```sh
gcloud run jobs executions list --job="$FLYWAY_JOB_NAME" \
  --project="$GCP_PROJECT_ID" --region="$GCP_REGION"
# 上の一覧で得た名前を指定する
gcloud run jobs executions describe EXECUTION_NAME \
  --project="$GCP_PROJECT_ID" --region="$GCP_REGION"
```

Cloud RunコンソールのJob実行詳細とCloud Loggingでタスク終了コード・Flywayの
適用結果を確認する。実行ID、開始/終了時刻、コミット、image digest、Secretバージョン、
適用前後のバージョン、バックアップ識別子と検証結果をリリース記録へ残す。
接続情報や実データは記録しない。

## バックアップとアプリデプロイ前の手順

1. SQLをレビューし、旧アプリとの互換性、TiDB対応、所要時間、復旧方法を確認する。
   追加変更を先行させ、列削除・名前変更は旧アプリの利用終了後に別リリースで行う。
2. 対象TiDB Cloudプランのバックアップ/復元機能と保持期間・復旧可能時点を確認する。
   手動スナップショットやPITRの可否はプランに依存する。利用できない場合は、
   TiDB対応のエクスポート等で別途検証済みのバックアップを取得する。
3. バックアップの完了を確認し、識別子・対象DB・時点・保存先・保持期限を記録する。
   別の検証用DB/クラスタへ復元し、テーブル・制約・代表データ・件数と
   `flyway_schema_history` を確認する。初回はこの復元試験を本番適用前に完了する。
   書き込み継続時のデータ損失範囲（RPO）と復旧時間（RTO）も決める。
4. 対象リリースのdigestと数値SecretバージョンでJobを設定する。
   進行中Executionがないことを確認し、`info` と `validate` で接続先・履歴・
   チェックサムとPending一覧を確認する。既存DBに履歴がなければ適用を止める。
5. `migrate` を1回実行し、成功後に `validate` と `info` を実行する。
   期待したバージョンに到達し、Pendingや失敗行がなく、代表データが保持されることを確認する。
6. 全確認が成功してから `SPRING_PROFILES_ACTIVE=prod` のアプリをデプロイする。
   スモークテストと監視でDBアクセスを確認してからトラフィックを切り替える。
   Job失敗時はアプリのデプロイを止める。CI/CDでもJobの失敗を無視して後続を実行しない。

## 失敗時の復旧

TiDBのDDLは全体をトランザクションで取り消せない。Job失敗やタイムアウトを
「何も変更されていない」と扱わず、`clean`、自動baseline、無条件の再実行・`repair` を行わない。

1. 後続デプロイと並行実行を止め、実行状態・ログ・適用SQL・履歴を保存する。
   Job終了後もTiDB側でDDLが進んでいないか確認する。
2. 接続/認証失敗なら実際のスキーマと履歴に変更がないことを確認してから、
   ネットワークまたはSecretを修正する。Secretの新バージョンはJobへ明示して再設定する。
3. 途中DDL失敗なら、実テーブル・列・制約、TiDBのDDL状態、
   `flyway_schema_history` を照合して適用済み範囲を特定する。
   旧アプリへの影響を確認し、必要なら書き込みを止める。
4. 前進修正できる場合は、DB状態を安全に整合させるSQLと手順をレビューし、
   復元した検証DBで再現・確認してから実施する。
   `repair` はスキーマを復旧しない。必要な場合も履歴と実スキーマの整合を確認したうえで
   個別手順として実行する。このスクリプトは `repair` を提供しない。
   成功済みの共有マイグレーションを編集してチェックサムを合わせない。
5. 前進修正が困難なら、書き込みを止めてバックアップを別DB/クラスタへ復元する。
   データ・スキーマ・履歴を検証し、必要な移行を復元先に適用してから、
   アプリとJob両方の接続先Secretを復元先へ更新する。
   復元時点以降の書き込みの欠損・再投入方針を確認し、スモークテスト後に利用を再開する。

アプリだけを前のリビジョンへ戻してもスキーマは戻らない。追加変更が後方互換なら
旧アプリへ戻してDBを維持できるが、互換性がない場合は復旧計画に従う。

## 確認状況

2026-10-22時点で、Bashの構文と差分の書式チェックに成功。
`gcloud` の代替コマンドを使い、deployの設定引数、3種類の実行の完了待機、
失敗終了コードの伝播、未対応操作・可変タグ・数値以外のSecretバージョン・
必須設定不足の拒否を確認した。これはCloud RunやTiDBとの接続を検証するものではない。

Cloud Run上でのJob作成・実行は未確認。作業環境に `gcloud` とGCP認証設定がなく、
プロジェクト・リージョン・Artifact Registryは未定。
Secret・サービスアカウントの実環境値も未設定のため。
ステップ3ではローカルのWindows版Flyway 11.15.0とMySQL Connector/J 9.4.0で、
TiDB 8.5.3へのV1適用・再実行・検証専用差分適用とデータ保持を確認した。
初回は `tidb_enable_check_constraint` がOFFでCHECK制約が欠落したが、ユーザーのON設定後、
検証専用V3で8件のCHECKを追加し、違反UPDATE8ケースの拒否と既存データ保持を確認した。
ON状態から空DBへの本番用V1初回適用は未確認であり、初期構築の互換性確認は残っている。
専用コンテナはユーザーのローカルターミナルでビルドに成功したが、MySQLドライバーがなく
`info` がinsecure transport禁止で失敗した。DockerfileへConnector/J 9.4.0をSHA-256固定で追加し、
修正後のビルド・接続は再確認待ち。CLIの成功をコンテナやJobの成功とは扱わない。
詳細と残作業は [README.md](README.md#ステップ3でのローカルtidb実機検証2026-10-22-jst) を参照。
ON状態からのV1初期構築・専用コンテナの確認後にJob実機検証へ進む。設定ファイルの整備と実機での完了は区別する。
実環境で上記の接続・適用・復元試験に合格後、実行IDと結果を追記する。
