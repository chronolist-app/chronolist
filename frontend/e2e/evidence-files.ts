import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import type { CheckpointResult, EvidencePlan, EvidenceRecord, Identity } from './evidence.ts';

function inside(root: string, path: string): boolean {
    const rel = relative(resolve(root), resolve(path));
    return !!rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function checkedImage(path: string, recordPath: string, resultsRoot: string): string {
    if (!path || isAbsolute(path) || win32.isAbsolute(path) || path.includes('\\')) throw new Error();
    const absolute = resolve(dirname(recordPath), path);
    if (!inside(resultsRoot, absolute) || !inside(realpathSync(resultsRoot), realpathSync(absolute)) || !statSync(absolute).isFile()) throw new Error();
    return absolute;
}
/** 画像参照はrecord基準の相対pathと内容hashに限定する。 */
export function imageReference(image: string, recordPath: string, resultsRoot: string): { path: string; sha256: string } {
    const path = relative(dirname(recordPath), image).split(sep).join('/');
    const absolute = checkedImage(path, recordPath, resultsRoot);
    return { path, sha256: createHash('sha256').update(readFileSync(absolute)).digest('hex') };
}
export type ReuseResult = { reason: string; checkpoints?: CheckpointResult[] };
/** 既存recordだけを読み取り失敗から回復する。現実行の失敗はこの関数では捕捉しない。 */
export function reuseEvidence(source: string, target: string, resultsRoot: string, current: Identity, plan: EvidencePlan): ReuseResult {
    if (!inside(resultsRoot, source) || !inside(resultsRoot, target)) return { reason: 'record-outside-root' };
    let content: string;
    try {
        if (!inside(realpathSync(resultsRoot), realpathSync(source))) return { reason: 'record-outside-root' };
        content = readFileSync(source, 'utf8');
    } catch (error) { return { reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'not-found' : 'read-failed' }; }
    let value: unknown;
    try { value = JSON.parse(content); } catch { return { reason: 'invalid-json' }; }
    if (!value || typeof value !== 'object' || (value as EvidenceRecord).schemaVersion !== 2) return { reason: 'unsupported-schema' };
    const record = value as EvidenceRecord;
    if (!record.identity || !Object.entries(current).every(([key, value]) => record.identity![key as keyof Identity] === value)) return { reason: 'identity-mismatch' };
    if (record.failure) return { reason: 'previous-failure' };
    if (!Array.isArray(record.checkpoints) || record.checkpoints.length !== plan.checkpoints.length
        || !plan.checkpoints.every(point => record.checkpoints.filter(result => result?.id === point.id).length === 1)) return { reason: 'checkpoints-mismatch' };
    const checkpoints: CheckpointResult[] = [];
    for (const point of record.checkpoints) {
        if (!point || point.capture !== 'passed' || point.verification !== 'passed') return { reason: 'checkpoint-not-passed' };
        if (typeof point.path !== 'string' || typeof point.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(point.sha256)) return { reason: 'image-invalid' };
        try {
            const image = checkedImage(point.path, source, resultsRoot);
            const reference = imageReference(image, target, resultsRoot);
            if (reference.sha256 !== point.sha256) return { reason: 'image-invalid' };
            // 旧record由来の任意の追加プロパティは引き継がない。
            const planned = plan.checkpoints.find(planned => planned.id === point.id)!;
            checkpoints.push({ ...planned, capture: 'passed', verification: 'passed', ...reference, failures: [] });
        } catch { return { reason: 'image-invalid' }; }
    }
    return { reason: '', checkpoints };
}
