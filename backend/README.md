# バックエンドの環境設定

Java 25を使用する。環境は `SPRING_PROFILES_ACTIVE` で切り替える。

| プロファイル | DB | 起動時SQL初期化 |
| --- | --- | --- |
| dev | H2（jdbc:h2:mem:testdb、ユーザーadmin、パスワードなし） | schema.sqlとdata.sql |
| prod | 環境変数で指定するTiDB Cloud | 実行しない |
| 未指定 | Spring Bootの自動設定 | 実行しない |
| test | 専用H2 | schema.sqlとテスト専用データ |

## 開発

リポジトリルートで `docker compose up backend` を実行するとdevが適用される。
Dockerを使わない場合はリポジトリルートをVSCodeで開き、Java拡張機能を導入し、
共有の `.vscode/launch.json` から `Spring Boot - Chronolist (dev)` を選択する。
この起動設定には `SPRING_PROFILES_ACTIVE=dev` が設定済み。個人のOS環境変数設定は不要。
H2コンソールはdevのみ有効（http://localhost:8080/h2-console）。
再起動すると開発用スキーマとサンプルデータが再作成される。

CLIではbackendから `sh ./gradlew bootRun --args='--spring.profiles.active=dev'`。
テストは `sh ./gradlew test`（詳細はsrc/test/README.md）。

## 本番

実行環境で以下を設定する。認証情報はリポジトリに保存しない。

- `SPRING_PROFILES_ACTIVE=prod`
- `DB_URL`: `jdbc:mysql://<host>:4000/<database>?sslMode=VERIFY_IDENTITY`
- `DB_USERNAME`: TiDB Cloudのユーザー名
- `DB_PASSWORD`: TiDB Cloudのパスワード

prodの接続情報は必須。DBスキーマはアプリ起動前に別途用意する。
FlywayのSQL・専用コンテナと実行方法は [flyway/README.md](flyway/README.md) を参照。
Cloud Run Jobの設定と運用手順は [flyway/CLOUD_RUN.md](flyway/CLOUD_RUN.md) を参照。

## HTTPセッションの保存先

Spring Session JDBCが既存DataSourceを使用する。prodはTiDB、dev / testはH2へ
`SPRING_SESSION`・`SPRING_SESSION_ATTRIBUTES` を保存する。Redis等の追加サービスは不要。
Spring Sessionによる自動テーブル作成は全環境で無効化し、dev / testは既存の
`schema.sql`、prodはFlywayでスキーマを管理する。

prodへ対応Backendをデプロイする前に、Flyway V2（セッション用テーブル追加）まで適用する。
適用済みV1は変更しない。devのH2は再起動時に初期化されるため、セッションも消える。
期限切れセッションの物理削除はSpring Session JDBCの標準定期処理が担当する。
Cloud Runが停止中は定期処理も停止するが、有効期限の判定と物理削除は別である。

CHRON-151の段階的な実装として、現時点は保存基盤・ログインフィルタ連携・Cookie期限更新・
BackendのCSRF保護まで。Frontendのトークン自動取得・送信はステップ5で対応する。
ログイン時のセッションID変更、旧CSRFトークンの破棄、認証情報の保存はSecurity側で行い、
成功ハンドラは200応答のみを返す。独自ログインフィルタはSecurity内で生成し、Servlet Filterとして
別途自動登録しない。ログインはPOST `/api/login` のみで受け付ける。
CSRFはdev / prod共通で有効。ログイン時のトークン破棄とログアウト時の削除は
CsrfConfigurerの標準処理に任せ、独自のセッション戦略へ重複登録しない。
TiDB上のDDL・セッション操作の互換性、および実際の再起動・複数インスタンス間の継続は
H2上のテストと区別して検証する。

`LoginUser` は明示的なserialVersionUIDを持つ。今後も認証情報の保存形式の互換性を確認し、
互換性のない変更時は旧セッションを失効させ、再ログインを求める。必要な場合はデプロイ時に
対象DBのセッション属性・セッション本体の順で削除する手順を用意する（業務データは削除しない）。
今回のserialVersionUID明示前に作成されたセッションは継続利用を保証しない。

