# CHRON-218: worktreeごとに独立したCompose開発環境

状態: 方式1・設計とも承認済み。実装とLinux上の2worktree・同一ブラウザ検証を完了。

## 目的と範囲

異なる2つ以上のGit worktreeでChronolistを同時に動かし、同じブラウザから
ログインと主要画面を検証できるようにする。後続のPlaywright導入の前提となる。
一方のデータ変更、ログアウト、Backend再起動、Compose停止が他方に影響しないことを目標とする。

通常の `docker compose up -d --build backend frontend` は引き続き
`http://localhost:5173` / `http://localhost:8080` で動作する。
本番の認証・DB構成、DB永続化、Playwrightテストコードの追加は対象外。

## 現状と制約

- `compose.yaml` はFE・BEのホストポートを5173・8080に固定している。
- 固定 `container_name`、外部ネットワーク、固定実名のVolumeはない。
  5つの名前付きVolumeはCompose project単位で分離できる。
- BackendのdevはインメモリH2。SQLで業務データとSpring Sessionのテーブルを初期化する。
  DBコンテナやDB用Volumeは不要で、Backend再起動によりデータとセッションが消える。
- ソースのbind mountはworktree内への相対パス。Git共通ディレクトリをデータ領域には使っていない。
- Cookieは `JSESSIONID`、Path `/`、Domainなし、HttpOnly、SameSite=Lax。
  Cookieはポートで分離されないので、localhostのポートを変えるだけでは衝突する。
- FEは絶対URLの `VITE_API_BASE_URL` を使い、共通AxiosがCookie・CSRFを処理する。
  BEのCORSは `FRONTEND_ORIGIN` で指定可能。
- DevContainerも同じComposeを使用し、FEとnode_modules Volumeを共有する。
- Docker Compose v2とローカルDocker daemonを前提とする。補助スクリプトはPython 3.10以上の標準ライブラリを使う。
  WindowsでもPython 3とDocker Desktopから利用できるよう、シェル依存を避ける。

## 検討した方式

1. **専用 `*.localhost` と専用ポートを使う（利用者が選択）**。
   project名、ホスト名、ポート、API URL、CORSをworktreeのローカル設定で揃える。
   host-only Cookieがブラウザ内でも分離され、普段のブラウザで同時に確認できる。
   `*.localhost` の名前解決が必要。
2. **localhostの別ポートと専用ブラウザコンテキストを使う**。
   ホスト名設定は不要だが、手動検証にもプロファイルの使い分けが必要となる。
   ブラウザ操作を誤ると認証状態が干渉するため採用しない。

以下の具体的なスクリプト・ポート割当・操作仕様は実装担当からの提案であり、
方式1の選択時点で個別に承認されたものではない。

## 識別子・設定

`scripts/worktree-dev.py` を追加する。実行したカレントディレクトリではなく
スクリプトが属するリポジトリルートを対象にする。

- 正規化したworktreeルートの絶対パスから短いSHA-256識別子を作り、
  `chronolist-<識別子>` をCompose project名およびホスト名のラベルに使う。
  同じbasenameの別worktreeでも別識別子になる。ホスト名は `<project>.localhost`。
- `init` はそのworktreeの、既にGit除外されているルート `.env` を生成する。
  `COMPOSE_PROJECT_NAME`、FE/BEポート、専用ホスト名、API URL、CORS Origin、
  必要なホストbind設定を保存する。秘密情報は含めない。
- ポートは識別子から導く候補スロットを使い、20000〜39999の連続する2ポートを割り当てる。
  候補は確率的に衝突し得るため、空き確認とDockerのbindエラーで失敗を検出する。
  `init --slot N`（0〜9999）で別の組に明示指定できる。
  FEは `20000 + 2*N`、BEはその次。起動のたびにURLを変えない。
- 生成ファイルには管理用マーカーを付ける。既存の管理対象外 `.env` は上書きしない。
  管理対象の再initは同じ設定なら冪等に扱う。割当変更は先に対象projectを停止し、
  操作者が明示的に再設定する手順に限定する。
- worktree移動・削除前には停止する。移動時は元のprojectを片付けてから設定を再生成する。
  コピーした他worktreeの設定は、パス識別子照合で拒否する。
- スクリプトからのCompose実行は対象ディレクトリ・Composeファイル・設定・project名を
  明示し、外から継承したCompose関連設定や同名環境変数で別環境を操作しないようにする。

ルート `.env` を使うことで、同じworktreeでの直接の `docker compose` と
DevContainerも同じproject・ポート設定を読み込める。直接実行時にはシェルの同名環境変数や
`-p` / `--env-file` が優先される点を文書化し、worktreeの通常操作はスクリプトを推奨する。

## Compose・URL・認証

`compose.yaml` のホストポート・API URL・CORS Originを既定値付き変数にする。
生成設定のない通常開発では従来値を使う。worktree起動の公開ポートは127.0.0.1へbindする。
コンテナ内部のポートはFE=5173、BE=8080を維持する。

