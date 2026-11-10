# TiDBの共有セッションと業務APIの結合検証

通常のH2テストでは確認できない、TiDB上のSpring Session JDBCと独立したBackend JVM間の
セッション継続、マイグレーション、SchedulerとTimeBlockingの独立性を検証する。
通常のテストやアプリ起動では実行されない。

## 実行

リポジトリルートのPowerShell 7から実行する。

```powershell
docker compose up -d backend
docker compose build flyway
./backend/verification/tidb-session.ps1
```

Composeの開発用 `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` を使用する。
Git管理外の `.env` またはプロセス環境変数で指定する。URLにはDB名と
`sslMode=VERIFY_IDENTITY` が必要。値やBackendログはコンソールに出力しない。
本番とTiDBホストを共有する場合も、開発用のDB名と認証情報を使う。`PROD_FLYWAY_*` は使用しない。
接続ユーザーには検証用DBのCREATE / DROPと、マイグレーション・アプリ操作の権限が必要。

## 分離と後片付け

接続先にある既存DBのテーブル・Flyway履歴・データは変更しない。同じTiDBへ一意な
`chron151_verify_<ランダム12桁>` DBを新規作成して空であることを確認し、V1・V2・V3をFlywayで適用する。
同名DBが存在すれば処理を拒否する。`clean`・`repair`・`baseline` は使用しない。

終了時は、この実行で作成できたDBだけを削除する。既存の `.env` を変更せず、
一時的に設定したプロセス環境変数を復元する。既存の開発用Backendは再起動しない。
強制終了やネットワーク断で削除に失敗した場合は一時DBが残り得るため、削除成功の
`DisposableDatabaseRemoved=true` を確認する。

BackendのbootJarを更新し、開発コンテナの `build/session-verification/` へ展開する。
依存関係とJDKは既存コンテナを使用し、PCへの追加導入は不要。

## 確認内容

- Flywayの `info → migrate → validate → info → migrate` と、V1・V2・V3のみが成功した履歴。
- JDBCのTLS接続、外部キー・CHECKの有効化、セッション索引、旧列・外部キー・索引の削除。
- `calendar_event.schedule_id` から `schedule.id` への外部キーの保持と、存在しない予定IDの拒否（1452）。
- 認証済み2ユーザーのSchedulerとTimeBlockingのCRUD、一覧の分離、他人の変更・削除の404とDB不変性。
  同日の通常予定から終日予定への変更と削除でブロック・子タスクが残り、ブロックの変更で予定が変わらないことも確認する。
- prod設定の独立した2つのBackend JVMで、認証情報とCSRFトークンをDB経由で復元。
- 既存CookieとCSRFトークンでの作成・更新・削除、および欠落・古いトークンの拒否。
- 一方のJVMを終了し、新しいJVMを起動した後も認証・CSRF付き操作を継続。
- ログアウトによるDBセッション削除と、他方のBackendでの旧Cookie拒否。
- 定期削除を停止した状態で期限切れ行を残し、アクセス拒否と延長されないことを確認。
- Spring Session標準の期限切れ削除による本体・属性の削除と、有効なセッションの保持。

Backendプロセスは検証用のloopbackポートだけにバインドする。HTTPクライアントは
Secure Cookieを明示的にヘッダーへ載せ、DB共有を検証する。HTTPSやブラウザのCookie挙動は
[ローカルHTTPS結合検証](../../frontend/README.md#転送設定とローカルhttpsの検証) と区別する。
配置先の実インスタンスの入れ替え・振り分けも別途確認する。

## デプロイと運用

1. 適用先DBのFlyway履歴とチェックサムを確認し、正規のSQLと整合する適用先を用意する。
   CHRON-190は[計画停止と新規DBへの切り替え手順](../../examples/cloud-run/DB_REBUILD.md)に従う。
2. バックアップと復旧手順を確認し、対応Backendのデプロイより先にリリース対象のマイグレーションを適用する。
   アプリ起動時のSQL初期化とSpring Sessionの自動スキーマ作成は有効にしない。
3. 対応Backendをデプロイし、ログイン・CSRF付き操作・ログアウトを確認する。
   旧版へ戻す場合は、そのアプリとDBスキーマ、セッション保存形式の互換性を確認する。

認証情報はJavaシリアライズ形式で保存する。このスクリプトの対象は同じビルド間の復元であり、
任意の将来バージョンとの互換性を保証しない。`LoginUser` のserialVersionUIDや認証・CSRF関連
クラスの保存形式を変更する際は、旧ビルドで保存したセッションの復元を確認する。
互換性を保てない場合は旧リビジョンへの流入を止め、対象DBの
`SPRING_SESSION_ATTRIBUTES` → `SPRING_SESSION` の順で認証セッションだけを削除し、
再ログインを案内する。業務テーブルやFlyway履歴は削除しない。

期限切れ削除は既定で毎分0秒（`0 * * * * *`）。アプリ停止中は実行されないが、
DBの期限を過ぎたセッションはアクセス時にも拒否されるため、物理削除の遅延で復活しない。
検証では定期実行を `spring.session.jdbc.cleanup-cron=-` で止め、この状態も確認する。
実際の定期実行や削除件数はデプロイ後の運用で監視する。

配置先では、公開Origin・プロキシの信頼境界・DB接続を確認した上で、
実ブラウザのCookie、認証・CSRFと401時の画面遷移を確認する。
実インスタンスの再起動・複数インスタンスへの振り分けでも既存セッションが使え、
ログアウトが共有されることを確認し、セッションアフィニティに依存させない。