### ログイン維持期間とCookie

無操作期限は既定7日。Spring Sessionがセッション利用時に最終アクセス日時とDB上の期限を更新する。
認証済みの `/api/*` アクセスでは、レスポンス確定前にCookieも再発行し、Cookieだけが当初の
ログイン日から7日で先に切れないようにする。維持用の定期通信は追加しない。
自動ポーリングを今後追加する場合は、それだけで無操作期限を延長し続けない扱いを検討する。

| 設定 | 既定値・用途 |
| --- | --- |
| `SESSION_TIMEOUT` / `spring.session.timeout` | `7d`。サーバー側の無操作期限 |
| `SESSION_COOKIE_MAX_AGE` / `server.servlet.session.cookie.max-age` | 無操作期限と同じ値。Cookie保持期間を別に設定する場合のみ指定。正の秒数が必要 |
| Cookie名 / Path / Domain | `JSESSIONID` / `/` / 指定なし（host-only） |
| HttpOnly / SameSite | `true` / `Lax` |
| Secure | dev・testは `false`、prodは `true`。prodはHTTP転送経由でもSecureを付ける |

Cookieは永続Cookieとして発行し、ブラウザ終了後も期限内なら再利用できる。
Cookie保持期間を長くしても、サーバー側で失効したセッションが有効になることはない。
設定変更のためのDBマイグレーションは不要。無操作期限の設定は新しく作るセッションへ適用される。
ログアウトはDBセッションを無効化し、発行・更新と同じCookie生成処理で削除Cookieを返す。
期限切れ・匿名リクエストで認証用Cookieを延長せず、Cookie更新処理自体はセッションを新規作成しない。
SPA APIは401を直接返すため、未認証リクエストの保存（Spring Security RequestCache）は無効化する。

以前の段階でSpring Session標準の `SESSION` Cookieを受け取ったブラウザは再ログインが必要。
Cookie属性と期限更新はローカルのテストで確認し、Cloud Run・Nginx経由の実ブラウザでの確認は
CHRON-152と連携して行う。

### CSRFトークンの取得・送信とエラー応答

未ログインでも `GET /api/csrf` にアクセスでき、`Cache-Control: no-store` と
`{"token":"...","headerName":"X-CSRF-TOKEN"}` を返す。同時にセッションCookieを受け取る。
トークンは共通のHttpSessionCsrfTokenRepositoryを通してDBセッションに保存し、取得APIでは
Spring Security標準のマスク済みトークンを返す。マスクは取得ごとに変わるが、同じセッションの
既存トークンが取得のたびに無効になるわけではない。

状態変更リクエストには同じセッションのCookieと `X-CSRF-TOKEN` ヘッダーを送る。
ログイン・サインアップ・ログアウトも対象。GET / HEAD / OPTIONS等の参照・事前確認には
トークンを要求しない。ログイン・ログアウト成功後は古いトークンが破棄されるため再取得する。
拒否された更新要求をBackendが再実行することはない。

| 状況 | HTTP / JSON code |
| --- | --- |
| 認証必須APIへの未認証・期限切れアクセス | `401` / `UNAUTHENTICATED`（CSRF不備が先に検出されても同じ） |
| ログイン資格情報の不一致 | `401` / `UNAUTHENTICATED` |
| ログイン・サインアップのCSRF不備、認証済みリクエストのCSRF不備 | `403` / `CSRF_TOKEN_INVALID` |
| 通常の権限不足 | `403` / `ACCESS_DENIED` |

エラー応答は `{"code":"..."}` のJSONで、例外詳細やトークンを含めない。
CSRFの発行・検証に伴い匿名セッションが作成される場合があるが、これは認証状態の復元や
期限切れした認証セッションの延長ではない。
CORSでは既存の開発Originに対し `X-CSRF-TOKEN` とPATCHを許可する。Originの環境別切替・
Controller単位のCORS整理はステップ6で扱う。

