# GitHub Actionsによる本番リリース

このリポジトリをCloud Runへ配置する場合の自動化例。実環境の構成・変更記録はチームの運用資料で管理する。
初回のインフラ構築、DBユーザーの分離、DBの自動復元は対象外。

CHRON-190では既存の接続設定を維持する通常のデプロイを実行せず、計画停止中に新DBへ切り替える。
対象リリースの承認・実施は [専用手順](DB_REBUILD.md) に従う。

## 実行の流れ

- 作業PRはdevelopへ集約する。develop/main向けPRとdevelopへのpushでCIを実行する。
- developからmainへのリリースPRをマージすると、同じコミットでCIを再実行する。
- Backend全テスト（認証・CSRFを含む）・JAR/Docker build、Frontend lint/test/build/Docker build、配置スクリプトのテストが必須。
- CI成功後、production Environmentの承認待ちに入る。
- 承認後、3イメージをbuildし、キーを発行しないOIDC認証でRegistryへpushする。タグはcommit SHA、配置はdigest固定。
- 既存Flyway Jobのイメージだけを更新し、info → migrate → validate → infoを完了待ちで実行する。失敗時はアプリを更新しない。
- Frontend/Backendを同じ新リビジョンへ配置する。既存の環境変数、Secret参照、実行アカウント、リソース設定は維持する。
- 本番トラフィックを送る前にタグ付きURLで画面・起動時設定・CSRF API・未認証APIの401を確認し、成功後に新リビジョンへ100%切り替える。
- 公開Originでも同じ確認を行う。失敗時のrollbackは手動。DBスキーマは戻さない。

本番Frontendは起動時のAPI_BASE_URLを使用するため、VITE_API_BASE_URLのbuild時指定は不要。
スモークテストは認証済みCRUDや業務機能全体の検証を代替しない。

## GitHubの初回設定（担当者）

workflowの追加だけでは承認は有効にならない。**mainへworkflowを導入する前に**以下を設定する。

1. Settings → Environmentsで`production`を作成する。
2. Required reviewersに承認者を登録する。自分でマージ・承認する運用ならPrevent self-reviewを有効にしない。
3. Deployment branches and tagsをSelected branches and tagsにし、Branchの`main`だけを許可する。管理者の保護ルール迂回も無効にする。
4. 下表のEnvironment variablesを設定する。
5. レビュー設定とGCP認証・権限を確認した後、**productionのEnvironment secret**として`PRODUCTION_DEPLOY_ENABLED=true`を設定する。同名のRepository secretは作成しない。
6. mainへの直接pushを制限し、PRと成功したCIチェックを必須にする。developも同様に保護する。チェック名は最初のCI実行後に選択する。

有効化Secretがない場合はクラウド変更前に停止する。ただし、このSecretはレビュー設定の代替ではない。
後からレビュー保護を削除しないこと。公開リポジトリではRequired reviewersを利用できるが、非公開化する場合はプランの対応を再確認する。

| Environment variable | 内容 |
| --- | --- |
| GCP_PROJECT_ID | 既存プロジェクトID |
| GCP_REGION | 既存サービス・Job・Registryのリージョン |
| ARTIFACT_REPOSITORY | Dockerリポジトリ名 |
| SERVICE_NAME | 既存Cloud Runサービス名 |
| FLYWAY_JOB_NAME | **本番DB用**の既存Job名 |
| PUBLIC_ORIGIN | 実際に公開するHTTPS Origin。末尾スラッシュなし |
| GCP_WORKLOAD_IDENTITY_PROVIDER | projects/番号/locations/global/workloadIdentityPools/プール/providers/プロバイダ |
| GCP_DEPLOY_SERVICE_ACCOUNT | CI/CD専用サービスアカウントのメールアドレス |

DBパスワード・DBのURL/ユーザー名をActionsへ設定する必要はない。既存サービス/Jobの設定を保持する。
既存Jobは接続先・Secret数値版・実行アカウント・ネットワークを担当者が事前照合する。
サービスはfrontend/backendの2コンテナ構成かつ旧リビジョン1件へ100%配信していることが前提。

## GCPの初回設定（担当者）

