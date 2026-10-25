# Chronolist Frontend

React / TypeScript / Viteで構築したSPA。開発時はVite、本番はNginxで静的ファイルを配信する。
以下のDockerコマンドはリポジトリルートで実行する。

## 開発環境

```sh
docker compose up -d --build frontend
```

`http://localhost:5173` を開く。Composeは `development` stageを使用し、ソースをマウントしてHMRを有効にする。
API URLは既存の `VITE_API_BASE_URL=http://localhost:8080` を使用する。
Dockerを使わない場合は `frontend` で `npm ci` を実行し、シェルの環境変数または `.env.local` に
`VITE_API_BASE_URL` を設定して `npm run dev` を実行する。
開発時は `config.js` を生成・読み込みしない。

## CSRF保護付きAPI通信

API呼び出しは既存の `src/utils/axios.ts` を通す。共通層が `GET /api/csrf` からトークンを取得し、
POST / PUT / PATCH / DELETEへ `X-CSRF-TOKEN` を付ける。Cookie送信は従来どおり
`withCredentials: true`。参照リクエストのためにトークンを取得・付与しない。
個々のAPI関数にCSRF処理を追加する必要はない。

トークンはメモリだけに保持し、同時取得は1つにまとめる。ログイン・ログアウト成功後は
古い取得処理を中止して再取得し、旧世代の取得結果や遅れて到着した403で新しい値を上書きしない。
API URLの設定方式（devのVITE_API_BASE_URL、prodの起動時API_BASE_URL）は変更しない。
共通クライアントに別OriginやAPI外のURLを渡しても、CSRFトークンを付与しない。

`403` かつ `code=CSRF_TOKEN_INVALID` の場合だけトークンを再取得し、全画面共通の通知で
画面の再読み込み・再操作を促す。失敗した状態変更要求はログイン・ログアウトを含めて自動再送しない。
既存画面が表示を楽観的に変更している場合もあるため、再読み込みで実際の保存状態を確認する。
通常の権限不足403をCSRFエラーとして扱わず、401は従来どおりログイン画面へ遷移する。
ログインAPIの401は画面遷移せず、既存の資格情報エラー表示に任せる。

初回トークン取得に失敗した場合は状態変更要求を送らず、通信確認を促す。
認証成功後の再取得失敗ではログイン・ログアウト自体の成功を維持し、次の操作時に再取得する。
ホーム画面のログアウトボタンも共通Axiosを使い、成功後に `/login?logout` へ遷移する。

### 自動テスト

既存のNode.js 24で標準テストランナーとTypeScriptの型除去を利用する。追加のテスト依存は不要。

```sh
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
```

`tests/csrf-token-manager.test.ts` と `tests/api-client.test.ts` では実際のAxios interceptorと
テスト用adapterを使い、同時取得、認証世代の競合、取得・復旧失敗、再送防止、401と403の区別を検証する。
ブラウザ・Cookie・Backendとの結合確認は [VERIFICATION.md](VERIFICATION.md) のCHRON-151記録を参照。

## 本番イメージのビルド

```sh
docker build --target production -t chronolist-frontend:local ./frontend
```

API URLの指定は不要。Node.jsのstageで `npm ci` と `npm run build` を実行し、
生成した `dist` をNginxの `production` stageへコピーする。
最終stageが `production` なので `--target production` は省略可能。
runtimeにはNginxと設定生成用のjqを配置し、Node.js・npmは含めない。
`.env*`、`node_modules`、`dist` は `.dockerignore` でビルドコンテキストから除外する。

## 本番イメージの起動

```sh
docker run -d --name chronolist-frontend-local -p 127.0.0.1:5174:80 -e API_BASE_URL=http://localhost:8080 chronolist-frontend:local
docker logs chronolist-frontend-local
```

`http://localhost:5174` で画面を確認する。
起動時に `API_BASE_URL` を検証し、`/usr/share/nginx/html/config.js` を生成してからNginxを起動する。
設定ファイルはアプリのJavaScriptより先に読み込まれる。

