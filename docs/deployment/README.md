# Chronolistの手動本番デプロイ

CHRON-152で確認した手動作業の再現手順。GCPの操作は担当者が実行する。
CI/CDのworkflow・デプロイ認証・自動実行条件はCHRON-153、DBユーザー分離はCHRON-154で扱う。
検証結果と未完了事項は [VERIFICATION.md](VERIFICATION.md) を参照。

## 構成・通常設定

| 項目 | 設定 |
| --- | --- |
| GCPプロジェクト | chronolist-512706（番号303257351509） |
| リージョン | asia-northeast1 |
| Artifact Registry | chronolist-images |
| Cloud Runサービス | chronolist |
| 公開入口 | Frontend Nginx :80。画面とAPIは同一Origin |
| 内部Backend | 同一インスタンスの127.0.0.1:8080 |
| 実行アカウント | chronolist-app / chronolist-flyway |
| 課金・スケーリング | リクエストベース、最小0・最大1 |
| コンテナ | Frontend 1 CPU / 128Mi、Backend 1 CPU / 512Mi |
| 同時実行数・タイムアウト | 8・300秒 |
| DB | TiDB Cloudの本番DB prod、TLSのVERIFY_IDENTITY |
| セッション | JDBC保存、無操作7日、Cookie期限7日、削除cronは毎分0秒 |

Cloud RunのIAM認証を無効にして公開し、アプリの認証・CSRF保護でAPIを制御する。
`run.googleapis.com/invoker-iam-disabled: 'true'` は最上位metadata.annotationsに保持する。
Backendを独立した公開サービスとして配置しない。
Backendのstartup probe成功後にNginxを起動する。TCP probeは待受確認であり、DBやAPIの正常性は別途検証する。

GCPの月額目標は500円、TiDBは無料プラン内。予算はプロジェクト全体への通知のみで自動停止しない。
無料枠は同じ請求先の別プロジェクトと共有される。初回アクセス時の起動待ちは許容する。
常時起動でも500円以内に収まることは未確認。ログ・イメージ保管・外向き通信も費用へ含める。

## 初回準備

1. 対象プロジェクト・請求先・権限とgcloud認証を確認する。
2. Cloud Run Admin / Artifact Registry / Secret Manager APIを有効にする。
3. Dockerリポジトリ、アプリ用・Job用サービスアカウントを準備する。
4. パスワードだけをSecret Managerへ登録する。アプリ用は `chronolist-prod-db-password`、
   Job用は `chronolist-prod-flyway-password`。各サービスアカウントへ対応Secret単位で
   `roles/secretmanager.secretAccessor` を付与する。キーの発行は不要。
5. URL・ユーザー名は通常の環境変数とする。CHRON-152では両方とも同じ既存rootユーザーを使用する合意。
6. [テンプレート](../../infra/cloud-run/service.yaml.template) をルートの `service.yaml` へコピーする。
   実環境ファイルはgitignore対象。すべての `<...>` を置き換え、パスワードの実値を入れない。
   Secretバージョンは数値で固定する。プロジェクトID・レジストリ・DB接続先を別環境と取り違えない。

`service.yaml` の通常環境変数はログや設定閲覧者から読めるため、URLに認証情報を埋め込まない。
実値を持つ設定はGit・チャットへ貼らない。ビルドコンテキストは各サブディレクトリとし、ルートを使わない。

## ビルド・push

以下はリポジトリルートからBashで実行する例。作業ツリーがクリーンなリリース対象コミットを使用する。
シェルの変数は後続例でも使用する。PowerShellでは構文を置き換える。

```sh
export GCP_PROJECT_ID=chronolist-512706
export GCP_REGION=asia-northeast1
export ARTIFACT_REPOSITORY=chronolist-images
IMAGE_ROOT="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}"
RELEASE_SHA=$(git rev-parse HEAD)
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev"
docker build --platform linux/amd64 --target production -t "$IMAGE_ROOT/frontend:$RELEASE_SHA" frontend
docker build --platform linux/amd64 --target runtime -t "$IMAGE_ROOT/backend:$RELEASE_SHA" backend
docker build --platform linux/amd64 -t "$IMAGE_ROOT/flyway:$RELEASE_SHA" backend/flyway
docker push "$IMAGE_ROOT/frontend:$RELEASE_SHA"
docker push "$IMAGE_ROOT/backend:$RELEASE_SHA"
docker push "$IMAGE_ROOT/flyway:$RELEASE_SHA"
```

各コマンドが成功したことを確認して次へ進む。各イメージのdigestを取得し、コミットSHAと併記する。

```sh
gcloud artifacts docker images describe "$IMAGE_ROOT/frontend:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)'
gcloud artifacts docker images describe "$IMAGE_ROOT/backend:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)'
gcloud artifacts docker images describe "$IMAGE_ROOT/flyway:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)'
```

