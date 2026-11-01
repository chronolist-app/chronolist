# Cloud Runへの配置例

GitHub Actionsによる承認付きの自動化は [CI/CD設定手順](CI_CD.md) を参照する。

ChronolistをCloud Runへ配置する場合の一例。アプリ自体はCloud Runを必須としない。
共通の設定・ビルド・DB要件は [ルートREADME](../../README.md)、
[Backend](../../backend/README.md)、[Frontend](../../frontend/README.md)、
[Flyway](../../backend/flyway/README.md) を参照する。

ここでは1サービス内のNginxを公開入口にし、内部BackendへAPIを転送する。
DBは外部のTiDB、migrationは別のCloud Run Jobで実行する。
プロジェクトID、接続先、リリースの識別情報は各自の環境に置き換える。
実運用の判断や実施結果をサンプル設定と混同しない。

## 例の構成

```text
ブラウザ --HTTPS--> Cloud Run (Nginx :80 --> Backend 127.0.0.1:8080) --TLS--> TiDB
                   Flyway Cloud Run Job ---------------------------TLS--> TiDB
```

- FrontendのAPI_BASE_URLとBackendのFRONTEND_ORIGINに同じ公開HTTPS Originを指定する。
- BACKEND_UPSTREAMは `http://127.0.0.1:8080`。外部からBackendのポートへ直接接続させない。
- BackendのTCP startup probe成功後にNginxを起動する。TCP probeだけではDB疎通を確認できない。
- テンプレートの最小0/最大1、同時実行数8、Frontend 1 CPU/128Mi、Backend 1 CPU/512Miは例の値。
  起動時間、メモリ、負荷、DB接続数と費用を測定して調整する。
- リクエストベース課金ではアイドル中にCPUが制限される。停止・CPU制限中の定期削除を前提にせず、
  セッション期限の判定と物理削除を分けて確認する。

## 1. 前提を用意する

1. gcloudとLinuxコンテナを使えるDockerを用意し、対象プロジェクトへ認証する。
2. Cloud Run Admin / Artifact Registry / Secret Manager APIとDockerリポジトリを用意する。
3. アプリ用とJob用のサービスアカウントを用意する。キー発行は不要。
4. パスワードをSecret Managerへ登録し、対応する実行アカウントへSecret単位で
   `roles/secretmanager.secretAccessor` を付与する。URL・ユーザー名は通常環境変数とする。
5. アプリ用DBユーザーには業務・セッションの操作、migration用には対象DBのDDLと履歴管理に必要な権限を用意する。
6. デプロイ担当者に必要なCloud Run/IAM/イメージ読み取り権限を用意する。
   pushには対象リポジトリのwriter、実行アカウントの指定にはserviceAccountUserが必要。
   Jobの引数上書き実行にはrun.jobs.runWithOverridesも必要。
   公開時にInvoker IAMチェックを変更する担当者はrun.services.setIamPolicyも必要。
7. Cloud RunからTiDBへのDNS解決・TLS付きTCP接続とTiDB側の接続許可を確認する。
   固定送信元IPが必要なら別途VPC/NAT等の経路と費用を設計する。この例は構築しない。

別プロジェクトのレジストリを使う場合は、Cloud Runサービスエージェントの読み取り権限も確認する。
ログに接続情報が含まれる場合があるため、共有時はマスクする。

## 2. イメージをbuild・pushする

以下はリポジトリルートからBashで実行する例。引用符内の `<...>` を置き換える。
リリース対象コミットのクリーンな作業ツリーを使用し、各操作の成功を確認する。