| 項目 | ルール |
| --- | --- |
| URLの例 | `https://api.example.com`、`https://example.com/backend/` |
| 接続元 | ブラウザから到達できるURLを指定。APIプロキシ使用時は公開Frontend Originを指定し、内部サービス名はBACKEND_UPSTREAMへ設定 |
| APIパス | `/api/` を含めない。Axiosが `api/` を付与する |
| 末尾スラッシュ | `getApiBaseUrl()` が1つに正規化する |
| スキーム | HTTPまたはHTTPSの絶対URL |
| 使用できない値 | 空値、認証情報、クエリ、フラグメント、空白、バックスラッシュ、不正なポート |
| 設定不備 | 未設定・不正値では起動に失敗する。ログで原因を確認する |

`config.js` はブラウザに公開されるため、認証情報を含めない。
API URL専用の `src/config/apiBaseUrl.ts` が `getApiBaseUrl()` を公開する。
開発時の `import.meta.env.VITE_API_BASE_URL` と本番の `window.__APP_CONFIG__.API_BASE_URL` の切り替え、
未設定チェック、URL検証、末尾スラッシュ調整をここに集約する。
本番設定の欠落時に開発用の値へフォールバックしない。

### 開発Backendとの通信確認

開発Backendの既定の許可Originは `http://localhost:5173`。
上記の5174番からBackendへ直接接続する場合は、Backend側のFRONTEND_ORIGINへ5174番を
追加して再起動するか、下記のように既定の5173番で検証する。
許可Originは環境設定で変更でき、Controllerの修正は不要。

既存の開発Backendと通信確認する場合は、開発Frontendを一時停止し、本番Frontendを5173番で起動する。

```sh
docker compose stop frontend
docker run -d --name chronolist-frontend-check -p 127.0.0.1:5173:80 -e API_BASE_URL=http://localhost:8080 chronolist-frontend:local
```

検証後は検証コンテナを停止・削除して開発Frontendを戻す。Backendの再起動は不要。

```sh
docker stop chronolist-frontend-check
docker rm chronolist-frontend-check
docker compose start frontend
```

## 同一OriginでのAPI公開（Cloud Run向け）

本番は1つのCloud RunサービスにNginxとBackendを別コンテナとして配置する。
入口は既存のNginxコンテナの80番ポートとし、Cloud Run側でも入口ポートを80に設定する。
Backendは入口に指定せず、サービス外から直接アクセスさせない。

| コンテナ | 設定 |
| --- | --- |
| Frontend Nginx | `API_BASE_URL=https://<service-url>.run.app` |
| Frontend Nginx | `BACKEND_UPSTREAM=http://127.0.0.1:8080` |
| Backend | `SPRING_PROFILES_ACTIVE=prod`、`FRONTEND_ORIGIN=https://<service-url>.run.app` |
| Backend | `SERVER_PORT=8080`、既存の本番DB接続設定 |

API_BASE_URLとFRONTEND_ORIGINは同じ公開Originを指定する。BACKEND_UPSTREAM指定時の
API_BASE_URLはパスなしのOrigin（末尾 `/` は可）が必須。BACKEND_UPSTREAMはプライベートな
HTTP Originだけを受け付け、認証情報・パス・クエリ・フラグメントや不正ポートを拒否する。
同一Cloud Runサービス内ではlocalhost経由で通信でき、独自ドメインは不要。

Nginxは `/api/*` のパスを維持して転送し、Cookie・Set-Cookie・Originをそのまま扱う。
HostとX-Forwarded-Host / Proto / Portは公開API_BASE_URLから生成し、呼出元が指定した
Forwarded・X-Forwarded-Prefix / Sslは除去する。X-Forwarded-Forは入口の接続元アドレスで上書きする。
Backendはprodで転送情報を解釈するため、バックエンドのポートを直接外部公開しない。
Cookie属性はBackendが管理し、Nginxでは書き換えない。

APIの401 / 403等をSPAのindex.htmlへ置き換えない。`/api` 自体はJSONの404を返す。
BACKEND_UPSTREAM未設定なら静的配信・外部API直接接続の既存モードを維持し、Nginxへの
`/api/*` はJSONの404（API_PROXY_NOT_CONFIGURED）とする。
設定変更にはコンテナの再作成が必要。Cloud Runの配置・起動順・Secret設定はCHRON-152で扱う。

### 転送設定とローカルHTTPSの検証

