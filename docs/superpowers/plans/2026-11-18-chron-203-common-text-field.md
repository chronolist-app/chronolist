# CHRON-203 CHTextField Implementation Plan

> **For agentic workers:** ユーザーから implement-ticket による実装開始指示を受領済み。指定モデルの実装サブエージェントが実装し、親がレビュー・最終検証・ローカルコミットを行う。

**Goal:** 共通 CHTextField を実装し、予定作成 Title 1箇所を先行移行する。

**Architecture:** 独立した React コンポーネント内に MUI TextField を閉じ込める。既存の outlined 表示を基本とし、Theme の既定値を活用する。画面の公開 API に MUI の型・sx・slotProps を持ち込まない。

**Tech Stack:** React 19 / TypeScript 5.9 / MUI 7 / Node.js 24 / Node test runner / Playwright。

**Spec:** [CHRON-203](https://magu.atlassian.net/browse/CHRON-203)、[CHRON-215 調査](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5963865)、[コーディング規約](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/5963809)、[Scheduler 仕様書](https://magu.atlassian.net/wiki/spaces/Chronolist/pages/3342394)。

## 要求と判断根拠

- チケット明記: 独自 React コンポーネント、ラベル・helperText・error・required・disabled・サイズ・HTML 入力種別・React 標準入力属性、状態・レスポンシブ・キーボード・アクセシビリティの検証、利用方法の明文化。
- チケット明記: `frontend/src/feature/schesuler/hooks/modal.tsx` の Title のみ置換。残りの15入力は CHRON-204。Memo・日時入力・複合インライン編集の移行は含めない。
- 確認済み: 前提 CHRON-215 は完了。調査メモは標準入力16箇所と代表1箇所を特定済み。
- コードからの判断: Title の controlled 値、変更イベント、空送信エラー、再入力でのエラー解除、fullWidth、outlined を維持する。アプリ全体の ThemeProvider / createTheme は現状見つからないため、全体テーマ新設は前提としない。
- 設計提案: 標準 input 属性を基盤とした独自 CHTextFieldProps とし、size は HTML の文字幅と区別したアプリ独自の意味を定義する。multiline / rows / readOnly と blur / key イベントも後続の既存用途を考慮する。寸法値の新規デザイン要求はなく、MUI の既存寸法を基本とする。ユーザーとの追加合意事項はない。

## Global Constraints

- コーディングあり。実装・検証・ローカルコミットまで実施し、最後に実画面の証跡を1枚撮影する。
- 公開関数・コンポーネントには日本語 TSDoc。型安全性、既存 ESLint / TypeScript 設定を維持する。
- Backend / DB / API の変更、一括移行、正式仕様書の更新は対象外。
- コミットは日本語件名、空行、意味単位の箇条書き本文。Prefix を付けない。

## 完了条件と確認方法

1. 【チケット明記】独自 CHTextField と公開 API が実装され、呼出側で MUI 固有 Props / 型に依存しない。型検査・実装レビュー・利用例照合で確認する。
2. 【チケット明記】ラベル・補助文・エラー・必須・無効・サイズ、password 等の type、標準属性が使用できる。`frontend/tests/chtextfield.test.ts` で DOM 属性・ラベル関連付け・エラー関連付けを確認し、ビルドで型を検証する。
3. 【チケット明記＋コードから具体化】Title 1箇所の置換後、入力保持・空送信エラー・再入力での解除・有効な予定の作成と再読込が動く。Scheduler の Playwright シナリオで確認する。Memo 等の残りを移行していないことは差分で確認する。
4. 【チケット明記】通常・フォーカス・エラー・必須・無効、各サイズ、狭い幅とデスクトップでの表示・キーボード操作・アクセシビリティが検証済み。ブラウザで 375px / 1280px を確認し、Tab、文字入力、ラベル、aria-invalid / aria-describedby を検証する。代表画面にない状態は検証用表示で確認する。
5. 【チケット明記】利用方法が明確で既存画面に導入可能。`frontend/README.md` の Props・利用例と実装を照合し、Node.js 24 で `npm ci` → `npm run lint` → `npm test` → `npm run build` を実行する。

## Review Focus

- label / id / helperText の紐付けと複数インスタンスの ID 重複をテストする。
- disabled / readOnly / required と標準属性がラッパー要素ではなく入力要素へ渡ることをテストする。
- password、number の min / max / step、multiline / rows の DOM 出力を確認する。
- 日本語の連続入力と controlled 再描画後のフォーカス維持をブラウザで確認する。
- 長いラベル・補助文・エラーが狭い画面で欠けないことを確認する。

## 作業順序

### Task 1: 共通 API・コンポーネント・利用方法

対象: 新規 `frontend/src/components/CHTextField.tsx`、新規 `frontend/tests/chtextfield.test.ts`、更新 `frontend/README.md`。

- [x] 既存 `frontend/tests/chbutton.test.ts` の TSX 変換・SSR テスト方式を参考に、完了条件2と Review Focus の DOM 検証を先に作成し、未実装で失敗することを確認する。
- [x] `CHTextFieldProps` と default export `CHTextField` を実装する。標準属性・イベントと独自の label / helperText / error / fullWidth / size を定義し、内部で MUI へ変換する。必要な範囲で textarea 属性も扱う。
- [x] Props と既定値、controlled 入力・password・エラーの利用例を README に記載する。
- [x] 追加テストとビルドで公開 API / DOM を検証する。

### Task 2: Title の先行置換・画面検証

依存: Task 1 の公開 API。対象: 更新 `frontend/src/feature/schesuler/hooks/modal.tsx`、新規 `frontend/e2e/chtextfield.spec.ts`。

- [x] Scheduler の空送信・再入力・予定作成を確認するブラウザテストを作成し、置換前の現状を把握する。
- [x] Title だけを CHTextField に置換し、既存イベント処理・バリデーションを維持する。Memo では MUI TextField を継続利用する。
- [x] 完了条件3・4をブラウザで確認する。worktree 専用環境は `docs/development/worktrees.md` と既存 e2e fixtures を利用する。
- [x] 完了条件5のフロントエンド検証を実行し、成功・失敗・未実施を区別して記録する。今回は Backend / HTTPS / TiDB 検証を完了条件に含めない。

## 着手準備の記録

- 対象リポジトリ: `chronolist-app/chronolist`。
- Jira: To Do → 進行中。コメント・その他項目は更新しない。
- 作業ブランチ: `feature/CHRON-203-add-common-text-field`（ユーザー指定により prefix を変更）。
- 起点: 最新取得した `origin/develop`、`95eaf9f1400b88a3d514eea3916afccb7941d9b5`。
- 準備ブランチの push 先: `origin/feature/CHRON-203-add-common-text-field`。ブランチ名に Jira ID を含めて起点コミットを push 済み。開発パネルへの表示・連携の有無は未確認。
- 準備時の変更はこの計画ファイルのみ（未追跡）。事前の staged / unstaged 変更なし。旧 prefix のリモート準備ブランチは削除していない。

## 実装・レビュー・検証結果（2026-11-18）

- 公開 API は React 標準入力属性を基盤とし、独自 size は small / medium。MUI の型・sx・slotProps は非公開。Theme の既定値を継承する。
- 独立レビュー: Critical / Important なし。helperText が数値0の場合の説明先欠落を指摘され、回帰テストの失敗を確認後、内部で文字列化して修正した。
- `npm ci`: Node.js 24 のホストで lockfile どおりの依存を導入。依存の追加・lockfile 変更なし。既存依存への audit 指摘10件（moderate 7 / high 3）が表示されたが、依存更新は対象外のため行っていない。
- `docker compose exec -T frontend npm test`: 最終コードで79件成功（うち CHTextField の DOM・型検証7件）。
- `docker compose exec -T frontend npm run lint`: エラー0件。変更していない既存ファイルの Hook 依存警告11件。
- `docker compose exec -T frontend npm run build`: TypeScript / Vite 成功。バンドルサイズ警告あり。
- `node node_modules/@playwright/test/cli.js test e2e/chtextfield.spec.ts`: 最終コードで4件成功。375px / 1280px の実 API 保存・再読込、エラー解除、フォーカス維持、Tab、必須・無効・readOnly・password・複数行・両サイズ・長い補助文を確認。
- 初回 E2E の失敗は、存在しない matcher、FullCalendar の down/up 間の移動を伴わない操作、空欄ラベルの pointer-events に起因。テスト操作を修正し、Calendar の製品コードには変更を加えていない。
- 証跡撮影前に、FullCalendar の非同期 drag 終了より早く次の down が送られる競合も確認した。ブラウザの timer キューで終了通知後まで待つよう検証操作を修正。通常実行・`--trace off` の両方で各4件成功し、変更した E2E ファイルの lint も成功した。
- 日本語入力は insertText による連続入力とフォーカス維持の検証。OS の IME composition 実操作は未検証。Backend 単体テスト・本番 Docker ビルド・HTTPS・TiDB は今回の変更の検証範囲外。
- 検証環境: worktree 専用の開発 HTTP / H2。認証情報やセッションを作業メモ・コードに保存していない。
