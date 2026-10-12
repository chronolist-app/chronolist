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

### CHRON-137 SchedulerのIDORテスト

`SchedulerIdorTests`は2ユーザーを用意し、一覧の所有者分離、他人・存在しないIDへの
更新と削除の404、scheduleId/userIdの偽装、対象6Mapperの所有者条件とDB不変性を確認する。
既存の`SchedulerApiTests`にある自分の予定の更新・削除と合わせて実行する。

途中失敗のケースでは、`@MockitoSpyBean`でMapperの返却件数を差し替える。
その他のMapper呼び出しは実SQLで実行し、先行操作のDB変更がロールバックされることと
404応答を確認する。テスト全体には`@Transactional`を付けない。

実行例: `docker compose exec -T backend sh ./gradlew test --tests '*Scheduler*'`

2026-10-12に`feature/scheduler_idor`で実行: 既存12ケース＋追加14ケースの26ケース中、
16成功・10失敗。CalendarEvent更新・削除のJOIN構文がH2非対応であるため、既存正常系4件、
偽装ID更新2件、Mapper更新・削除2件が失敗する。削除ロールバック1件も先行DELETEの
構文エラーで後続の故障注入まで到達しない。更新ロールバック1件は、後続更新0件でも
204を返し先行Schedule更新をコミットするため失敗する。期待値は変更せず残す。

同日の`feature/move-Logic-to-service_scheduler`でupdateEventのロールバック対応後に再実行:
28ケース中24成功・4失敗。先行Schedule更新を実DBで確認した後、後続更新0件で404となり、
先行変更が取り消されることを検証済み。先行更新が0件・2件の場合も404となり、
CalendarEvent更新を実行しない。残る4件は削除SQLのH2構文エラーによるもの。

同日の削除SQL修正・deleteEventのロールバック対応後に再実行: 既存12ケース＋IDOR18ケースの
30ケースがすべて成功。先行CalendarEvent削除を実DBで確認した後、後続削除0件で404となり、
削除済みイベントが復元されることを検証済み。先行削除が0件・2件の場合も404となり、
Schedule削除を実行しない。

ApiIntegrationInfrastructureTestsはToDoの登録・取得を2回繰り返し、基盤とデータ分離を検証する。
ToDoListApiTestsはToDoの5エンドポイントについて、期限の3形式、優先度、完了状態、
更新時の項目保持、単体・複数削除、実装済みの400・404応答とDB状態を検証する。
SchedulerApiTestsはSchedulerの4エンドポイントについて、通常・終日予定、期間重複と両端の境界、
同日検索、登録、予定種類の切り替え、更新・削除の404応答を検証する。
calendar_eventとscheduleの両テーブルを独立したSQLで確認し、両者のIDが異なる場合も扱う。
TimeTableApiTests・TimeBlockApiTests・TimeBlockTaskApiTests・TemplateBlockApiTestsは
TimeBlockingの14エンドポイントを検証する。日付重複409、未登録IDの404、配置・保持の切り替え、
開始時刻だけの更新、ブロック削除時の子タスク削除と関連予定削除を含む。

## TimeBlockingで検出した既存不具合

以下の2ケースは現在の実装では失敗する。仕様を保証するため、テストは無効化せず残している。

- `TimeBlockApiTests.getHoldBlocksIncludesTasks`: タスク付きHOLDブロック取得は200が期待されるが、
  MyBatisSystemExceptionにより500になる。TimeblockingResultMap.xmlのtasksのcollectionで
  javaTypeにコレクション型ではなくTimeBlockTaskが指定されている。
- `TimeBlockApiTests.updateStartAtPreservesScheduleLink`: 開始時刻だけの更新でschedule_idがNULLになる。
  getTimeBlockByIdが関連予定を取得しない状態で、updateTimeBlockがschedule_idも上書きするため。

全64ケース中62成功・2失敗。既存不具合の修正後に全件を再実行する必要がある。

## ToDoの仕様差分・未確定事項

- 通常更新の成功ステータスは仕様書が204、現実装が201。テストでは現行互換性を
  明示的に201で確認する。204への統一が決まった場合は実装とテストを同時に変更する。
- 仕様書の `TATETIME`、`DATE`、`isComleted` という記述は、実際の型・JSONでは
  `DATETIME`、`DATED`、`isCompleted` を使用する。
- 複数削除で存在するIDと存在しないIDが混在すると、現実装では途中まで削除されうる。
  原子性について仕様が定まっていないため、その部分削除を期待するテストは追加しない。
- 任意のnullや不正な配列要素に対するエラー応答の整備は今回行わない。
