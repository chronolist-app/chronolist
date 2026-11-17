# CHRON-220 操作証跡スキルの検証記録

関連チケット: [CHRON-220](https://magu.atlassian.net/browse/CHRON-220)

2026-11-18（日本時間）に検証した。起点は `95eaf9f1400b88a3d514eea3916afccb7941d9b5`、
実装コミットは `0c3ba33ae9a540e93b0c582dc664124ceb9860da`。
着手前の staged / unstaged / untracked 変更はなく、既存の作業ブランチを継続した。

## 対応範囲と判断

チケットの要求は、必要時だけの証跡取得、取得と検証の分離、環境別保存、再利用、
実装・PR との連携、確定手順の委譲と消費評価である。
スキル・記録処理と代表シナリオ、連携資料を先に実装し、実機検証・評価を後続の単位とした。

既存基盤から判断し、Playwright Test の `fixtures` と `resultPath` を再利用した。
代表シナリオは ToDo の入力途中と登録後とし、それ以外の要求は呼出元が専用テストに具体化する。
JSON の期待状態の自由文を自動で assertion に翻訳する機能は持たない。
自動再利用は SHA・dirty 指紋・要求・URL・全地点の成功・画像存在の一致に限定する。
依存・サービス設定・データの有効性は呼出元が別に確認する。

## 完了条件と結果

番号はチケットの完了条件の順序に対応する。

| 番号 | 確認方法と結果 |
| --- | --- |
| 1 | Codex の共有 SKILL と Claude の入口を配置。別の履歴なし子エージェントから共有手順を読み、依頼別判断を確認した。Claude Code の /capture-evidence 認識と共有手順の読み込みは後述の実機追試で確認。新規 Codex クライアントの自動探索は未確認。 |
| 2 | 対象・期待状態のない依頼では取得前に確認する応答を確認。不完全な計画の実機実行も非 0 終了となり、アプリ操作へ進まなかった。 |
| 3 | draft / saved の PNG と evidence.json を取得。入力値、リロード後の一覧、実 API の存在確認が成功。呼出元・実行役が画像を目視し、文字を判読できることを確認した。 |
| 4 | 単体テストで撮影成功＋検証失敗、撮影失敗＋検証成功、未確認を分離。失敗後も画像取得を試し、後続の保存操作へ進まないことを確認した。 |
| 5 | 既存の URL・実行 ID 別保存を利用し、実機の複数実行で別ディレクトリを確認。git check-ignore と frontend/.dockerignore の除外設定を照合した。 |
| 6 | AGENTS と create-pr の連携をレビュー。必要証跡が有効な PR 依頼では追加撮影せず再利用する応答を確認。同一 SHA・clean 状態で実機再利用し、新 PNG を作らず元画像を参照した。 |
| 7 | gpt-6.1-sol / low / fork_turns: none の実行役へ URL・計画・手順・期待状態・保存先・停止条件だけを渡して取得。独自再試行は行わなかった。失敗時に停止・差し戻す判断も別のシナリオ評価で確認した。 |
| 8 | 固定操作をスクリプト化し、モデル指定と利用不能時の返却、評価列を文書化。下記の再取得・再利用を含む実測消費と参考料金を記録した。 |
| 9 | 曖昧要求・取得成功・取得失敗と検証失敗・再利用を単体テストと実機、手順の応答評価で確認。故障を注入した取得・検証失敗は単体での確認である。 |

## 実行環境とコマンド

既存の手書き `.env` を変更せず、一時 env ファイルを指定して専用の Compose project
`chronolist-chron220` を起動した。FE は `http://chronolist-chron220.localhost:23120`、
API は同ホストの `23121`。開発用 H2 の起動ログと、この checkout のソースマウントを使用した構成を確認した。
検証後にこの project のみ down し、既存環境は維持した。キャッシュ Volume は保持している。

- Node.js 24 のコンテナで `npm ci`、`npm test`（76 件）、`npm run lint`、`npm run build` が成功。
- lint は既存の Hook 依存関係の警告 11 件。build は既存の大きい chunk の警告あり。
- 新規 E2E 2 ファイルは別途 `tsc --noEmit --target ES2023 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --types node --skipLibCheck e2e/evidence.ts e2e/capture-evidence.spec.ts` で型検査が成功。
- `python -B -m unittest discover -s .agents/skills/create-pr/tests -v` は 29 件成功。
- ホストの Chromium で `playwright test smoke.spec.ts` が 1 件成功。
- `EVIDENCE_PLAN` を指定した `playwright test capture-evidence.spec.ts` が成功。
- draft だけの計画も成功。trace の登録 POST は初期データの 1 件だけで、入力した内容の保存通信と saved.png がないことを照合した。
- `git diff --check` が成功。失敗を意図した不完全計画は終了コード 1 を確認した。

ホストでは npm と通常の Python が PATH から使えないため、Playwright / tsc は既存 node_modules の
CLI を node で起動し、Python は同梱ランタイムを明示した。初回の sandbox での Python 一時領域と
ブラウザキャッシュの制限は、許可された実行で解消した。これらの初回失敗を合格扱いにはしていない。

## 代表証跡と再取得

ローカル保存先は `frontend/e2e-results/e0d0da6f11ba/` 配下。公開リンクではない。

| 実行 ID | 結果 |
| --- | --- |
| `2026-11-17T15-54-33-829Z-4d7e38c9-0420-4acc-8cba-7f457ce555d7` | 初回。assertion は成功したが、目視で draft のフェード途中の撮影を発見。最終証跡として採用しなかった。 |
| `2026-11-17T15-58-24-059Z-efa579b2-670b-498d-8c88-15e4068caf9e` | 呼出元による修正確認。ダイアログの表示安定待ちと animations: disabled により不透明な画像を確認。 |
| `2026-11-17T15-59-55-248Z-4fb1e68c-1b96-4200-ac90-7d474ce4647a` | コミット済みの最終実装を実行役で再取得。17.9 秒、draft / saved の撮影・検証とも成功。 |
| `2026-11-17T16-00-40-232Z-2c730831-a4de-4883-a52e-daab794a03b4` | 上記の evidence.json を EVIDENCE_REUSE に指定。1.9 秒で成功し、元の画像パスと reusedFrom を保持。新しい画像は生成されなかった。 |

最後の 2 実行は実装コミットの SHA と、空差分の SHA256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` を記録した。
この検証記録の追記以降は SHA が変わるため、自動再利用の同一性条件とは区別する。
記録追記だけでは、上記で確認した操作・撮影処理とアプリのコードは変化しない。

## 消費と参考料金

履歴なしで起動した取得専任子エージェントの session token_count の最終累計を集計した。
会話履歴を渡さなくても、システム指示・ツール定義等の入力は発生する。

| 範囲 | 入力 token | うち cached | 出力 token | 再試行 |
| --- | ---: | ---: | ---: | --- |
| 初回取得と画像確認・報告 | 158,684 | 128,512 | 1,103 | 0 |
| 品質修正後の再取得と再利用確認を含む累計 | 388,769 | 338,048 | 2,615 | 呼出元の診断後に再取得 1 回。再利用確認 1 回を別途含む |

設定は `gpt-6.1-sol` / `low`。cache write は 0。親の計画・レビュー・修正確認、実装役、
手順の応答評価役の消費と、コンテナの費用はこの表に含めていない。
固定スクリプト自体はモデル API を呼ばないが、実行役の消費は上記のとおり発生した。

2026-11-18 確認の [公式料金表](https://developers.openai.com/api/docs/pricing) の
Standard 単価（100 万 token あたり入力 $2、cached $0.10、出力 $10）を当てた参考値は
初回 $0.0842252、再取得・再利用を含む累計 $0.1613968。
Fast 単価（入力 $4、cached $0.20、出力 $20）なら累計 $0.3227936。
計算は `(入力 - cached) × 入力単価 + cached × cached単価 + 出力 × 出力単価` を 100 万で割る。
これは API 換算の比較用参考値であり、Codex 契約の実請求額は未確認。
別モデル・全履歴委譲との比較は行っておらず、トークン数や総費用の削減率は主張しない。

## 未確認範囲

新規 Codex クライアントでの自動探索は未確認。Claude Code の起動・スキル認識は後述の実機追試で確認済み。
専用の子エージェントによる SKILL の明示読み込みと、配置・参照の照合を行った。
初回検証時は実 PR 作成や外部アップロードを行わず、PR 連携は手順レビュー・依頼応答と既存回帰テストで確認した。
その後 PR #32 を作成済み。証跡の外部自動アップロードは行っていない。
2 worktree の同時起動は今回再実行せず、既存保存先分離の単体テストと実装の再利用を確認した。
Backend のコード変更はないため、その全テストは再実行していない。
本番、HTTPS、TiDB 共有セッション、全機能・全ブラウザの確認は対象外。

## Claude Code の実機追試

2026-11-18 01:15 JST のユーザー提供報告を追記する。Claude Code で `/capture-evidence` が認識され、
読み込み時に `.claude/skills/capture-evidence/SKILL.md` が渡された後、共有する
`.agents/skills/capture-evidence/SKILL.md` を Read した。execution.md、browser-verification.md、
worktrees.md も読んで実行した。子エージェントへの委譲は行っていない。
この報告により Claude Code の起動・入口認識・共有手順の読み込みを確認済みとする。

別の detached worktree `C:\Users\hfzor\myprojects\chronolist-evidence-claude` で
`worktree-dev init --slot 220` / `up` を実施し、project `chronolist-c620d945f9ce36a6` を起動した。
Frontend は `http://chronolist-c620d945f9ce36a6.localhost:20440`、API は同ホストの `20441`。
専用 Compose network の TCP 中継を通し Host を保持して Cookie/CORS の条件を維持したとの報告である。
FE/BE のソースマウントと開発用 H2 も確認したとの報告を受けた。

実行コードは `5ce74095ade9219ee2136648501fe7c5fbc04235`、clean 状態の差分指紋は
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。
計画ハッシュは `f4d3c09d3874d33e5c02b1602d7f32ce751ccfde4aec23d49ae4d3a9af15f280`。
ToDo「Claude証跡確認」の draft / saved は、どちらも capture / verification が passed。
登録後の一覧と実 API `/todolist/getAll` の照合が成功し、Claude Code 側では画像も目視したとの報告である。

親エージェントはユーザー報告だけでなく、別 worktree の次の実記録を読み、SHA、差分指紋、
計画ハッシュ、対象 URL、両地点の状態と保存先を照合した。さらに親エージェントも PNG 2枚を目視し、
draft の不透明なダイアログと「Claude証跡確認」の入力、saved の一覧にある同タイトルを確認した。
ロゴ差異も見えたが、原因・影響は調査していない。これらは Claude Code 側の報告と別に照合した範囲である。

```text
C:\Users\hfzor\myprojects\chronolist-evidence-claude\frontend\e2e-results\d45d4a9b6482\2026-11-17T16-15-16-899Z-892c0bff-fb0e-4474-9780-8ca72eda14ec\evidence\evidence.json
```

JSON 内の `/work/...` はコンテナ内パスであり、上記ホストの別 worktree に対応する。
成果物はこの worktree の除外領域にあり、公開 URL ではない。

実行環境は uv の Python 3.12.13、Playwright Docker `v1.65.1-noble` と npm パッケージ版 `1.65.1`。
Node.js は `26.13.1` で、プロジェクト指定の 24 と異なる。この追試を指定 Node.js 24 での成功とは扱わず、
前述の親エージェントによる Node.js 24 検証と区別する。

検証後は今回のコンテナを stop 済みで、Playwright コンテナは `--rm` で実行したとの報告である。
停止コンテナ、Volume、worktree、`.env`、node_modules、イメージは残っている。
saved 画像のロゴ欠落は要求範囲外で未調査。停止時の frontend exit 1 の原因も未確認。
これらの不具合修正や環境の追加片付けは実施していない。