アプリのYAMLとFlyway Jobには `@sha256:...` を指定する。Frontendは起動時設定を使うため、
本番URLをVITE_API_BASE_URLでビルドに埋め込む必要はない。

## migrationを先に適用する

Jobの作成・Secret・権限・実行・失敗時の扱いは [Flyway手順](../../backend/flyway/CLOUD_RUN.md) を使用する。

1. 本番用Job名、リリースのFlyway digest、サービスアカウント、URL・ユーザー名、パスワードSecretの数値版を設定する。
2. `cloud-run-job.sh deploy` でJobを作成・更新する。この操作では実行しない。
3. `info` で接続先と履歴を確認する。初回は空DB・V1/V2 Pendingを確認する。
4. CHECK有効化、DBの実体、復旧方針と適用前バックアップを確認する。
5. `migrate` を1回実行し、成功後に `validate` と `info` を実行する。失敗したら後続を止める。
6. V1/V2 Successと、11テーブル・CHECK8件・外部キー10件（業務9・セッション1）を確認する。
   CHECKはinformation_schema.CHECK_CONSTRAINTSで確認する。初回は開発用データがないことも確認する。

同じDBへ複数Executionを並行起動しない。タイムアウト時は実行状態を確認し、無条件に再実行しない。
初回の空DBで採用した再構築方針と、データ投入後の復元試験延期は検証記録へ明記している。

## アプリの配置・更新

1. 初回はCloud Runコンソールでサービス名・リージョンを指定し、表示されるサービスURLを確認する。
   任意のハッシュ付きURLを推測しない。初回配置もmigration成功後に行う。
2. 同じ公開HTTPS Origin（末尾スラッシュなし）をAPI_BASE_URLとFRONTEND_ORIGINへ設定する。
   BACKEND_UPSTREAMは `http://127.0.0.1:8080`。Backendはprod・SERVER_PORT=8080を使用する。
3. DB_URLが開発DBではなく本番prodを指し、VERIFY_IDENTITYを含むことを確認する。
   DB_PASSWORDはSecretの数値バージョン参照とする。
4. すべてのプレースホルダーを置き換えたローカルYAMLをレビューし、手動適用する。

```sh
gcloud run services replace service.yaml --project=chronolist-512706 --region=asia-northeast1
```

YAMLはローカル環境の全設定を管理する。コンソールで変更した設定もローカルファイルへ反映してから再適用する。
SESSION_TIMEOUT=7d、SESSION_COOKIE_MAX_AGE=7d、SPRING_SESSION_JDBC_CLEANUP_CRON='0 * * * * *'を含める。
`traffic.latestRevision=true / percent=100` のため、この手順は最新リビジョンへ即時切替を行う。
更新前に旧リビジョン名・両イメージdigest・Secret版を控える。段階的な切替を行う場合は別途trafficを設計する。

5. 新リビジョンの準備完了・公開設定・通常スケーリングを確認する。
6. HTTPSの画面と `/api/csrf` のJSON応答、SPAリロード、認証・CSRF・CRUDを確認する。
7. 同一Cookieでの再デプロイ後の継続、複数インスタンスの共有、期限切れの拒否を確認する。
   検証用インスタンス増加・タグ・削除cron等を通常値へ戻す。

## 障害調査・復旧・後片付け

- 起動失敗：対象リビジョンとコンテナのログ、startup probe、ポート、依存順、メモリ、Secret権限を確認。
- DB接続失敗：本番DB名、接続URLのTLS設定、TiDBのネットワーク許可、Secret数値版と権限を確認。
- 403：Cloud Run入口で拒否されるのか、アプリのCSRF拒否なのかを区別する。APIをSPAのHTMLへ置換しない。
- 401：ログイン・セッション期限・Cookie送信先を確認。CSRF不備は認証済みなら403となる。
- アプリ更新失敗：スキーマ互換性を確認し、控えた旧リビジョンへ画面/APIをまとめて戻す。

```sh
gcloud run services update-traffic chronolist --project=chronolist-512706 --region=asia-northeast1 --to-revisions='<PREVIOUS_REVISION>=100'
```

上の例のリビジョン名を実値へ置き換える。ローカルYAMLのlatestRevision設定との違いも記録し、
次回replaceで意図せず最新へ戻さない。DBはリビジョンを戻しても復元されない。
DB変更失敗ではFlyway手順に従い、clean・履歴削除・無条件のrepairをしない。
データ投入後に空DB再構築をデータ復旧の代替にしない。

現行と復旧用のdigestを先に特定し、参照中のイメージを削除しない。
不要な検証用イメージ・タグは保持対象を確認して整理する。自動削除ポリシーは別途レビューして適用する。
予算通知と月額費用を確認し、リリース記録にコミット・digest・Job実行ID・リビジョン・結果を残す。

## 公式リファレンス

- [公開アクセスとInvoker IAM設定](https://docs.cloud.google.com/run/docs/authenticating/public)
- [コンテナ構成・起動順](https://docs.cloud.google.com/run/docs/configuring/services/containers)
