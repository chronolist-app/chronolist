# CHRON-152 本番検証記録

記録日：2026-11-01 JST。以下の本番結果は、担当ユーザーが操作してこのチャットへ報告した内容。
エージェントがCloud Run/DBを直接操作して再検証した結果ではない。
実行ID・本番リビジョン・Flyway digest等は未受領のため捏造せず、担当者の記録で補完する。

## 構築・DB

- プロジェクトchronolist-512706、東京、Artifact Registry chronolist-imagesを使用。
- Frontend/Backend/Flywayをlinux/amd64向けにビルド・pushし、SHAタグとdigestを担当者が記録。
- Flyway Jobを作成後info成功。本番prodに接続、V1/V2 Pending、想定外履歴なし。
- prodはテーブル0件、tidb_enable_check_constraintはONを適用前に確認。
- migrate/validate/info成功、V1/V2 Success。
- 適用直後：テーブル11件（業務8・セッション2・履歴1）、CHECK8、外部キー10（業務9・セッション1）。
  業務/セッションデータはすべて0件。
- BackendのDB_URLが開発用を指していたため本番用へ修正後、/api/csrfが200でトークンJSONを返すことを確認。
- 公開設定を最上位metadata.annotationsのinvoker-iam-disabled=trueで保持。

## 認証・画面・CSRF

- 実ブラウザでサインアップ・ログイン・画面からのログアウト成功。
- ページ遷移、直接アクセス、リロード成功。CORSエラーなし。
- 未認証GET401、認証済みGETはCSRFなしで200。
- CSRF欠落/不正POST403、認証状態維持。正しいCSRFのPOST200、ログアウト後GET401。
- CookieはSecure/HttpOnly/SameSite=Lax/Path=/、Domain指定なし。ログアウト時削除確認。

## 主要機能と既知問題

- ToDo・予定の作成/編集/削除成功。再ログイン・再デプロイ後のデータ保持を確認。
- タイムブロックのCRUD成功報告はあるが、置き場/表への二重表示と配置エラーが発生。
  タイムブロッキング全体のSmoke Test成功とは扱わない。
- 修正と再検証は [CHRON-158](https://magu.atlassian.net/browse/CHRON-158)へ引継ぎ。
  ユーザー合意で今回の主要機能検証フェーズを終了して後続へ進めた。
  [CHRON-152コメント10504](https://magu.atlassian.net/browse/CHRON-152?focusedCommentId=10504)に記録済み。

## セッション共有・継続・期限

- 同一リビジョンの2実インスタンスへ到達し、認証済みGETと同一CSRFトークンによる更新成功。
- ログアウト後、古いCookieで両インスタンスのGET401を計20件確認。
- 同一Cookie・再ログインなしで新リビジョンGET200、再デプロイ前のCSRFで更新204。
  登録データ一致と更新の保存を確認。
- 認証GETでDBの最終アクセス/有効期限が更新。Cookie期限延長、Max-Age=604800確認。
- 検証用セッション1件を期限切れにし、DB行が残った状態で古いCookieのGET401を確認。
- 定期削除設定を通常へ戻し、再ログインGET200。
- 通常の最小0/最大1、リクエストベース課金、検証用設定解除とトラフィックの復帰をユーザー報告。

## バックアップ・復元の未検証事項

- 空DBのバックアップSucceeded：取得2026-10-29 02:00:45 JST、期限2026-10-30 02:00:45 JST。
  記録日時点で期限経過。復元は試していない。
- 初回migrationでは空DBへの再構築を復旧方法とした。失敗DBを保持し、別の空DBへ適用する方針。
  この方針は業務データ投入前に限る。
- 2026-11-01、ユーザーが公開を優先し、データ入りバックアップ/復元試験をv1.0.0で確認する方針へ変更。
  本チケットで復元試験は未実施、復元可能性未確認。
  [CHRON-152コメント10505](https://magu.atlassian.net/browse/CHRON-152?focusedCommentId=10505)に記録済み。

## 費用・設定ファイルと残作業

- GCPのみ月500円目標、TiDBは無料プラン内、当面3人。先月（2026年10月）の費用は4円とのユーザー報告。
  2026年11月分は未確定。長期運用の費用や起動待ちなしの予算達成を保証する結果ではない。
- パスワードだけSecretへ登録し、URL/ユーザー名は通常環境変数。DBユーザー分離はCHRON-154。
- 実環境service.yamlはgitignore対象。2026-11-01に配置されたコピーは公開設定・リソース・
  Secret参照を確認できたが、コンソールで追加したSESSION関連3変数は含まれていない。
  テンプレートに通常値を明記し、その後担当者がローカルファイルにも3変数を追加。
  SESSION_TIMEOUT=7d、SESSION_COOKIE_MAX_AGE=7d、
  SPRING_SESSION_JDBC_CLEANUP_CRON='0 * * * * *'の一致をファイルで確認した。
  現在の実サービス設定は担当者報告に基づき、APIでの再照合は行っていない。
- Frontend digest：16d1a9ec642799e0d27bcebed3a34a3378c6415ccaa882d77c0783b7ef5f0dcf。
  Backend digest：f5f6045797eeead49f19382044bce49efb19dc09267aa2c5d03cf933c529520d。
  これは配置されたローカルYAMLの値であり、現在の実サービスとの一致は未照合。
- 現行digestは担当者が記録済み。復旧用リビジョン/digestと不要イメージ整理方針は補完が必要。
- 手順再現性のレビュー、PR作成、CHRON-152の完了条件照合は残作業。CI/CDはCHRON-153。