この段階のFrontendはまだトークンを送らないため、画面からのログイン・状態変更は403になる。
Frontend連携の完成と実ブラウザの認証・CSRFフロー確認はステップ5以降で実施する。

## Dockerイメージの使い分け

以下のDockerコマンドはリポジトリルートで実行する。
Docker Desktopなど、LinuxコンテナとBuildKitを利用できる環境が必要。
初回ビルドではベースイメージ、Gradle、依存ライブラリの取得にネットワーク接続が必要になる。

| 用途 | ビルド方法 | 起動方法 |
| --- | --- | --- |
| 通常の開発 | Composeが `development` stageを選択 | JDKで `bootRun`。ソースとGradleキャッシュをマウント |
| 本番イメージ・単体検証 | 通常の `docker build` が最終の `runtime` stageを選択 | JREで `java -jar /app/app.jar`。ソースのマウント不要 |

開発用イメージを更新する場合は次を実行する。
backendが再起動するとdevのH2データは再作成される。

```sh
docker compose up -d --build --no-deps backend
```

## 本番イメージのビルド

```sh
docker build -t chronolist-backend:local ./backend
```

build stageのGradle Wrapperが `bootJar --no-daemon` を実行し、`app.jar` を生成する。
runtime stageにはJREとJARを配置し、Gradle・アプリのソース・ビルドキャッシュは含めない。
起動時にビルドは行わない。実行ユーザーはUID/GID `10001:10001`、JARは読み取り専用。

`.dockerignore` でローカルのビルド成果物・IDE設定・環境変数ファイル等を除外し、
COPY対象をGradle設定・Wrapper・ソースに限定している。
認証情報をソースやリソースへ記述しない。
ビルド時のGradleキャッシュはBuildKitが管理し、Composeの開発用ボリュームとは別に保持する。

## 本番イメージをdevで単体起動する

外部DBなしで、ビルドしたJARとHTTP接続を確認できる。
開発用Composeの8080番ポートとの競合を避け、ホスト側は18081番を使用する。

```sh
docker run -d --name chronolist-image-dev -p 127.0.0.1:18081:8080 -e SPRING_PROFILES_ACTIVE=dev chronolist-backend:local
docker logs chronolist-image-dev
```

ログでdev Profile、H2接続、`Started Application` を確認する。
devのデータはインメモリのため、コンテナ再起動で初期化される。

## 本番イメージをprodで起動する

先に [Flywayの手順](flyway/README.md) に従って対象DBのマイグレーションを完了する。
アプリコンテナはマイグレーションもSQL自動初期化も実行しない。
データを書き込む動作検証には使い捨て検証DBを使用する。

起動するシェルの環境変数に、冒頭の `DB_URL`・`DB_USERNAME`・`DB_PASSWORD` を設定しておく。
接続元からTiDBへ通信できることも必要。
Secret管理機能などから値を取得し、コマンド引数やGit管理対象ファイルへ値を直接記述しない。
リポジトリの `.env` にある `FLYWAY_*` はFlyway用なので、下記の `docker run` には自動適用されない。

| 環境変数 | 内容 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | 起動時に `prod` を指定 |
| `DB_URL` | 対象DBを含むJDBC URL。`sslMode=VERIFY_IDENTITY` を指定 |
| `DB_USERNAME` / `DB_PASSWORD` | 対象DBの認証情報 |
| `SERVER_PORT` | 任意。コンテナ内のHTTPポート。既定8080 |

```sh
docker run -d --name chronolist-image-prod -p 127.0.0.1:18082:8080 -e SPRING_PROFILES_ACTIVE=prod -e DB_URL -e DB_USERNAME -e DB_PASSWORD chronolist-backend:local
docker logs chronolist-image-prod
```

`-e DB_URL` などはシェルの環境変数を引き継ぐ指定。
ソースやGradleキャッシュのボリュームは指定しない。
ログでprod Profileと正常起動を確認する。
DB接続は最初のDB操作まで遅延するため、起動成功だけで接続成功とは判断しない。

