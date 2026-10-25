# CHRON-150 動作確認記録

実施日: 2026-10-25（Asia/Tokyo）

## 検証環境

* Frontend: `chronolist-frontend:chron-150` のproduction stage（Nginx）。
* Backend: 既存Composeのdev環境（H2）。合成データの検証用ユーザーを使用。
* ブラウザ: Chrome。Frontendのoriginは既存CORS許可対象の `http://localhost:5173`。
* API接続先変更の比較には、同じBackendへ転送する一時Nginxを使用。

## 結果

| 確認項目 | 結果 |
| --- | --- |
| API URL未指定のproductionイメージビルド | 成功。TypeScript・Viteビルド完了 |
| runtimeのNode.js・npm不在 | 確認済み |
| 開発時にconfig.jsを読み込まない | 確認済み |
| 開発環境の登録・ログイン・ToDo画面 | 成功 |
| 全9ルートの直接アクセス・リロード | ブラウザで表示を確認 |
| ヘッダーのscheduler・timeblocking・todolist・ホーム遷移 | 成功 |
| 本番成果物からの実Backend通信 | ログイン・認証済み画面の表示を確認 |
| 同じイメージでのAPI URL変更 | `localhost:8080` → `localhost:18081` へ変更。再ビルドなし |
| 接続先変更後のブラウザ通信 | 転送先ログでlogin・ToDo取得の200応答を確認 |
| 設定更新後のリロード | 新しいconfig.jsを取得し、変更後の接続先で動作 |
| config.jsのキャッシュ制御 | `Cache-Control: no-store` |
| HTMLのキャッシュ制御 | `Cache-Control: no-cache` |
| config.js・assets欠落時 | 404。SPAのHTMLへfallbackしない |
| 未設定・不正URLでの起動 | Nginx起動前にエラー終了。前ステップで25ケースと未設定を検証 |

ブラウザで確認したルート: `/`、`/login`、`/signup`、`/scheduler`、`/todolist`、
`/timeblocking`、`/test`、`/test/todolist`、`/test/scheduler`。

切り替え前後のコンテナのimage IDはいずれも以下。

```text
sha256:223ec7fab226a5bccae3af2f1a8e57f9cbd3ccc30ca410ccc064d188de6c039f
```

## 検証上の条件

`localhost` → `127.0.0.1` の変更も設定に反映されたが、ブラウザの認証Cookieは
異なるホストへ引き継がれないため、認証付き通信の比較には同じホストの別ポートを使用した。
API URLだけでCORS・Cookieの条件が整うわけではない。本番環境の設定は別途必要。

検証用FrontendとAPI転送コンテナは削除し、既存の開発Frontendを再開した。
復元後もブラウザでToDo画面の表示とAPI通信が動作することを確認した。
Backendは再起動していないため、作成した検証用ユーザーはdevのH2内に残る。
Backend再起動時にdevデータは初期化される。

本番ホスティング・実際の本番APIへの接続は本検証の対象外。
ビルド時には500kBを超えるJavaScriptチャンクの警告が出るが、ビルドは成功している。