専用のデプロイ用サービスアカウントとWorkload Identity Pool/Providerを作成する。JSONキーは作成しない。
GitHub issuerは`https://token.actions.githubusercontent.com`。
google.subject=assertion.subに加え、repository_id、repository_owner_id、refを属性へマッピングする。
Providerのattribute conditionで**組織の数値ID・リポジトリの数値ID・refs/heads/main・environment=production**を制限する。
Environmentは`assertion.environment == 'production'`で確認する。リポジトリ名だけの信頼条件にしない。
GitHubでimmutable subjectを使用する場合、subのrepo部分には所有者/リポジトリの数値IDも含まれる。
旧形式のsubを推測して固定しない。google.subjectには実際のassertion.subをマッピングする。
対象リポジトリに限定したprincipalSetへ、デプロイ用アカウントの`roles/iam.workloadIdentityUser`を付与する。

デプロイ用アカウントには以下を対象リソース単位で付与する。Owner/EditorやDB Secretの読み取りは不要。

- 対象Artifact Registryリポジトリの`roles/artifactregistry.writer`。
- 既存Cloud RunサービスとFlyway Jobの`roles/run.developer`（Jobの引数上書き実行も必要）。
- サービス/Jobを列挙する権限が必要な場合のみ、必要範囲の読み取り権限を補う。
- アプリ用・Flyway用の各実行サービスアカウントの`roles/iam.serviceAccountUser`。

APIはCloud Run / Artifact Registry / IAM / IAM Service Account Credentials / Security Token Serviceを確認する。
必要なAPI有効化、IAM変更、Providerの作成は担当者が実施する。既存の公開IAMやSecret権限をworkflowで変更しない。
build後にサービスアカウントの1時間アクセストークンを取得し、gcloudとDocker helperで使用する。通常の実行は60分以内に制限する。

## 初回リリースと再実行

1. 最新developでCIを通し、mainへのリリースPRを作成する。初期状態のmainへ古いコードを配備しない。
2. migration SQLの旧アプリ互換性、バックアップ/復旧方針、既存Job、公開Originをレビューする。
3. mainへマージし、CI成功後にActionsのReview deploymentsで対象SHAを確認して承認する。
4. 完了後、公開画面・認証・必要な業務操作を確認する。実施結果は運用資料へ残す。

main限定のworkflow_dispatchも利用できる。失敗原因とJob Execution/DDL状態を調査してから使う。
途中ジョブの再実行も自動的な安全性を保証しない。migration失敗時に無条件で再試行しない。
新しいmainがある古い実行はクラウド変更前に拒否する。本番workflowは共通concurrencyで直列化し、進行中のmigrationをキャンセルしない。
承認待ちの間も同じグループを使用する。待機中の古い実行が置換されることがある。手動のJob実行/配備も同時に行わない。

## リリース記録と手動rollback

ActionsのSummaryと`production-release-*` artifactを確認する。artifactは90日保持。
release-record.jsonにはcommit、旧/候補リビジョン、3イメージのdigest、成功したJob実行名、進行フェーズを記録する。
失敗したJobの実行IDはCloud Runの実行一覧で調べる。SecretやCSRFトークンは記録しない。
長期の監査/復旧用に必要な記録は運用資料へ保存し、現行・復旧用イメージをRegistryの削除対象にしない。

切替前の失敗なら旧リビジョンが配信を継続する。切替後の確認失敗では、新リビジョンへ切替済みの場合がある。
まず実際のtrafficとJob状態を確認し、DBスキーマ・セッション保存形式が旧アプリに対応することを確認してから実行する。

```sh
gcloud run services update-traffic '<SERVICE_NAME>' \
  --project='<PROJECT_ID>' --region='<REGION>' \
  --to-revisions='<release-record.jsonのpreviousRevision>=100'
```

画面/APIの両方を旧リビジョンへ戻す。DBを自動で元に戻さず、clean・無条件repair・履歴削除はしない。
復旧後は公開API、認証、データ保持を確認する。残った候補タグは調査後に`--remove-tags='<RELEASE_ID>'`で削除する。
ローカルservice.yamlも現在のtrafficに合わせる。次回の手動replaceで意図せず最新へ戻さない。

## 公式資料

- [GitHub Environmentの承認と保護](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub ActionsからのWorkload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Google認証Action](https://github.com/google-github-actions/auth)
- [Cloud Run複数コンテナの更新](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update)