```powershell
docker build --target production -t chronolist-frontend:chron-151-step6 ./frontend
$testDirectory = (Resolve-Path ./frontend/tests).Path
docker run --rm --mount "type=bind,source=$testDirectory,target=/tests,readonly" --entrypoint sh chronolist-frontend:chron-151-step6 /tests/api-config.test.sh
docker run --rm --mount "type=bind,source=$testDirectory,target=/tests,readonly" --entrypoint sh chronolist-frontend:chron-151-step6 /tests/api-proxy.test.sh
docker compose exec -T backend sh ./gradlew bootJar --no-daemon
./frontend/tests/api-proxy-integration.ps1
```

HTTPS結合スクリプトは既存のJava 25入りBackendイメージ（既定chronolist-backend:latest）を利用し、
ビルド済みJARを直接起動する。イメージ名が異なる場合はBackendImage / FrontendImage引数で指定する。
PowerShell 7・Docker・curl.exeを使用し、27項目を検証する。
prod設定のBackendを使うが、DB接続とSQL初期化は使い捨てH2向けにテスト時だけ上書きする。
本番DB接続情報やローカル.envは読み込まない。この上書きを実デプロイへコピーしない。

一時TLS入口→HTTPのFrontend Nginx→HTTPのBackendという構成で、Cloud RunのTLS終端を模擬する。
curlの `--cacert` で一時証明書とホスト名を検証し、TLS検証の無効化やPCの信頼設定変更は行わない。
終了時に専用コンテナ・ネットワーク・証明書を削除する。通常の開発コンテナは停止しない。
実際のCloud RunやTiDBの検証とは区別する。

## API URLの変更

同じイメージで、環境変数を変更してコンテナを再作成する。
以下は5174番のローカル確認用コンテナの変更例。

```sh
docker stop chronolist-frontend-local
docker rm chronolist-frontend-local
docker run -d --name chronolist-frontend-local -p 127.0.0.1:5174:80 -e API_BASE_URL=https://api.example.com chronolist-frontend:local
```

イメージの再ビルドは不要。既存コンテナの `docker restart` だけでは環境変数を変更できない。
以前の `config.js` をマウントする必要はない。起動済みの画面はリロードして新しい設定を読み込む。

## 配信・キャッシュ設定

| パス | 応答 |
| --- | --- |
| React Routerの画面URL | ファイルが存在しなければ `index.html` を返す |
| `/index.html` | `Cache-Control: no-cache` で利用前に更新を確認する |
| `/config.js` | `Cache-Control: no-store`。欠落時は404 |
| `/assets/` | 静的ファイルを配信。存在しなければ404 |

`npm run preview` は起動時設定を生成しない。本番成果物の動作確認にはDockerイメージを使う。

## 動作確認

実施済みの確認結果は [VERIFICATION.md](VERIFICATION.md) を参照。

1. API URL未指定で本番イメージをビルドする。
2. `API_BASE_URL` を指定して起動し、`/config.js` の値と `no-store` を確認する。
3. `/`、`/login`、`/signup`、`/scheduler`、`/todolist`、`/timeblocking`、`/test`、`/test/todolist`、`/test/scheduler` へ直接アクセスし、リロードでも表示されることを確認する。
4. ヘッダーから各画面・ホームへ移動する。
5. 開発Backendの検証用ユーザーでログインし、各画面のデータ取得を確認する。
6. 同一イメージを異なるAPI URLで再作成し、リロード後の設定・通信先が切り替わることを確認する。
7. 未設定・不正な `API_BASE_URL` では起動に失敗することを確認する。
8. 存在しない `/assets/missing.js` と、削除した `/config.js` が404になり、HTMLへfallbackしないことを確認する。
9. 検証後に開発Frontendを戻し、ログイン・API通信が動くことを確認する。

設定生成・欠落の検証には使い捨てコンテナを使用する。
本番ホスティング構築・CI/CDは別チケットで扱う。CORS・API転送設定はCHRON-151で整備する。

### 起動時URL検証の回帰テスト

本番イメージをビルドした後、PowerShellで次を実行する。
テストは一時コンテナで実行し、正常なドメイン・IPv4・IPv6、
不正URL、未設定での起動失敗と設定ファイル生成を確認する。

```powershell
$testDirectory = (Resolve-Path ./frontend/tests).Path
docker run --rm --mount "type=bind,source=$testDirectory,target=/tests,readonly" --entrypoint sh chronolist-frontend:local /tests/api-config.test.sh
```

IPv4は4組の10進数（各0〜255、不要な先頭ゼロなし）を指定する。
IPv6は角括弧で囲んだ16進表記を使用する。
