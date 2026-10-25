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

### JDBCセッションの保存基盤

`JdbcSessionRepositoryTests`はtestプロファイルの実際のSpring Session JDBC RepositoryとH2を使い、
認証情報（LoginUserを含むSecurityContext）・CSRFトークンの保存／復元、属性更新・ID変更・削除、
期限切れ拒否と期限切れ属性の削除を確認する。ログインAPIやCookieを使ったフロー、
TiDB互換性、Backend再起動・別インスタンス間の継続は、このテストの検証範囲に含まない。

開発用Composeコンテナで全テストを実行する場合は、コンテナのdevプロファイル指定が
「プロファイル未指定」を検証するDatabaseProfileTestsへ影響しないよう、実行時のみ外す。
起動済みBackendの環境変数は変更しない。

```sh
docker compose exec -T backend env -u SPRING_PROFILES_ACTIVE sh ./gradlew test --no-daemon
```

2026-10-25、CHRON-151ステップ1で上記コマンドを実行：全92件中90成功・2失敗。
追加したJDBCセッション4件、DatabaseProfileTests4件、API基盤2件はすべて成功。
失敗は下記の既知TimeBlocking不具合2件（getHoldBlocksIncludesTasks、
updateStartAtPreservesScheduleLink）。TiDB実機へのV2適用・セッション操作は未実施。

### ログインとJDBCセッションの連携

`LoginSessionTests`は認証済みPrincipalの注入やMockHttpSessionの引継ぎを使わず、
JSONログインとCookieを使って後続APIへアクセスする。認証情報の保存・復元、パスワード等の
消去、既存セッションIDの変更と旧CSRFトークンの破棄、ログイン失敗、GETでのログイン拒否、
ログアウト後のDBセッション削除と古いCookieの拒否を確認する。
ログイン前セッションの直接準備が必要なケース以外は、CsrfApiClientで実際の取得APIから
トークンを取得し、Cookieと共に送信する。

2026-10-25、CHRON-151ステップ2で全テストを実行：全97件中95成功・2失敗。
追加したLoginSessionTests5件はすべて成功。失敗はステップ1と同じ既知TimeBlocking不具合2件。

### Cookie属性と継続更新

ステップ3ではLoginSessionTestsにDB上の期限とCookieの継続更新、期限切れ拒否を追加し、
ログイン・ログアウト時のCookie属性も確認する。時刻を待たずにDB上の最終アクセス日時と期限を
調整する。`SessionCookieConfigurationTests`はdev / test / prodの発行・削除属性、外部設定による
保持期間の変更を確認する。`SessionCookieRefreshFilterTests`は早期レスポンス確定時にも
Cookieが更新されることと、匿名アクセスでセッションを作らないことを確認する。
これらはMockMvc・モックServlet環境での検証であり、実ブラウザやCloud Runの検証とは区別する。

2026-10-25、CHRON-151ステップ3でCookie・ログイン・保存基盤の19件がすべて成功。
全テストは107件中105成功・2失敗。失敗は前ステップと同じ既知TimeBlocking不具合2件。

### CSRF保護

既存の業務APIテストではApiIntegrationTestの共通ヘルパーが状態変更リクエストだけに
Spring Security TestのCSRFサポートを付与する。参照系はトークンなしで実行する。
`CsrfProtectionTests`とLoginSessionTestsではこのヘルパーを使わず、実際の `/api/csrf`、
ログインAPIとCookieで連携を確認する。マスク済みトークン、ログイン・ログアウト前後の更新、
POST / PUT / DELETEの成功、POST / PUT / PATCH / DELETEの欠落・不正トークン拒否とDB不変性、
公開認証APIの保護、期限切れ401とCSRF403・権限不足403の区別、GET / HEAD・CORS preflightを検証する。

2026-10-26、CHRON-151ステップ4で全テストを実行：全131件中129成功・2失敗。
CsrfProtectionTestsの24件と、CSRF取得方式へ更新したLoginSessionTestsの7件はすべて成功。
失敗は前ステップと同じ既知TimeBlocking不具合2件。FrontendのCSRF自動送信は未実装。

### 環境別CORSとHTTPSプロキシ

CorsPropertiesTestsはdev / testの既定Origin、prodの明示設定必須、複数Origin、不正なOriginの拒否を検証する。
CorsApiTestsは開発既定値と異なるOriginを使い、許可Originのcredentials付き応答、未許可Origin拒否、
HEAD / POST / PUT / PATCH / DELETEのpreflight、同一Originの扱いを検証する。
2026-10-26、CHRON-151ステップ6で全159件中157成功・2失敗。追加したCORSの28件はすべて成功。
失敗は以前と同じTimeBlockingの既知2件。bootJarも生成済み。
Nginx本番イメージの設定回帰と、prod設定＋使い捨てH2によるHTTPS結合27項目は
[Frontend検証記録](../../../frontend/VERIFICATION.md) を参照。TiDB実機・Cloud Runの確認は含まない。

2026-10-26、CHRON-151ステップ7では別途TiDB実機の結合検証37項目がすべて成功した。
Flyway V1・V2、独立したBackend JVM間と再起動後の認証・CSRF継続、7日間の期限更新、
ログアウトの共有反映、期限切れ拒否・削除を確認した。既存DBを変更せず専用一時DBを使い、
終了後に削除した。再実行手順・詳細・Cloud Runへの引継ぎは
[TiDB共有セッション検証](../../verification/README.md) を参照。
通常のH2テストはTiDBへ接続しない。このステップではアプリ本体の変更はなく、全H2テストの再実行はしていない。

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
