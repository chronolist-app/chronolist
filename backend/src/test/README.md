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
ToDoListApiTestsはToDoの5エンドポイントについて、期限の3形式、優先度、完了状態、
更新時の項目保持、単体・複数削除、実装済みの400・404応答とDB状態を検証する。
SchedulerApiTestsはSchedulerの4エンドポイントについて、通常・終日予定、期間重複と両端の境界、
同日検索、登録、予定種類の切り替え、更新・削除の404応答を検証する。
calendar_eventとscheduleの両テーブルを独立したSQLで確認し、両者のIDが異なる場合も扱う。
TimeBlockingのテストは後続で追加する。

## ToDoの仕様差分・未確定事項

- 通常更新の成功ステータスは仕様書が204、現実装が201。テストでは現行互換性を
  明示的に201で確認する。204への統一が決まった場合は実装とテストを同時に変更する。
- 仕様書の `TATETIME`、`DATE`、`isComleted` という記述は、実際の型・JSONでは
  `DATETIME`、`DATED`、`isCompleted` を使用する。
- 複数削除で存在するIDと存在しないIDが混在すると、現実装では途中まで削除されうる。
  原子性について仕様が定まっていないため、その部分削除を期待するテストは追加しない。
- 任意のnullや不正な配列要素に対するエラー応答の整備は今回行わない。
