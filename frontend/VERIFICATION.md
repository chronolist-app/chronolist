# Frontend 動作確認記録

## CHRON-151 ステップ6：環境別CORSとAPI転送（2026-10-26 JST）

| 確認 | 結果 |
| --- | --- |
| Frontend本番イメージのビルド | 成功（TypeScript・Vite・Nginx設定同梱） |
| API URL設定の既存回帰 | 48件すべて成功 |
| 新しいAPI転送設定の回帰 | 18件すべて成功。HTTP/HTTPSの公開Origin、上流URL検証、静的配信モードへの復帰を確認 |
| BackendのCORS追加テスト | 28件すべて成功 |
| Backend全体 | 159件中157成功。既知TimeBlocking不具合2件が失敗 |
| ローカルHTTPS結合 | 27項目すべて成功 |

HTTPS検証はテスト用TLS入口→Frontend本番Nginx→BackendのHTTP転送で実施した。
Backendはprod設定を使い、DB・SQL初期化のみ専用H2へ上書きした。本番DBや.envは利用していない。
curlのCA指定で証明書とホスト名の検証を有効にし、PCの信頼設定は変更していない。
CookieのSecure / HttpOnly / SameSite / Path / Domain、期限更新と削除、ログイン・CRUD・ログアウト、
古いCSRFトークンの403、ログアウト後の401、APIルートのJSON 404を確認した。
偽装ForwardedヘッダーがHTTPS認識やパスを変えないことと、未許可Originが拒否されることも確認した。
専用コンテナ・ネットワーク・証明書はスクリプト終了時に削除した。
初回は検証元の開発イメージがGradleを起動して準備待ちに失敗したため、JARの直接起動へ修正して再実行した。

本記録はTiDB互換性や実際のCloud Runの配置・実ブラウザ確認を証明するものではない。

## CHRON-151 ステップ5：CSRF共通通信層（2026-10-26 JST）

Frontendは既存ComposeのVite（http://localhost:5173）、BackendはCSRF有効のdev（H2、
http://localhost:8080）を使用。ChatGPT内ブラウザで、ローカル検証専用ユーザーを使用した。
本番Cloud RunやTiDBの検証ではない。

| 確認 | 結果 |
| --- | --- |
| `npm test` | Node標準ランナーの20件すべて成功。追加の依存なし |
| TypeScript・Viteの本番ビルド | 成功。既存の大きなJSチャンクの警告あり |
| 変更したソース・テストのESLint | 成功 |
| 画面からのログイン | 成功。ホームへ遷移 |
| ToDo作成・完了状態更新 | 成功。リロード後もタスクと変更を確認 |
| ホームからのログアウト | 成功。ログアウト完了メッセージを表示 |
| ログアウト後の認証必須画面 | ログイン画面へ遷移 |
| 別タブの再ログイン後に旧トークンで更新 | 403となり共通通知を表示。リロード後、拒否された変更が保存されていないことを確認 |

ToDoの既存UIは保存前に表示を更新するため、拒否直後にチェック状態が一時的に変わることがある。
共通通知では再読み込み後の再操作を案内し、元の更新要求は自動再送しない。
認証切替中の取得競合や、認証成功後の再取得だけが失敗するケースはadapterによる自動テストで確認した。
検証用ユーザー `chron151step5` とタスク「CHRON-151 CSRFブラウザ検証」はdevのH2内に残る。
Backend再起動で開発用データと共に初期化される。

---

## CHRON-150 動作確認記録

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

## 起動時URL検証の修正・再確認

完了条件の追加確認で、不正な `http://999.999.999.999`、`http://[::1:]`、
`http://[1::2:]` を起動スクリプトが受け入れる不備が見つかった。
IPv4の区切り・範囲とIPv6の省略前後の構文を検証するよう修正した。
URL末尾の改行も拒否するよう、正規表現を文字列の厳密な終端に合わせた。

修正版イメージ `chronolist-frontend:chron-150-url-validation` のビルドが成功。
`tests/api-config.test.sh` で48ケースの回帰確認を実施した。
正常なドメイン・IPv4・IPv6では設定ファイルを生成してNginxの構文検査まで成功し、
不正URL・未設定ではNginx実行前にエラー終了することを確認した。
上記結果表の起動時検証は、この修正後の確認結果で補完する。
