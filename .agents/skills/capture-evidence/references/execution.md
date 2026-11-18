# 計画・実行・記録

環境準備は [ブラウザ検証](../../../../docs/browser-verification.md) を参照。
既存 loadE2eEnvironment の *.localhost 制限、resultPath の URL ハッシュ/実行 ID、
fixtures の検証専用アカウント/UI ログインを再利用する。
手書き .env を読み替えたり書き換えたりしない。明示 URL は FE/API 両方が必要。

frontend で実行する（PowerShell）。

```powershell
$env:E2E_BASE_URL = '<worktree 専用 Frontend origin>'
$env:E2E_API_BASE_URL = '<同じ worktree の API origin>'
$env:EVIDENCE_PLAN = '../.agents/skills/capture-evidence/references/todo-plan.json'
npx playwright test capture-evidence.spec.ts
```

要求に合わせ JSON 計画をコピー・編集する。purpose, scenario: todo, title と
checkpoints の各 id, requirement, expected が必須。id は draft / saved。
draft は新規作成→タスク名入力直後の値確認。saved は登録→再読込後の一覧と API 確認。
片方だけ指定できる。draft だけなら保存操作をしない。
expected は自由文から assertion に変換されない。呼出元が固定確認条件と要求を照合し、
この条件以外なら専用テストと assertion を用意する。任意の期待文が自動検証されたと報告しない。
PNG は fullPage、animations: disabled で有限 CSS animation/transition を完了させて撮影する。
draft は React Bootstrap の show クラス、opacity: 1、dialog の transform: none も待つ。
show は entering 中にも付くためクラスだけでは完了と扱わず、固定 sleep は使用しない。
撮影コールバック内の captureEvidenceImage は、レイアウトに参加する表示対象 img の読込・デコードを待つ。
未読込で幅0の画像も対象とし、display: none / visibility: hidden などの非表示画像は除外する。
画像0枚はそのまま撮影する。CSS 背景画像や全 UI の準備判定は対象外。
固定 sleep は使わず、既定15秒の明示予算で準備待ちと撮影を完了する。破損・decode 拒否・待機超過は
取得失敗として記録し、先の確認成功/失敗は維持する。後続操作は停止し、未到達地点を未確認に残す。
エラー記録に画像 URL やレスポンス本文は含めない。
trace が必要なら --trace on。既定で成功 trace は保持しない。
使用後は EVIDENCE_PLAN / EVIDENCE_REUSE / URL 環境変数を解除する。
独立実行では CHRONOLIST_E2E_RUN_ID を解除し新規 ID を生成させる。

結果は frontend/e2e-results/<URL hash>/<run ID>/evidence/ の draft.png, saved.png,
evidence.json。results.json/report/artifacts は同じ実行ディレクトリ。
記録は schemaVersion: 2。identity は SHA、管理対象差分と未追跡ファイル内容のハッシュ、
要求ハッシュ、両 origin を持つ。worktree、日時、ブラウザ/Node、各地点の取得・確認状態、
未確認事項はトップレベルの metadata として記録する。
dirty 差分自体は秘密漏洩を避け記録せず、呼出元が git status / git diff で変更内容を報告する。
DB の起動構成、実際のサービスが同じコードを実行していることも呼出元が確認する。
URL/計画不正や準備失敗で記録できない場合は終了コード/ログを取得失敗として報告。
Git identity の失敗も記録し、identity: null と安全な failure（stage/code/固定説明）を保存して非0終了する。
操作中断の未到達地点は unverified。保存失敗と期待状態不一致は独立して記録する。
各地点の failures は画像 decode/timeout、assertion、画面待機 timeout などを区別する。
元の例外 message/stack や expect の差分は JSON に保存しない。

EVIDENCE_REUSE に既存 evidence.json のパスを指定するとコード/要求/両 origin、
全地点の成功、画像の sha256 を照合する。
画像 path と reusedFrom は evidence.json 基準の相対パス（/区切り）。
元 record のディレクトリから画像を解決し、新 record への相対参照に変換するため、ホストとコンテナの mount prefix が異なっても同じ相対配置なら再利用できる。
画像は frontend/e2e-results 内だけを許し、絶対パス・境界外への参照・外へのリンク・改変・欠損・地点の欠損や重複は拒否する。
worktree などの metadata は画像解決に使わない。
旧 schema や hash のない画像は再利用せず新規取得する。
存在しない record、読取エラー、不正 JSON、非対応 schema も reuseRejection に安全な固定理由を残して新規取得する。呼出元が事前に画像と網羅性、
依存関係・環境設定・データの変更も確認する。ハッシュ一致だけで別環境への有効性を証明しない。
コミット後 SHA 変化も自動再利用しない。必要なら内容同一性を説明する。
ローカル参照は GitHub から見える公開 URL ではない。PR では参照先と共有可否を区別する。

認証情報・Cookie・レスポンス本文は JSON 記録へ保存しない。ただし trace は検証アカウントの
認証情報・セッション・API データを含み得る。共有前に確認し必要な PNG だけを選ぶ。
成果物は Git/Docker 除外済み。外部 upload、自動削除、Git 追加はしない。
