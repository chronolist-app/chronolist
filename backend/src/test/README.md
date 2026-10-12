# API統合テスト

Java 25でbackendディレクトリから `./gradlew test`（Windowsは `.\gradlew.bat test`）を実行する。
結果は `build/reports/tests/test/index.html` に出力される。

## テストの追加

- `*Tests` クラスを作り、`support.ApiIntegrationTest` を継承する。
- `performAsUser(get(...))`、`performJsonAsUser(post(...), body)` でAPIを呼ぶ。
  JSON用のbodyにはMapやDTOを渡す。JSON文字列そのものは渡さない。
- 必要なデータは各テストまたはサブクラスの `@BeforeEach` でJdbcTemplateを使って登録する。
  共通の `loginUser.getId()` を所有者として使う。
- ステータス・JSONを検証し、更新系ではJdbcTemplateでDBも確認する。
- 日付は固定し、自動採番IDの値やテストの実行順に依存しない。

## DBと認証

testプロファイルは専用H2 DBを作成し、通常のschema.sqlを使う。
開発用data.sqlは読み込まない。各テスト前のcleanup.sqlで全テーブルを子から親の順に空にし、
共通基盤がテストユーザーを登録する。テーブル追加時はcleanup.sqlも更新する。
並列実行は共有DBの初期化と競合するため無効にしている。

テスト全体に@Transactionalは付けない。アプリ側のトランザクション境界を維持する。
追加の@Sqlは共通cleanup.sqlにマージされるが、ユーザー作成より先に実行されるため、
共通ユーザーに依存するデータは@BeforeEachで用意する。

MockMvcは実サーバーやネットワークを起動せず、SecurityとSpring MVCを経由して実際の処理とDBを呼ぶ。
LoginUserを認証済みPrincipalとして注入するため、ログインAPIを呼ばない。
ServiceやMapperはモック化しない。認証API・IDOR固有のケースはCHRON-135の対象外。

ApiIntegrationInfrastructureTestsはToDoの登録・取得を2回繰り返し、基盤とデータ分離を検証する。
各業務APIの網羅的なテストは後続で追加する。
