# TiDB共有セッションの結合検証

通常のH2テストでは確認できない、TiDB上のSpring Session JDBCと独立したBackend JVM間の
セッション継続を検証する。通常のテストやアプリ起動では実行されない。

## CHRON-151 ステップ7の結果（2026-10-26 JST）

`tidb-session.ps1` を実行し、TiDB実機で37項目すべて成功した。

| 確認 | 結果 |
| --- | --- |
| 接続 | MySQL Connector/J、`sslMode=VERIFY_IDENTITY`、TLS暗号スイートあり |
| Flyway | 正規V1・V2のmigrate、validate、migrate再実行が成功 |
| 保存と共有 | 認証・CSRF属性の保存、独立したBackend A / B間での復元とCRUDが成功 |
| ログイン維持 | BのアクセスでDBの最終アクセス日時と7日間の期限が更新された |
| 再起動 | Aを終了し、新しいJVMでも既存Cookieと再起動前のCSRFトークンで操作できた |
| ログアウト | AでDBセッションとCookieを削除し、Bが旧Cookieを401で拒否した |
| 期限切れ | 定期削除前のDB行が存在する状態でも401となり、Cookie・DB期限を延長しなかった |
| 物理削除 | Spring Session標準の削除で期限切れ本体・属性が消え、有効なセッションは残った |
| 後片付け | `DisposableDatabaseRemoved=true`。専用データを含む一時DBを削除した |

事前の読み取りでは、元の接続先DBに過去の検証専用マイグレーション（Future）の履歴があった。
そのDBへ今回のV2を適用せず、同じTiDBに作成した専用DBで検証した。
元のDBのテーブル・適用済みSQL・履歴・データと `.env` は変更していない。

実際のCloud Run配置、実インスタンスの入れ替え・振り分け、ブラウザでの最終確認は未実施。
今回の結果をそれらの実施済み証明とはしない。

## 実行

リポジトリルートのPowerShell 7から実行する。

```powershell
docker compose up -d backend
docker compose build flyway
./backend/verification/tidb-session.ps1
```

Composeが解決する `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` を使用する。
Git管理外の `.env` またはプロセス環境変数で指定する。URLにはDB名と
`sslMode=VERIFY_IDENTITY` が必要。値やBackendログはコンソールに出力しない。
接続ユーザーには検証用DBのCREATE / DROPと、マイグレーション・アプリ操作の権限が必要。

## 分離と後片付け

接続先にある既存DBのテーブル・Flyway履歴・データは変更しない。同じTiDBへ一意な
`chron151_verify_<ランダム12桁>` DBを新規作成し、リポジトリのV1・V2をFlywayで適用する。
同名DBが存在すれば処理を拒否する。`clean`・`repair`・`baseline` は使用しない。

終了時は、この実行で作成できたDBだけを削除する。既存の `.env` を変更せず、
一時的に設定したプロセス環境変数を復元する。既存の開発用Backendは再起動しない。
強制終了やネットワーク断で削除に失敗した場合は一時DBが残り得るため、削除成功の
`DisposableDatabaseRemoved=true` を確認する。

BackendのbootJarを更新し、開発コンテナの `build/session-verification/` へ展開する。
依存関係とJDKは既存コンテナを使用し、PCへの追加導入は不要。

## 確認内容

- V1・V2の適用、validate、migrate再実行、セッション索引、JDBCのTLS接続。
- prod設定の独立した2つのBackend JVMで、認証情報とCSRFトークンをDB経由で復元。
- 既存CookieとCSRFトークンでの作成・更新・削除、および欠落・古いトークンの拒否。
- 一方のJVMを終了し、新しいJVMを起動した後も認証・CSRF付き操作を継続。
- ログアウトによるDBセッション削除と、他方のBackendでの旧Cookie拒否。
- 定期削除を停止した状態で期限切れ行を残し、アクセス拒否と延長されないことを確認。
- Spring Session標準の期限切れ削除による本体・属性の削除と、有効なセッションの保持。

Backendプロセスは検証用のloopbackポートだけにバインドする。HTTPクライアントは
Secure Cookieを明示的にヘッダーへ載せ、DB共有を検証する。HTTPSやブラウザのCookie挙動は
[ステップ6の検証](../../frontend/VERIFICATION.md) と区別する。
実際のCloud Runでの再起動・複数インスタンス振り分けはCHRON-152で最終確認する。

## デプロイと運用

1. 適用先DBのFlyway履歴を確認する。過去の検証用V2・V3を含むDBへ、今回のV2を
   強制適用しない。履歴が本番SQLと整合する適用先を用意する。
2. バックアップと復旧手順を確認し、対応Backendのデプロイより先にFlyway V2を適用する。
   アプリ起動時のSQL初期化とSpring Sessionの自動スキーマ作成は有効にしない。
3. 対応Backendをデプロイし、ログイン・CSRF付き操作・ログアウトを確認する。
   追加テーブルは旧アプリの業務テーブルを変更しないため、アプリを戻しても残してよい。

認証情報はJavaシリアライズ形式で保存する。今回の検証は同じビルド間での復元を確認したもので、
任意の将来バージョンとの互換性を保証しない。`LoginUser` のserialVersionUIDや認証・CSRF関連
クラスの保存形式を変更する際は、旧ビルドで保存したセッションの復元を確認する。
互換性を保てない場合は旧リビジョンへの流入を止め、対象DBの
`SPRING_SESSION_ATTRIBUTES` → `SPRING_SESSION` の順で認証セッションだけを削除し、
再ログインを案内する。業務テーブルやFlyway履歴は削除しない。

期限切れ削除は既定で毎分0秒（`0 * * * * *`）。アプリ停止中は実行されないが、
DBの期限を過ぎたセッションはアクセス時にも拒否されるため、物理削除の遅延で復活しない。
検証では定期実行を `spring.session.jdbc.cleanup-cron=-` で止め、この状態も確認する。
実際の定期実行や削除件数はデプロイ後の運用で監視する。

CHRON-152では、Cloud RunのNginx入口からのHTTPS通信、公開サービスURLに合わせた
`API_BASE_URL` / `FRONTEND_ORIGIN`、非公開Backendへの転送、Secret経由のTiDB接続、
実ブラウザのCookieと401時の画面遷移を確認する。その上で実インスタンスの再起動・
複数インスタンスへの振り分けでも既存セッションが使え、ログアウトが共有されることを確認する。
独自ドメインやセッションアフィニティを前提にしない。
