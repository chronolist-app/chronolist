import { EvidenceError, safeFailure, type EvidenceFailure, type FailureStage } from './evidence-errors.ts';
export { evidenceIdentity } from './evidence-git.ts';
export type Checkpoint = { id: string; requirement: string; expected: string };
export type EvidencePlan = { purpose: string; scenario: 'todo'; title: string; checkpoints: Checkpoint[] };
export type Identity = { sha: string; dirtyHash: string; baseURL: string; apiBaseURL: string; planHash: string };
export type CheckpointResult = Checkpoint & { capture: string; verification: string; path: string; sha256: string; failures: EvidenceFailure[] };
export type EvidenceRecord = {
    schemaVersion: 2; identity: Identity | null; purpose: string; createdAt: string;
    checkpoints: CheckpointResult[]; unverified: string[]; reusedFrom: string; reuseRejection: string;
    failure: EvidenceFailure | null; stage: FailureStage;
};
/** 曖昧な計画や代表シナリオで取得できない地点はブラウザ操作前に拒否する。 */
export function parseEvidencePlan(value: unknown): EvidencePlan {
    const plan = value as EvidencePlan;
    if (!plan || typeof plan.purpose !== 'string' || !plan.purpose.trim() || plan.scenario !== 'todo'
        || typeof plan.title !== 'string' || !plan.title.trim() || !Array.isArray(plan.checkpoints)
        || !plan.checkpoints.length || plan.checkpoints.some(point => !point || !['draft', 'saved'].includes(point.id)
            || typeof point.requirement !== 'string' || !point.requirement.trim()
            || typeof point.expected !== 'string' || !point.expected.trim())
        || new Set(plan.checkpoints.map(point => point.id)).size !== plan.checkpoints.length) {
        throw new Error('証跡計画に目的・todo シナリオ・タスク名・一意な draft/saved 地点・要求・期待状態が必要です。');
    }
    return plan;
}
/** 同一性が不明な初期状態を明示し、失敗時に成功値を補わない。 */
export function createEvidenceRecord(plan: EvidencePlan): EvidenceRecord {
    return { schemaVersion: 2, identity: null, purpose: plan.purpose, createdAt: new Date().toISOString(),
        checkpoints: [], unverified: [], reusedFrom: '', reuseRejection: '', failure: null, stage: 'identity' };
}
/** 同一性確認も保護範囲に含め、途中失敗と未到達地点を必ず保存する。 */
export async function runEvidenceRecord(record: EvidenceRecord, plan: EvidencePlan, save: (record: EvidenceRecord) => void, action: () => Promise<void>) {
    try { await action(); }
    catch (error) {
        record.failure = safeFailure(error, record.stage);
        throw new EvidenceError(record.failure.code);
    } finally {
        for (const point of plan.checkpoints) {
            if (!record.checkpoints.some(result => result.id === point.id)) {
                record.checkpoints.push({ ...point, capture: 'unverified', verification: 'unverified', path: '', sha256: '', failures: [] });
            }
        }
        record.unverified.push('指定要求以外の画面・本番環境・HTTPS・共有セッション');
        save(record);
    }
}
/** 確認失敗でも撮影を試み、両方の状態を独立に返す。 */
export async function captureCheckpoint(point: Checkpoint, capture: () => Promise<string>, verify?: () => Promise<void>): Promise<CheckpointResult> {
    const result: CheckpointResult = { ...point, capture: 'unverified', verification: 'unverified', path: '', sha256: '', failures: [] };
    if (verify) {
        try { await verify(); result.verification = 'passed'; }
        catch (error) { result.verification = 'failed'; result.failures.push(safeFailure(error, 'verification')); }
    }
    try { result.path = await capture(); result.capture = 'passed'; }
    catch (error) { result.capture = 'failed'; result.failures.push(safeFailure(error, 'capture')); }
    return result;
}
/** 取得または確認の失敗時は、安全な原因説明を添えて後続操作を中断する。 */
export function requireCheckpointSuccess(result: { capture: string; verification: string; failures?: EvidenceFailure[] }): void {
    if (result.capture !== 'passed' || result.verification !== 'passed') {
        const failure = result.failures?.at(-1);
        throw new EvidenceError(failure?.code ?? 'checkpoint', failure?.stage, true);
    }
}
