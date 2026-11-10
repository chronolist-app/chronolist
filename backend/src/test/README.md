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

### ログインとJDBCセッションの連携

`LoginSessionTests`は認証済みPrincipalの注入やMockHttpSessionの引継ぎを使わず、
JSONログインとCookieを使って後続APIへアクセスする。認証情報の保存・復元、パスワード等の
消去、既存セッションIDの変更と旧CSRFトークンの破棄、ログイン失敗、GETでのログイン拒否、
ログアウト後のDBセッション削除と古いCookieの拒否を確認する。
ログイン前セッションの直接準備が必要なケース以外は、CsrfApiClientで実際の取得APIから
トークンを取得し、Cookieと共に送信する。

### Cookie属性と継続更新

LoginSessionTestsではDB上の期限とCookieの継続更新、期限切れ拒否を扱い、
ログイン・ログアウト時のCookie属性も確認する。時刻を待たずにDB上の最終アクセス日時と期限を
調整する。`SessionCookieConfigurationTests`はdev / test / prodの発行・削除属性、外部設定による
保持期間の変更を確認する。`SessionCookieRefreshFilterTests`は早期レスポンス確定時にも
Cookieが更新されることと、匿名アクセスでセッションを作らないことを確認する。
これらはMockMvc・モックServlet環境での検証であり、実ブラウザや配置先の検証とは区別する。

### CSRF保護

既存の業務APIテストではApiIntegrationTestの共通ヘルパーが状態変更リクエストだけに
Spring Security TestのCSRFサポートを付与する。参照系はトークンなしで実行する。
`CsrfProtectionTests`とLoginSessionTestsではこのヘルパーを使わず、実際の `/api/csrf`、
ログインAPIとCookieで連携を確認する。マスク済みトークン、ログイン・ログアウト前後の更新、
POST / PUT / DELETEの成功、POST / PUT / PATCH / DELETEの欠落・不正トークン拒否とDB不変性、
公開認証APIの保護、期限切れ401とCSRF403・権限不足403の区別、GET / HEAD・CORS preflightを検証する。

### 環境別CORSとHTTPSプロキシ

CorsPropertiesTestsはdev / testの既定Origin、prodの明示設定必須、複数Origin、不正なOriginの拒否を検証する。
CorsApiTestsは開発既定値と異なるOriginを使い、許可Originのcredentials付き応答、未許可Origin拒否、
HEAD / POST / PUT / PATCH / DELETEのpreflight、同一Originの扱いを検証する。

テスト全体に@Transactionalは付けない。アプリ側のトランザクション境界を維持する。
追加の@Sqlは共通cleanup.sqlにマージされるが、ユーザー作成より先に実行されるため、
共通ユーザーに依存するデータは@BeforeEachで用意する。

MockMvcは実サーバーやネットワークを起動せず、SecurityとSpring MVCを経由して実際の処理とDBを呼ぶ。
LoginUserを認証済みPrincipalとして注入するため、ログインAPIを呼ばない。
ServiceやMapperはモック化しない。認証API・IDOR固有のケースは、以下の専用テストで扱う。

### SchedulerのIDORテスト

`SchedulerIdorTests`は2ユーザーを用意し、一覧の所有者分離、他人・存在しないIDへの
更新と削除の404、scheduleId/userIdの偽装、対象6Mapperの所有者条件とDB不変性を確認する。
既存の`SchedulerApiTests`にある自分の予定の更新・削除と合わせて実行する。

途中失敗のケースでは、`@MockitoSpyBean`でMapperの返却件数を差し替える。
その他のMapper呼び出しは実SQLで実行し、先行操作のDB変更がロールバックされることと
404応答を確認する。テスト全体には`@Transactional`を付けない。

実行例: `docker compose exec -T backend sh ./gradlew test --tests '*Scheduler*'`

ApiIntegrationInfrastructureTestsはToDoの登録・取得を2回繰り返し、基盤とデータ分離を検証する。
ToDoListApiTestsはToDoの5エンドポイントについて、期限の3形式、優先度、完了状態、
更新時の項目保持、単体・複数削除、実装済みの400・404応答とDB状態を検証する。
SchedulerApiTestsはSchedulerの4エンドポイントについて、通常・終日予定、期間重複と両端の境界、
同日検索、登録、予定種類の切り替え、更新・削除の404応答を検証する。
calendar_eventとscheduleの両テーブルを独立したSQLで確認し、両者のIDが異なる場合も扱う。
TimeTableApiTests・TimeBlockApiTests・TimeBlockTaskApiTests・TemplateBlockApiTestsは
TimeBlockingの14エンドポイントを検証する。日付重複409、未登録IDの404、配置・保持の切り替え、
開始時刻だけの更新、更新時の子タスク保持、ブロック削除時の子タスク削除を含む。

## TimeBlockingの回帰ケース

`ScheduleTimeBlockIndependenceTests`は通常・終日・日またぎの予定を登録・更新・削除し、
タイムテーブル・ブロック・タスクの全行が操作前と一致することを確認する。
タイムテーブルが存在しない日への移動と、同日内で通常予定を終日予定へ切り替えた際の
ブロック・タスクの保持を含む。H2のメタデータで、`time_blocks.schedule_id` と
`time_blocks` から `schedule` への外部キーが存在せず、`calendar_event.schedule_id` から
`schedule.id` への外部キーが保持されることも確認する。

- ブロックの登録・更新・開始時刻の更新・削除では、同じユーザーのカレンダーイベントが
  存在する状態で操作し、予定とイベントの全行が維持されることを確認する。
- HOLD一覧とタイムテーブル取得では、予定とブロックが共存する状態でブロックの子タスクを
  取得でき、レスポンスに `relatedSchedule` が含まれないことを確認する。
- 他ユーザーのブロックへの更新・開始時刻の更新・削除と、存在しないか他ユーザーが所有する
  タイムテーブルを配置先にした登録・更新は、404を返し、既存の行を保持することを確認する。

過去の成功・失敗件数は現在の結果を示さない。実際の結果はテストレポートで確認する。

## ToDoの仕様差分・未確定事項

- 通常更新の成功ステータスは仕様書が204、現実装が201。テストでは現行互換性を
  明示的に201で確認する。204への統一が決まった場合は実装とテストを同時に変更する。
- 仕様書の `TATETIME`、`DATE`、`isComleted` という記述は、実際の型・JSONでは
  `DATETIME`、`DATED`、`isCompleted` を使用する。
- 複数削除で存在するIDと存在しないIDが混在すると、現実装では途中まで削除されうる。
  原子性について仕様が定まっていないため、その部分削除を期待するテストは追加しない。
- 任意のnullや不正な配列要素に対するエラー応答は、実装と仕様の対応を確認してからテストを追加する。

## 外部DB・HTTPSとの結合

通常のH2テストはTiDBへ接続しない。MockMvcで成功しても実ブラウザ・HTTPS・配置先の振り分けを保証しない。
プロキシ・Cookie・CSRFは [ローカルHTTPS検証](../../../frontend/README.md#転送設定とローカルhttpsの検証)、
TiDB上の保存・共有・再起動は [TiDB共有セッション検証](../../verification/README.md) を使う。
各環境での過去の実行結果は、開発者向けの再実行手順から分離して管理する。
