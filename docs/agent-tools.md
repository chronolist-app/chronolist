# Codex / Claude Code の共通設定と PR 作成スキル

## 共通ルールの読み込み

共通ルールの正本はルートの [AGENTS.md](../AGENTS.md)。
Codex はリポジトリルートから作業ディレクトリまでの `AGENTS.md` を読み込む。
Claude Code は v2.1.277 以降で直接読み込めるが、親ディレクトリ等の `CLAUDE.md` の存在や
Project instructions 設定で読み込まれない場合がある。旧版等にも対応するため
[CLAUDE.md](../CLAUDE.md) は `@AGENTS.md` の1行だけとし、規約本文を複製しない。
個人・管理者の設定によってプロジェクト指示やスキルが無効化される場合は、その設定を確認する。

新規セッションをリポジトリ内で開始し、Codex では読み込んだ指示ファイルを尋ねる。
Claude Code では `/memory` または `/context all` で確認する。単にファイルが存在することと、
各クライアントのセッションで実際に読み込まれることは区別する。

## スキルの配置と呼び出し

既存のプロジェクト用スキル・個人用 PR 作成スキルは実装時に見つからなかった。
Codex の探索先 `.agents/skills/create-pr/` に手順・テンプレート・Python スクリプトを集約する。
Claude Code の探索先 `.claude/skills/create-pr/SKILL.md` は共有手順への入口のみ。
Windows でのチェックアウトも考慮し、symlink やグローバル設定の変更を必要としない。
Claude Code 側は `disable-model-invocation: true` とし、明示呼び出しで使う。

リポジトリ内で新規セッションを開始し、次のように依頼する。

```text
Codex: $create-pr feature/CHRON-196 --ticket CHRON-196
Claude Code: /create-pr feature/CHRON-196 --ticket CHRON-196
```

必要に応じて `--base release/example` を追加する。既定は `develop`。
`main` 指定時はスキルが今回の操作に対するユーザー確認を求める。
チケット引数を省略した場合はエージェントが会話・ブランチ名から判断し、不確かなら確認する。
共有スクリプトは推測せず、確定した `--ticket` を受け取る。
同名の個人スキルがある場合はセレクタでプロジェクト側のファイルを確認する。

## 実行環境・処理の範囲

必要ツールは Git、Python 3.10 以降（標準ライブラリのみ）、認証済みの GitHub CLI (`gh`)。
認証・ネットワークは実行環境の設定を利用し、秘密情報をファイルに書き込まない。
現在の `origin` の取得先・push 先が同じ github.com リポジトリであることを確認する。
SSH と HTTPS を利用できる。Enterprise ホスト・フォーク・複数 push URL・mirror は対象外で、停止する。

スクリプトは作成元のローカルブランチとリモートのベースを検証し、fetch した最新のコミットと比較する。
現在のブランチは切り替えない。未コミット変更は含めず警告する。差分なしやブランチ分岐では停止する。
未 push コミットは明示した作成元だけを通常 push し、失敗時は PR を操作しない。
同じリポジトリ・作成元・ベースの open PR は本文だけ更新する。closed / merged PR は再利用しない。
既存 PR を一意に判定できない場合は停止する。API エラーを「PR なし」とは扱わない。
検証・実操作の代行、CI の監視、PR のマージは行わない。

スクリプトの `--dry-run` は fetch・認証・既存 PR の照会まで。push・PR 書き込みはしない。
本文はスキル内テンプレートからエージェントが準備し、`--body-file` で渡す。
スクリプトは6見出し・順序・チケットリンク・未展開の変数を確認するが、検証結果の真偽は
機械判定できないため、実施済みの記録と照合するのはエージェントの責務。
`--confirm-main` はユーザー確認の代替ではなく、確認を得た後だけ使う。

## 副作用のない回帰テスト

Git と Python を用意し、リポジトリルートで実行する。Linux / Windows 共通で、
偽の実行ファイルや GitHub CLI のインストールは不要。

```sh
python3 -B -m unittest discover -s .agents/skills/create-pr/tests -v
```

Windows で Python のコマンド名が `python` の場合は、上の `python3` を `python` に置き換える。

テストは一時ディレクトリの Git リポジトリ・bare リモートを使い、GitHub CLI の呼び出しは
Python のモックで差し替える。shebang や実行ファイルの探索順には依存しない。
ファイルと外部コマンド出力は UTF-8 を明示し、成功・失敗ともに作業ディレクトリを復元してから後片付けする。
Git の通信はローカルの file プロトコルに制限し、GitHub の認証情報・実リポジトリ・実際の PR には触れない。
CI は Linux / Windows の Python 3.13 で実行し、UTF-8 モードを無効にしたうえで
文字コード指定漏れの警告をエラーとして扱う。
実サービスでの作成・更新や、両クライアントの新規セッション確認は別の検証である。

## 確認した公式仕様

2026-11-15 に公式ドキュメントで配置と読み込み仕様を確認。

- [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/)
- [Codex skills](https://developers.openai.com/codex/skills/)
- [Claude Code memory / AGENTS.md](https://code.claude.com/docs/en/memory#agentsmd)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
- GitHub CLI のインストール済みバージョンで `gh pr list --help`、`gh pr create --help`、`gh pr edit --help` を確認する。

## 要求に合わせた操作証跡

操作途中・結果画面の取得には [capture-evidence](../.agents/skills/capture-evidence/SKILL.md) を使う。
`$capture-evidence`（Codex）/ `/capture-evidence`（Claude Code）に目的・対象・期待状態を渡す。
共有手順は .agents、Claude の入口は .claude に置き、symlink は不要。
ユーザー要求のある証跡だけを対象とし、全実装・全 PR での撮影を義務化しない。
PR 作成時は必要証跡の充足を確認し、有効な既存記録を再利用、不足時だけ capture-evidence を呼ぶ。
この要求範囲の証跡取得が、create-pr の通常の検証を新規実行しない規則の例外となる。

副作用のない記録・計画・再利用判定は frontend で `npm test` に含めて検証する。
画像helperの実ブラウザ回帰は `frontend/` の `npm run test:browser`。独立設定を使い、`.env`・E2E URL・アプリ起動は不要。準備と保証範囲は [ブラウザ検証手順](browser-verification.md) を参照。
アプリ操作の例、保存形式、モデル指定と評価方法はスキル内 references を参照。
個別の実施結果は [CHRON-220 開発メモ](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/7176193/CHRON-220) に記録する。
