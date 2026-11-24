/** 記録可能な固定説明だけを持つエラー。元の例外本文やstackは転記しない。 */
export const failureMessages = {
    'identity-git': 'Git の同一性確認に失敗しました。',
    'identity-unsupported-entry': '指紋化できない種類の未追跡項目があるため中断します。',
    'identity-read': '指紋化対象の読み取りに失敗しました。',
    'image-timeout': '表示画像の準備が制限時間内に完了しませんでした。',
    'image-decode': '表示画像のデコードに失敗しました。',
    'verification': '期待状態の確認処理に失敗しました。',
    'assertion': '期待状態の確認に失敗しました。',
    'selector-timeout': '画面操作の待機が制限時間を超えました。',
    'capture': '画像の取得に失敗しました。',
    'operation': '証跡の操作に失敗しました。',
    'checkpoint': '証跡取得または期待状態の確認に失敗したため中断します。',
} as const;
export type FailureCode = keyof typeof failureMessages;
export type FailureStage = 'identity' | 'operation' | 'verification' | 'capture';
export type EvidenceFailure = { stage: FailureStage; code: FailureCode; message: string };
/** 機微情報を含まない固定説明と分類を呼出元へ伝える。 */
export class EvidenceError extends Error {
    readonly code: FailureCode;
    readonly stage?: FailureStage;
    constructor(code: FailureCode, stage?: FailureStage, interrupted = false) {
        super((interrupted ? failureMessages.checkpoint + ' ' : '') + code + ': ' + failureMessages[code]);
        this.name = 'EvidenceError'; this.code = code; this.stage = stage;
    }
}
/** 外部例外は許可した型だけで分類し、機微情報を含み得るmessageは読まない。 */
export function safeFailure(error: unknown, stage: FailureStage): EvidenceFailure {
    const name = error instanceof Error ? error.name : '';
    const code = error instanceof EvidenceError ? error.code
        : name === 'TimeoutError' ? 'selector-timeout'
        : name === 'AssertionError' || name === 'AssertionError [ERR_ASSERTION]' || (error instanceof Error && error.constructor.name === 'ExpectError') ? 'assertion'
        : stage === 'verification' ? 'verification' : stage === 'identity' ? 'identity-git'
        : stage === 'capture' ? 'capture' : 'operation';
    return { stage: error instanceof EvidenceError ? error.stage ?? stage : stage, code, message: failureMessages[code] };
}
