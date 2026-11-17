# worktreeごとに開発環境を起動する

各worktreeに専用のCompose project、FE/BEポート、`*.localhost` ホスト名を設定する。
同じブラウザの別タブで複数環境へログインできる。DB・セッションはBackend内のH2であり、
別のDBサービスや本番の接続情報は不要。

## 前提

- ホスト側にDocker Compose v2とPython **3.10以上**を用意する。
- 以下の `python3` は、Windowsでそのコマンドがない場合は `python` に読み替える。
- スクリプトは**ホストで**実行する。対象はスクリプト自身が属するworktreeであり、
  別のカレントディレクトリから実行しても対象は変わらない。
- 既存のルート `.env` がある場合、上書きしない。通常開発の設定を保持したまま使うなら、
  新しいworktreeを作成する。生成した `.env` を別worktreeへコピーしない。

## 2つの環境を準備する

リポジトリルートで、検証したいコミットからworktreeを作る。ブランチ名・配置先は必要に応じて変える。

```sh
git worktree add ../chronolist-a -b dev/worktree-a HEAD
git worktree add ../chronolist-b -b dev/worktree-b HEAD

python3 ../chronolist-a/scripts/worktree-dev.py init --slot 1
python3 ../chronolist-b/scripts/worktree-dev.py init --slot 2

python3 ../chronolist-a/scripts/worktree-dev.py up
python3 ../chronolist-b/scripts/worktree-dev.py up
```

`init` はGit除外済みのルート `.env` を生成する。設定は秘密情報を含まない。
worktreeの絶対パスからproject名を作るため、同じフォルダ名でも配置先が違えば分離される。
`--slot` は0〜9999。FEポートは `20000 + 2 × slot`、BEはその次。
省略すると絶対パスから候補を選ぶが、他環境とのポートの重複を保証するものではない。
チーム内の別PCでは同じslotを使用できる。同じPCでは別slotにする。

`init` / `up` / `status` は次の形式で専用URLを表示する。

```text
Project:  chronolist-<識別子>
Frontend: http://chronolist-<識別子>.localhost:20002
Backend:  http://chronolist-<識別子>.localhost:20003
```

**表示されたFrontend URLでアクセスする。** 起動直後はBEのGradleビルド・初期化が続くため、
接続できない場合は `logs` で `Started Application` とViteの起動を確認する。
初回はイメージと依存関係のダウンロードに時間がかかる。

## 初期データ・ログイン

各環境の `/signup` で検証用アカウントを作成し、`/login` からログインする。
同じログインIDを各環境に登録してよい。パスワードは8〜63文字の半角英数字を含む値にする。
スキーマとサンプルデータは既存の `schema.sql` / `data.sql` から起動時に投入される。
seed済みadminの認証情報を用意する必要はない。

ToDo・予定・タイムブロック画面を確認する。同じブラウザプロファイルの別タブでも、
Cookieは専用ホストのhost-only Cookieとして分離される。FEとBEは同じホスト名の別ポートを使い、
API URLとBEのCORS許可Originは生成設定で一致させる。
`localhost:<port>` や `127.0.0.1:<port>` にURLを書き換えると正しいCORS・Cookie分離を検証できない。

## 操作一覧

以下は操作対象のworktree内で実行する。

| コマンド | 動作 |
| --- | --- |
| `python3 scripts/worktree-dev.py init` | ローカル設定を生成。設定済みなら保持 |
| `python3 scripts/worktree-dev.py up` | FE/BEをビルド・起動。起動済みでも実行可能 |
| `python3 scripts/worktree-dev.py status` | 停止中を含むコンテナ状態と専用URLを表示 |
| `python3 scripts/worktree-dev.py logs` | FE/BEの直近100行のログを表示 |
| `python3 scripts/worktree-dev.py stop` | FE/BEを停止 |
| `python3 scripts/worktree-dev.py restart` | FE/BEを再起動し、H2を初期化 |
| `python3 scripts/worktree-dev.py down` | このprojectの全コンテナ・ネットワークを削除。Volumeは保持 |
| `python3 scripts/worktree-dev.py destroy` | このprojectの全コンテナ・ネットワーク・名前付きVolumeを削除 |

