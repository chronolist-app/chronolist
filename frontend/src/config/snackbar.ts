/**
 * 一時通知（notistack の Snackbar）の共通設定。
 * 表示位置・件数・表示時間はここだけで調整する。
 */

/**
 * 同時に表示する最大件数。
 * 上限を超えた場合の挙動は notistack の標準動作に従う。新しい通知を表示するため、
 * 最古の通知を表示時間の途中でも消去する。チケット当初案の「枠が空くまで待機」とは異なり、
 * ユーザー判断で標準動作を採用している。独自キュー・ライブラリのパッチ・persist による回避は行わない。
 */
export const SNACKBAR_MAX_COUNT = 5;

/** 通常通知の自動消去までの時間（ミリ秒）。Provider の既定値として全通知に適用する。 */
export const SNACKBAR_AUTO_HIDE_MS = 5000;

/** アクションボタン付き通知の自動消去までの時間（ミリ秒）。操作する余裕を持たせる。 */
export const SNACKBAR_ACTION_AUTO_HIDE_MS = 10000;

/** 表示位置（右下固定）。 */
export const SNACKBAR_ANCHOR_ORIGIN = { vertical: "bottom", horizontal: "right" } as const;

/** 同一メッセージの重複表示を抑止する（notistack 標準の preventDuplicate）。 */
export const SNACKBAR_PREVENT_DUPLICATE = true;

/** 手動消去ボタンの aria-label。 */
export const SNACKBAR_CLOSE_LABEL = "閉じる";
