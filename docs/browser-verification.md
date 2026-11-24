# worktree ごとのブラウザ検証

CHRON-217 / CHRON-219 の検証入口。Playwright Test のヘッドレス Chromium で、
実際の画面・API・H2 を通して確認する。モックや保存済みのログイン状態は使用しない。

## アプリ起動を伴わない画像helperの回帰

Node.js 24 と Chromium を用意し、`frontend/` で実行する。
このコマンドは独立した `playwright.browser.config.ts` を使用する。
`.env`・E2E URL・Compose・Frontend/Backend の起動は不要で、アプリ用の設定を読み込まない。

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:browser
```

Windows では `npx playwright install chromium` でよい。
実 DOM とテスト用画像応答を使い、画像の decode、画面外 lazy 画像、候補のない placeholder、
srcset/picture の読込待機、失敗・timeout 時の属性復元を検証する。
アプリの認証・API・保存や CSS 背景画像の準備を保証するものではない。
Node.js 24 の Frontend CI でも同じコマンドを実行する。

結果は `frontend/e2e-results/browser/<実行ID>/` の `results.json`、`report/`、`artifacts/`。
実行IDを worker に引き継ぎ、同じ実行の成果物をまとめる。各実行は別ディレクトリとなる。
この生成先も Git と Docker build context から除外される。

## セットアップと起動

Git、Python 3.10 以降、Docker Compose、Node.js 24 をホストに用意する。
新しい worktree を作成し、そのルートで以下を実行する。
既存の手書き `.env` は上書きしない。詳細は [開発環境の手順](../README.md) を参照する。

```sh
git worktree add ../chronolist-browser -b codex/browser-check develop
cd ../chronolist-browser
python scripts/worktree-dev.py init
python scripts/worktree-dev.py up
python scripts/worktree-dev.py status
cd frontend
npm ci
npx playwright install chromium
```

Linux でブラウザのシステムライブラリも必要なら
`npx playwright install --with-deps chromium` を使用する。
初回のビルド・起動には時間がかかる。専用 Frontend URL でログイン画面が
開けるまで待ってから実行する。Playwright は Compose の起動・停止をしない。

## 検証を実行する

`frontend/` で実行する。生成済みの worktree ルート `.env` から両 URL を読む。
環境変数で指定する場合は両 URL を指定する。対象は検証専用の `*.localhost` のみ。

```sh
npm run test:e2e
```

既定では smoke が実行され、peer 未指定の隔離テストは skip と表示される。
毎回ランダムな検証ユーザーと初期 ToDo を作成し、UI ログイン、
ToDo の新規登録・リロード後の表示、Scheduler と Timeblocking の
画面表示および実 API の取得成功を確認する。
ユーザー ID・パスワードを設定ファイルに登録する必要はない。

PowerShell で URL を明示し、成功時にも trace / screenshot を保存する例:

```powershell
$env:E2E_BASE_URL = 'http://chronolist-xxxxxxxxxxxxxxxx.localhost:20000'
$env:E2E_API_BASE_URL = 'http://chronolist-xxxxxxxxxxxxxxxx.localhost:20001'
$env:E2E_ARTIFACTS = 'all'
npm run test:e2e
Remove-Item Env:E2E_BASE_URL, Env:E2E_API_BASE_URL, Env:E2E_ARTIFACTS
```

`E2E_ARTIFACTS=failures` が既定。失敗時だけ trace と screenshot を残す。
`all` では成功時も両方を残す。CLI の `--trace on` でも trace を常時保存できる。
成功時 screenshot は各テスト終了時点の画面で、操作ごとの画像ではない。
失敗時の終了コードは非 0、全実行テストが成功すれば 0。
URL 設定エラーも非 0 だが、ブラウザ開始前なので trace / screenshot は生成されない。

## 2 worktree の分離を検証する

2つ目の worktree でも `init` と `up` を行う。
ポート衝突時は [worktree の手順](../README.md) に従って別 slot を選ぶ。
生成された `.env` を別 worktree にコピーしない。
片方の `frontend/` で、相手の `status` に表示された両 URL を指定する。

```powershell
$env:E2E_PEER_BASE_URL = 'http://chronolist-yyyyyyyyyyyyyyyy.localhost:20002'
$env:E2E_PEER_API_BASE_URL = 'http://chronolist-yyyyyyyyyyyyyyyy.localhost:20003'
npm run test:e2e
Remove-Item Env:E2E_PEER_BASE_URL, Env:E2E_PEER_API_BASE_URL
```

同じブラウザ context 内で両 URL を使い、primary のセッションで peer API に認証されないこと、
primary のユーザーで peer にログインできないこと、それぞれの ToDo がもう片方に現れないこと、
両方にログイン後も primary が使えることを確認する。
同じホスト名でポートだけ変えた peer は Cookie の隔離にならないため拒否する。
両 worktree から実行すれば、それぞれの worktree に結果が残る。
Compose project・ホスト名・ポート・Volume の分離は `worktree-dev.py status` と
`docker compose ls` でも確認できる。

## 結果を確認する

結果は各 worktree の `frontend/e2e-results/<対象URLのハッシュ>/<日時とランダムID>/` に保存する。
同じ URL を再実行しても前の結果を上書きしない。生成物は Git の対象外で、Docker のビルドコンテキストからも除外する。

- `results.json`: 成否、skip、実行時間などの機械可読結果。
- `report/index.html`: HTML レポート。
- `artifacts/`: テストごとの trace.zip、screenshot、失敗時の追加情報。

```sh
npm run test:e2e:report -- e2e-results/<URLハッシュ>/<実行ID>/report
npx playwright show-trace e2e-results/<URLハッシュ>/<実行ID>/artifacts/<テスト>/trace.zip
```

trace には実行時の検証用認証情報・セッション・画面/API データが含まれる場合がある。
通常のユーザーや実データは使用せず、結果を共有する前に内容を確認する。
不要な実行ディレクトリは削除してよい。自動削除はしないため容量に注意する。

## 終了と制約

worktree ルートで `python scripts/worktree-dev.py down` を実行する。
キャッシュ Volume も不要なら `destroy` を使う（その worktree の環境だけが対象）。
Backend の H2 はメモリ上にあり、停止・再起動で検証ユーザー・データ・セッションは消える。
実行ごとのユーザーは削除 API がないため起動中は残る。再実行は新しいユーザーを作る。

この検証はローカル HTTP 開発環境向け。本番 DB、HTTPS 配置、共有セッション、
全操作や全ブラウザの検証を代替しない。
Docker の Playwright イメージで実行する場合は npm の `@playwright/test` と同じ版を使い、
専用 hostname をホストの Compose 公開ポートへ到達できるよう設定する。
通常のコンテナ loopback はホストとは別である。
API の準備・照合もブラウザ内の `fetch` で行うため、OS の hosts を変更せず、
Chromium の `*.localhost` 名前解決、実際の Cookie と CORS を通して検証する。

## 操作途中・結果の証跡

テスト終了時 screenshot では不足する指定地点には
[capture-evidence](../.agents/skills/capture-evidence/SKILL.md) を使う。
ToDo 入力途中と登録・再読込後は同梱計画と capture-evidence.spec.ts で取得できる。
EVIDENCE_PLAN を明示しない通常の E2E ではこのテストを skip する。
結果は既存 resultPath と同じ URL/実行別の evidence/ 配下。取得状態と確認状態は別に記録する。
要求/コード/環境が現在差分に有効な画像のみ再利用し、trace は共有前に認証情報を確認する。

個別の検証結果・消費評価・クライアント実機確認は
[CHRON-220 開発メモ](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/7176193/CHRON-220) を参照する。