H2はインメモリのため、**Backend停止・再起動で作成データとログインセッションが失われる**。
初期状態に戻すだけなら `restart` を使い、再度signup・loginする。
`destroy` はnode_modulesやGradleキャッシュ等のVolumeも消すため、通常のDBリセットには不要。
`down` / `destroy` は同じprojectのDevContainerも対象となるので、先にエディタを閉じる。
別projectに対するDocker全体のpruneは行わない。`.env` は削除せず、同じURLで再作成できる。

### ポートが衝突した場合

`up` は他プロセスが使用するポートを検出すると失敗し、自動で別ポートへ変更したり、
既存環境を停止したりしない。Docker起動までの間に競合が起きた場合もDockerがbindエラーを返す。
変更する側のworktreeで、次の手順を実行する。

```sh
python3 scripts/worktree-dev.py down
```

このworktreeの生成済み `.env` を削除する（手書きの `.env` は削除しない）。続けて実行する。

```sh
python3 scripts/worktree-dev.py init --slot 3
python3 scripts/worktree-dev.py up
```

変更前の環境を停止せず `.env` を編集・削除すると、古いコンテナを取り残す原因になる。
設定の編集や別worktreeからのコピーはスクリプトが拒否する。
worktreeを移動・削除するときも**元の場所で先に `destroy`** を実行する。
移動後は元の生成 `.env` を削除し、移動先で `init` し直す。

## DevContainer

1. ホストで対象worktreeの `init` を実行する。
2. VS Codeでそのworktreeのフォルダを開き、Reopen in Containerを実行する。
3. 専用Frontend URLをホストのブラウザで開く。VS Codeのポート転送URLへ置き換えない。

既存の `.devcontainer/devcontainer.json` はルートComposeを使う。
Dev Containersは `.env` の `COMPOSE_PROJECT_NAME` / Composeが解決したproject名を採用するため、
CLIと同じコンテナ・Volumeを利用する。5つのVolumeはproject単位で分離される。
FEと同じworktreeのDevContainerだけが `frontend_node_modules` を共有する。
コンテナ内の `/workspace` はホストと異なるパスなので、そこで `init` を実行しない。
起動・停止・削除のコマンドもホスト側で実行する。

Git worktreeの `.git` は元リポジトリへの参照ファイルであり、現在のDevContainerはその参照先を
マウントしない。コンテナ内でGitが参照先を見つけられない場合、Git操作はホストで行う。

### 名前解決・設定が想定と異なる場合

ブラウザは通常 `*.localhost` をループバックへ解決する。
名前解決できない場合は、`init` が表示する**正確なホスト名**をホストOSのhostsファイルで
`127.0.0.1` へ登録する。例:

```text
127.0.0.1 chronolist-<識別子>.localhost
```

実際の識別子へ置き換える。ワイルドカードは使わず、各環境を1行ずつ登録する。
スクリプトはhostsを書き換えない。プロキシを使う場合は専用ホスト名をプロキシ対象から除外する。

直接の `docker compose` やDevContainer起動では、シェルに残っている
`COMPOSE_PROJECT_NAME`、`COMPOSE_FILE`、`COMPOSE_ENV_FILES`、`CHRONOLIST_*` 等が
`.env` より優先されたり、構成を変えたりする。ホスト側でそれらを解除してから起動する。
通常のライフサイクル操作は、それらの継承を除外してprojectとComposeファイルを固定する
`worktree-dev.py` を使う。Docker context / `DOCKER_HOST` は通常のDocker CLIと同じものを使うため、
ローカルdaemonを選択する。リモートdaemonではホストbind mountとポート確認の前提が異なる。

## 分離の確認手順

1. 2環境に同じIDでsignup・loginし、同じブラウザプロファイルで主要画面を開く。
2. Aで作成したToDoがBには表示されないことを確認する。
3. Aをログアウトし、Bの再読込とデータ取得が成功することを確認する。
4. Aの `stop` / `up` / `restart` 後もBのログイン・データが維持されることを確認する。
5. Aの `destroy` 後もBが動作することを確認する。
6. DevToolsでCookieのDomainが各専用ホストで分かれ、API通信先とCORS許可Originが一致することを確認する。
7. 各projectのコンテナ・ネットワーク・名前付きVolumeが別名で、source mountが各worktreeを指すことを確認する。

設定・ライフサイクルの自動検証はリポジトリルートから実行する。Compose展開の検証にはDocker CLIが必要。

```sh
python3 -m unittest discover -s scripts/tests -v
```

通常の単一環境開発は、生成 `.env` のないcheckoutで従来どおり
`docker compose up -d --build backend frontend` を使用できる。
