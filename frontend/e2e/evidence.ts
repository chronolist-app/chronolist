import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export type Checkpoint = { id: string; requirement: string; expected: string };
export type EvidencePlan = { purpose: string; scenario: 'todo'; title: string; checkpoints: Checkpoint[] };
type Identity = { sha: string; dirtyHash: string; baseURL: string; apiBaseURL: string; planHash: string };
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

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

/** 確認失敗でも撮影を試み、両方の状態を独立に返す。 */
export async function captureCheckpoint(point: Checkpoint, capture: () => Promise<string>, verify?: () => Promise<void>) {
    const result = { ...point, capture: 'unverified', verification: 'unverified', path: '', errors: [] as string[] };
    if (verify) {
        try { await verify(); result.verification = 'passed'; }
        catch { result.verification = 'failed'; result.errors.push('期待状態の確認に失敗'); }
    }
    try { result.path = await capture(); result.capture = 'passed'; }
    catch { result.capture = 'failed'; result.errors.push('画像の取得に失敗'); }
    return result;
}

/** 取得または確認の失敗時は、後続の変更操作へ進ませない。 */
export function requireCheckpointSuccess(result: { capture: string; verification: string }): void {
    if (result.capture !== 'passed' || result.verification !== 'passed') throw new Error('証跡取得または期待状態の確認に失敗したため中断します。');
}

/** Git 管理対象差分と未追跡ファイルの内容をハッシュ化し、秘密を本文へ出さず同一性を記録する。 */
export function evidenceIdentity(root: string, baseURL: string, apiBaseURL: string, plan: EvidencePlan): Identity {
    const git = (args: string[]) => execFileSync('git', args, { cwd: root });
    const changes = createHash('sha256').update(git(['diff', 'HEAD', '--binary']));
    for (const path of git(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean).sort()) {
        changes.update(path).update(readFileSync(`${root}/${path}`));
    }
    return { sha: git(['rev-parse', 'HEAD']).toString('utf8').trim(), dirtyHash: changes.digest('hex'),
        baseURL, apiBaseURL, planHash: digest(JSON.stringify(plan)) };
}

/** 要求とコード・環境が一致し、全画像が存在して確認も成功した場合だけ再利用を許す。 */
export function canReuseEvidence(value: unknown, current: Identity, exists: (path: string) => boolean, plan?: EvidencePlan): boolean {
    if (!value || typeof value !== 'object') return false;
    const record = value as Identity & { checkpoints?: { id?: string; capture: string; verification: string; path: string }[] };
    return Object.entries(current).every(([key, value]) => record[key as keyof Identity] === value)
        && Array.isArray(record.checkpoints) && record.checkpoints.length > 0
        && (!plan || (record.checkpoints.length === plan.checkpoints.length
            && plan.checkpoints.every(point => record.checkpoints!.filter(result => result?.id === point.id).length === 1)))
        && record.checkpoints.every(point => point && point.capture === 'passed' && point.verification === 'passed'
            && typeof point.path === 'string' && !!point.path && exists(point.path));
}