同じ環境のFEとBEは同じ専用ホスト名を使い、ポートだけを分ける。
例えばFE=`http://chronolist-abc.localhost:20000`、BE=`http://chronolist-abc.localhost:20001`。
BEはFEの正確なOriginだけを許可する。Cookie・CSRF・SameSiteの実装は変更しない。
CookieのDomainは追加せず、兄弟ホストへ認証状態を送らない。
環境専用URLを表示し、worktreeのBEへlocalhost経由でアクセスするとCookie分離を
回避してしまうため、検証には専用URLを使うと説明する。

Viteのホスト検証に専用ホストを渡す必要がある場合は、対象ホストだけを追加し、
`allowedHosts: true` 等の全面許可は使わない。HMRが専用URLでも動くことを確認する。
`.localhost` が解決されない環境では、表示された正確なホスト名を127.0.0.1へ
hosts登録する手順を示す。hostsファイルはスクリプトから書き換えない。

## コンテナ・Volume・DevContainer

コンテナ、ネットワーク、5つの名前付きVolumeは同じworktreeのproject名でまとめる。
固定実名や共通bind mountを追加しない。相対ソースbind mountを維持する。
BuildKitの共有Gradle取得キャッシュは開発DB・セッション・実行中のソースとは別であり、
現状のロック付き取得キャッシュは維持する。

DevContainerはホストで先に `init` を実行してから、そのworktreeのフォルダを開く。
ルート `.env` と同じComposeを使用する。コンテナ内 `/workspace` から再initしない。
DevContainer拡張のproject名処理を確認し、必要な設定差分を加えてCLIと同じprojectになるようにする。
コンテナ内ではなく、ホストのDocker CLIを環境操作の入口とする。

## 操作と片付け

公開する操作は `init`、`up`、`status`、`logs`、`stop`、`restart`、`down`、`destroy` とする。

- `up`: 設定を検証し、ポート競合を確認してFE・BEをビルド・起動し、URLを表示する。
  起動済みの自環境をポート競合と誤認しない。競合時はURLを自動変更せず別slotを案内する。
- `status` / `logs`: 対象projectの状態・ログを表示する。
- `stop` / `restart`: 対象projectのFE・BEだけを操作する。
  Backend停止・再起動後はH2のデータとセッションが失われる。
- `down`: 対象projectのコンテナ・ネットワークを削除し、キャッシュVolumeは残す。
  DevContainer利用中はその環境のエディタコンテナも停止対象になることを明示する。
- `destroy`: projectを検証し、対象projectに対して `down --volumes` を行う明示的な破棄操作。
  起動時にビルドするFE/BE以外も同projectに属することを確認する。
  他projectのコンテナ・VolumeやDocker全体のpruneは操作しない。
  ローカル設定は残し、同じURLで作り直せるようにする。

初期データは既存の `schema.sql` / `data.sql` を使用する。
検証用アカウントは各環境のsignup画面から同じID・パスワードでそれぞれ作成できる。
seed済みadminのパスワードは推測せず、新規登録による再現手順を示す。
キャッシュを消すdestroyと、DBをリセットするBackend再起動を区別して説明する。

## 検証と受け入れ

1. 設定なしのCompose展開が従来のポート・URLを維持することを確認する。
2. 別パス・同basenameのworktreeについて識別子と設定が分離され、再実行時は安定することを確認する。
3. 設定生成・引数検証・既存 `.env` 保護・コピー設定の拒否・外部環境変数の隔離・
   project限定の破棄をPython標準テストで確認する。Dockerを模したテストだけで実環境の合格とはしない。
4. 2つのworktreeのComposeを同時起動する。専用FE/BE URL、projectラベル、
   ネットワーク、Volume、ソースmountを実測する。通常環境との同時起動も確認する。
5. 同じブラウザプロファイルで両環境へsignup・loginし、ToDo・予定・タイムブロック画面を開く。
   Cookieがhost-onlyで分かれ、CORS・CSRF・HMRが正常であることを確認する。
6. 片方で同じユーザーIDのToDoを変更し、他方のデータに影響がないことを確認する。
   片方だけのlogout・stop・restart・down・destroy後も、他方のログインとデータが維持されることを確認する。
7. 空きでないslotでの起動が明確に失敗し、既存環境を停止・再設定しないことを確認する。
8. READMEと専用開発手順に、2環境の準備、URL、初期化、停止、再起動、破棄、
   DevContainer、名前解決、競合時の対処を記載する。

設計時の通常sandboxではDocker socketへのアクセスが拒否されたが、承認された権限で接続し、
2環境と同一Chromiumコンテキストでの実行検証を完了した。依存取得のネットワーク制限には
検証専用の一時Dockerfileと既存キャッシュを使用し、製品Dockerfileは変更していない。
Windowsと実際のVS Code DevContainer UIの動作は未実施。詳細は実装計画の検証結果を参照。

## 実装担当に委ねる事項

設定キーの具体名、識別子の十分な桁数、CLIの表示・内部構造、テストの配置、
DevContainerのproject名確認に応じた最小設定差分は上記の要件を満たす範囲で決める。
新しい常駐サービス、共有proxy、外部DNSサービス、実DBの追加は行わない。
