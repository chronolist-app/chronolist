# CHRON-149 Dockerイメージ検証結果

## devでの単体起動（2026-10-25）

- 検証対象コミット: `364a3bc`
- イメージ: `chronolist-backend:chron-149-step4`
- `docker build -t chronolist-backend:chron-149-step4 ./backend` に成功。
- 以下のコマンドで、ソースやボリュームをマウントせずに起動した。

```sh
docker run -d --name chron149-step4-dev \
  -p 127.0.0.1:18081:8080 \
  -e SPRING_PROFILES_ACTIVE=dev \
  chronolist-backend:chron-149-step4
```

### 確認結果

- `java -jar /app/app.jar` がUID/GID `10001:10001` で起動。マウントは0件。
- dev Profileが有効になり、H2（`jdbc:h2:mem:testdb`）へ接続した。
- Spring Bootが8080番ポートで正常起動した。
- ホストの18081番ポートから以下のHTTP操作に成功した。

| 操作 | 結果 |
| --- | --- |
| 未認証で `GET /api/todolist/getAll` | 401 |
| 検証専用ユーザーを `POST /api/signup` で登録 | 200 |
| `POST /api/login` でログイン | 200 |
| セッションCookieを使い `GET /api/todolist/getAll` | 200、本文 `[]` |

検証用ユーザーは一時コンテナのインメモリH2にのみ登録した。
検証後にコンテナを停止・削除済み。既存の開発用Composeは変更していない。

## prodでのTiDB接続とデータ保持（2026-10-25）

- 同じコミット・本番イメージを使用し、ローカルDockerからTiDB Cloudへ接続した。
- ユーザーの確認に基づき、Git管理外の `.env` が指す使い捨て検証DBを使用した。
- 事前のFlyway `info` は終了0、V1 Success、Pendingなし。
  過去の検証専用差分はFutureとして存在するため、その履歴・SQLは変更していない。
  今回はマイグレーションを実行していない。
- Composeが解決した `FLYWAY_URL`・`FLYWAY_USER`・`FLYWAY_PASSWORD` をメモリ内で
  `DB_URL`・`DB_USERNAME`・`DB_PASSWORD` へ渡した。値は表示・保存していない。
- JDBC URLに `sslMode=VERIFY_IDENTITY` が指定されていることを確認した。
- `SPRING_PROFILES_ACTIVE=prod`、マウントなし、ホストの18082番ポートで起動した。

| 操作 | 結果 |
| --- | --- |
| 合成ユーザーを `POST /api/signup` で登録 | 200 |
| `POST /api/login` | 200 |
| 新規ユーザーの `GET /api/todolist/getAll` | 200、本文 `[]` |
| `POST /api/todolist/register` で合成ToDoを登録 | 200 |
| `GET /api/todolist/getAll` | 200、登録したID・タイトルを確認 |
| コンテナを再起動後、新しいセッションでログイン | 200 |
| 再起動後の `GET /api/todolist/getAll` | 200、本文が再起動前と完全一致 |

prod設定の `spring.sql.init.mode=never` と、ユーザー・ToDoの再起動後の保持を確認した。
DB全体の既存データを比較した検証ではない。
検証用の合成ユーザー・ToDoは各1件をDB内に残している。
検証コンテナは停止・削除済み。GCPへのアプリデプロイは実施していない。

## 既存テスト全体（2026-10-25）

開発用Composeから継承する `SPRING_PROFILES_ACTIVE=dev` をテストプロセスだけから外し、
全テストを再実行した。DBはテスト用H2であり、TiDB検証DBには接続しない。

```sh
docker compose exec -T backend env -u SPRING_PROFILES_ACTIVE \
  sh ./gradlew test --rerun-tasks
```

- 全88件、成功86件、失敗2件、エラー0件、スキップ0件。
- Gradleの終了コードは1。全テスト成功とは扱わない。
- 件数と失敗メッセージは `build/test-results/test/TEST-*.xml` を集計して確認した。
- HTMLレポートは `build/reports/tests/test/index.html`。

| 失敗したテスト | 今回の結果 | 切り分け |
| --- | --- | --- |
| `TimeBlockApiTests.updateStartAtPreservesScheduleLink` | 開始時刻変更後に `schedule_id` がNULL | 既存のテストREADMEに記録された症状と一致 |
| `TimeBlockApiTests.getHoldBlocksIncludesTasks` | 期待200に対して500 | 既存のテストREADMEに記録された症状と一致 |

HOLD取得のResultMapは `tasks` の `javaType` にコレクションではなく要素型を指定している。
開始時刻更新は関連予定を取得しない `getTimeBlockById` の結果を使い、
`updateTimeBlock` で `schedule_id` も上書きする構成のままである。
分岐元コミット `456a943` と比較し、`backend/src/main`・`backend/src/test` に差分がないことも確認した。
今回の実行では事前記録と異なる失敗は確認されなかった。上記2件は本チケットでは修正していない。

## ステップ4のまとめ

- devのイメージ単体起動、prodのTiDBへのAPI読み書き、再起動後の検証データ保持を確認済み。
- 既存テスト全体を実行し、既知の2件の失敗と結果を記録済み。
- アプリコードの追加修正はなし。残る利用手順の整備はステップ5で扱う。