```sh
set -euo pipefail
export GCP_PROJECT_ID='<PROJECT_ID>'
export GCP_REGION='<REGION>'
export ARTIFACT_REPOSITORY='<REPOSITORY>'
export SERVICE_NAME='<SERVICE_NAME>'
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

digestを取得し、コミットSHAとの対応を控える。配備時は可変タグではなくdigestで固定する。

```sh
FRONTEND_DIGEST=$(gcloud artifacts docker images describe "$IMAGE_ROOT/frontend:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
BACKEND_DIGEST=$(gcloud artifacts docker images describe "$IMAGE_ROOT/backend:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
FLYWAY_DIGEST=$(gcloud artifacts docker images describe "$IMAGE_ROOT/flyway:$RELEASE_SHA" --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
export FLYWAY_IMAGE="$IMAGE_ROOT/flyway@$FLYWAY_DIGEST"
```

ビルドコンテキストはfrontend、backend、backend/flyway。実環境の設定やSecretを含むルートを使わない。
Frontendは起動時設定を使うため、本番URLをビルド時に埋め込む必要はない。

## 3. migrationを先に実行する

Jobは設定と実行を分ける。以下の値を手元で用意する。パスワードの実値はこのシェルに設定しない。

```sh
export FLYWAY_JOB_NAME='<JOB_NAME>'
export FLYWAY_SERVICE_ACCOUNT='<JOB_SERVICE_ACCOUNT>'
export FLYWAY_URL='jdbc:mysql://<DB_HOST>:<DB_PORT>/<DB_NAME>?sslMode=VERIFY_IDENTITY'
export FLYWAY_USER='<MIGRATION_DB_USER>'
export FLYWAY_PASSWORD_SECRET='<FLYWAY_PASSWORD_SECRET>:1'
bash examples/cloud-run/flyway-job.sh deploy
bash examples/cloud-run/flyway-job.sh info
```

`deploy` はJobを作成・更新するだけで、実行しない。標準引数はinfo。
digestと数値Secret版を固定し、タスク1・並列1・リトライ0・timeout10分・1 CPU/512Miで設定する。
通常の環境変数とSecret一覧を置き換えるため、既存Jobに追加設定があれば適用前に確認する。
URLにカンマがあっても保持する。区切りに使用する `|` と改行はURL/ユーザー名で拒否する。

接続先、履歴、CHECKの有効状態、バックアップと復旧方法を確認してから順番に実行する。
初回は空DBにV1/V2がPending、更新時は既存履歴とチェックサムが整合することを確認する。

```sh
bash examples/cloud-run/flyway-job.sh migrate
bash examples/cloud-run/flyway-job.sh validate
bash examples/cloud-run/flyway-job.sh info
```

各実行は完了を待ち、失敗ならアプリ更新を止める。同じDBに並行Executionを起動しない。
待機がタイムアウトした場合は、再実行する前にコンソールでExecutionとTiDB側のDDL状態を確認する。
成功後に、適用したSQLどおりのテーブル・索引・制約とデータ保持も確認する。

## 4. アプリを配置する

[service.yaml.template](service.yaml.template) をGit管理外のルートservice.yamlへコピーする。
既存の実環境ファイルがある場合は上書きせず、内容を比較して統合する。

- `<SERVICE_NAME>`、`<APP_SERVICE_ACCOUNT>`、レジストリの各値を置き換える。
- imageのdigest部分には取得結果から `sha256:` を除いた64桁を入れる。image全体は `@sha256:...` とする。
- DB接続先・ユーザー名とパスワードSecret名を指定する。Secret版は数値で固定する。
- `<PUBLIC_ORIGIN>` をAPI_BASE_URLとFRONTEND_ORIGINの2箇所へ設定する。
  公開URLはHTTPS、パス・末尾スラッシュなしとする。

初回は、サービス名・プロジェクト番号・リージョンから[決定的URL](https://docs.cloud.google.com/run/docs/triggering/https-request)を事前に確定できる。
この形式が使用できるサービス名のDNSセグメント長は63文字以下。例では短い名前を使用し、デフォルトURLを無効にしない。

```sh
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
PUBLIC_ORIGIN="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${GCP_REGION}.run.app"
```

既存サービスや独自ドメインを使う場合は、実際に利用する公開Originに置き換える。
ハッシュ付きの非決定的URLは推測しない。すべてのプレースホルダーを置き換え、構成を確認して適用する。

```sh
gcloud run services replace service.yaml --project="$GCP_PROJECT_ID" --region="$GCP_REGION"
```

この例はingress=allと最上位metadata.annotationsのinvoker-iam-disabled=trueで公開する。
Cloud Run IAMチェックを無効にするが、アプリの認証・CSRFは有効のまま維持する。
ポート80だけを入口にし、Backendを別の公開サービスにしない。
最新リビジョンへ即時100%切り替える例なので、更新前に旧リビジョン・両image digest・Secret版を控える。
段階的切替が必要なら別途traffic設定を設計する。

コンソールの変更もローカルYAMLへ同期する。適用後に新リビジョン、公開Origin、通常スケーリングを確認し、
HTTPSの画面と `/api/csrf` のJSON応答を確認する。

## 5. 配置後の確認項目

- 画面表示、ページ遷移、直接アクセスとSPAリロード。
- サインアップ・ログイン・ログアウト、未認証401、認証済みGET。
- CSRF付きPOST/PUT/DELETEの成功と、認証済みで欠落/不正トークンの403、GETがトークン不要であること。
- CookieのSecure/HttpOnly/SameSite=Lax/Path=/・Domain未指定、期限更新とログアウト時削除。
- ToDo・予定・タイムブロックのCRUD、リロード・再ログイン後の保存状態。
- 再デプロイ後の同一Cookieによる認証・CSRF更新とデータ保持。
- 複数の実インスタンスへ到達した証拠を取り、セッション共有・ログアウト反映を確認。
- 物理削除前の期限切れ行でも旧Cookieが拒否されること。

検証用設定やインスタンス数を通常値へ戻す。検証結果は自分たちの運用記録へ残す。
ローカルのテスト成功だけで実環境の動作確認を代替しない。

## 障害調査と復旧

- 起動失敗：リビジョン/各コンテナのログ、probe、依存順、ポート、メモリ、Secret参照権限を確認。
- DB接続失敗：接続先、TLS、ネットワーク許可、Secret版、DB権限を確認。
- 403：Cloud Run IAM側の拒否とアプリのCSRF拒否を区別する。APIエラーをSPA HTMLに置き換えない。
- 401：Cookieの送信先・認証状態・セッション期限を確認。

アプリのrollbackは、DBスキーマ/セッション保存形式の互換性を確認してから、控えた旧リビジョンへ戻す。

```sh
gcloud run services update-traffic "$SERVICE_NAME" --project="$GCP_PROJECT_ID" --region="$GCP_REGION" --to-revisions='<PREVIOUS_REVISION>=100'
```

ローカルYAMLのlatestRevision設定も見直し、次回replaceで意図せず新リビジョンへ戻さない。
DBはアプリrollbackで戻らない。DDL失敗時は [Flywayの復旧原則](../../backend/flyway/README.md#失敗時の扱い) に従う。
データ入りDBのバックアップは別環境で復元を検証し、復旧時点・保持期間・手順を自分たちで記録する。

不要なイメージを整理する前に、現行と復旧用のリビジョン/digestを特定する。
ログ・保管・通信・Secretも費用に含め、予算通知と実際の費用を確認する。

## スクリプトのオフライン検証

```sh
bash -n examples/cloud-run/flyway-job.sh
bash examples/cloud-run/tests/flyway-job.test.sh
```

gcloud代替コマンドで引数・入力拒否・終了コード伝播を確認し、GCP/DBには接続しない。
Cloud Runでの配置・IAM・ネットワークの検証とは別である。

## 公式リファレンス

- [公開アクセスとInvoker IAM設定](https://docs.cloud.google.com/run/docs/authenticating/public)
- [コンテナ・起動順](https://docs.cloud.google.com/run/docs/configuring/services/containers)
- [サービスURL](https://docs.cloud.google.com/run/docs/triggering/https-request)