ポートを変更する場合は、例えば `-e SERVER_PORT=9090` と
`-p 127.0.0.1:18082:9090` を組み合わせる。
Dockerfileの `EXPOSE 8080` はポート情報の宣言であり、公開や待受ポート変更は行わない。
上の例はホストのループバックに限定して公開する。

## HTTP・DB動作の確認

devの場合は18081番、prodの場合は18082番を使用する。
以下はPowerShell 7の例。未認証での401応答でHTTP到達を確認する。

```powershell
$baseUrl = 'http://127.0.0.1:18082'
(Invoke-WebRequest "$baseUrl/api/todolist/getAll" -SkipHttpErrorCheck).StatusCode
```

DB接続を確認する場合は、使い捨て検証DBに対して以下を実行する。
検証用ユーザーを1件作成し、セッションを使ったDB読み取りまで確認する。
各HTTP操作が200になることを確認する。認証情報・Cookieは出力しない。

```powershell
$credentials = @{
    loginId = 'c149' + [guid]::NewGuid().ToString('N').Substring(0, 16)
    password = 'Check149!' + [guid]::NewGuid().ToString('N')
} | ConvertTo-Json
$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
(Invoke-WebRequest "$baseUrl/api/signup" -Method Post -ContentType 'application/json' -Body $credentials).StatusCode
(Invoke-WebRequest "$baseUrl/api/login" -Method Post -ContentType 'application/json' -Body $credentials -WebSession $session).StatusCode
$tasks = Invoke-WebRequest "$baseUrl/api/todolist/getAll" -WebSession $session
$tasks.StatusCode
$tasks.Content # 新規ユーザーなら []
```

続けて、同じ使い捨て検証DBにToDoを1件作り、再起動前の内容を保存する。

```powershell
$taskBody = @{
    title = 'Docker image verification'
    dueKind = 'NONE'
    priority = 'LOW'
    memo = 'Synthetic verification data'
    isCompleted = $false
} | ConvertTo-Json
(Invoke-WebRequest "$baseUrl/api/todolist/register" -Method Post -ContentType 'application/json' -Body $taskBody -WebSession $session).StatusCode
$beforeRestart = (Invoke-WebRequest "$baseUrl/api/todolist/getAll" -WebSession $session).Content
docker restart chronolist-image-prod
docker logs --tail 20 chronolist-image-prod
```

ログで再度 `Started Application` を確認した後、同じPowerShellで次を実行する。
新しいセッションで同じユーザーにログインし、取得内容の完全一致（`True`）を確認する。

```powershell
$newSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
(Invoke-WebRequest "$baseUrl/api/login" -Method Post -ContentType 'application/json' -Body $credentials -WebSession $newSession).StatusCode
$afterRestart = (Invoke-WebRequest "$baseUrl/api/todolist/getAll" -WebSession $newSession).Content
$beforeRestart -ceq $afterRestart
```

prodのユーザー・ToDoはコンテナを削除してもDBに残る。

CHRON-149で実施したAPI操作・再起動後の比較結果は
[Dockerイメージ検証記録](DOCKER_VERIFICATION.md) を参照。

## 停止・後片付け

作成した検証コンテナだけを停止・削除する。
使用したProfileに対応するコマンドを選ぶ。

```sh
docker stop chronolist-image-dev
docker rm chronolist-image-dev
docker stop chronolist-image-prod
docker rm chronolist-image-prod
```

必要がなくなったローカルイメージは `docker image rm chronolist-backend:local` で削除できる。
検証DBの削除やFlyway履歴の変更はこの手順では行わない。

## コンテナ内での既存テスト

起動済みの開発用Composeを利用する場合は、dev Profileの環境変数をテストプロセスから外す。
Profile未指定の動作を検証するテストへの影響を避けるためで、Compose自体の設定は変更しない。

```sh
docker compose exec -T backend env -u SPRING_PROFILES_ACTIVE sh ./gradlew test
```

テストは専用H2を使用する。詳細は [API統合テスト](src/test/README.md)、
今回の全件実行結果は [検証記録](DOCKER_VERIFICATION.md) を参照。
