# バックエンドの環境設定

Java 25を使用する。環境は `SPRING_PROFILES_ACTIVE` で切り替える。

| プロファイル | DB | 起動時SQL初期化 |
| --- | --- | --- |
| dev | H2（jdbc:h2:mem:testdb、ユーザーadmin、パスワードなし） | schema.sqlとdata.sql |
| prod | 環境変数で指定するTiDB Cloud | 実行しない |
| 未指定 | Spring Bootの自動設定 | 実行しない |
| test | 専用H2 | schema.sqlとテスト専用データ |

## 開発

リポジトリルートで `docker compose up backend` を実行するとdevが適用される。
Dockerを使わない場合はリポジトリルートをVSCodeで開き、Java拡張機能を導入し、
launch.jsonのJava起動設定に `"env": { "SPRING_PROFILES_ACTIVE": "dev" }` を追加する。
実行とデバッグからその起動設定を選択する。個人のOS環境変数設定は不要。
H2コンソールはdevのみ有効（http://localhost:8080/h2-console）。
再起動すると開発用スキーマとサンプルデータが再作成される。

CLIではbackendから `sh ./gradlew bootRun --args='--spring.profiles.active=dev'`。
テストは `sh ./gradlew test`（詳細はsrc/test/README.md）。

## 本番

実行環境で以下を設定する。認証情報はリポジトリに保存しない。

- `SPRING_PROFILES_ACTIVE=prod`
- `DB_URL`: `jdbc:mysql://<host>:4000/<database>?sslMode=VERIFY_IDENTITY`
- `DB_USERNAME`: TiDB Cloudのユーザー名
- `DB_PASSWORD`: TiDB Cloudのパスワード

prodの接続情報は必須。DBスキーマはアプリ起動前に別途用意する。
FlywayとCloud Run Jobは後続ステップで整備する。
