import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, prepareAccount, fillTodoDraft, verifyTodoDraft, submitTodoDraft, verifySavedTodo } from './fixtures';
import { parseEvidencePlan, captureCheckpoint, evidenceIdentity, requireCheckpointSuccess, createEvidenceRecord, runEvidenceRecord } from './evidence';
import { reuseEvidence, imageReference } from './evidence-files';
import { resultPath } from './environment';
import { captureEvidenceImage } from './evidence-images';

test('要求に対応する ToDo の途中・結果を記録する', async ({ page, environment }) => {
    test.skip(!process.env.EVIDENCE_PLAN, '証跡の明示要求がある場合だけ実行する');
    const plan = parseEvidencePlan(JSON.parse(readFileSync(process.env.EVIDENCE_PLAN!, 'utf8')));
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const directory = resolve(root, 'frontend', resultPath(environment.baseURL, process.env), 'evidence');
    mkdirSync(directory, { recursive: true });
    const recordPath = resolve(directory, 'evidence.json');
    const resultsRoot = resolve(root, 'frontend/e2e-results');
    const record = { ...createEvidenceRecord(plan), worktree: root,
        environment: { browser: 'chromium', node: process.version, database: '開発用 H2（起動構成は呼出元で確認）' } };
    await runEvidenceRecord(record, plan, value => {
        writeFileSync(recordPath, JSON.stringify(value, null, 2), 'utf8');
        console.log(`証跡記録: ${recordPath}`);
    }, async () => {
        record.identity = await evidenceIdentity(root, environment.baseURL, environment.apiBaseURL, plan);
        record.stage = 'operation';
        if (process.env.EVIDENCE_REUSE) {
            const reused = reuseEvidence(resolve(process.env.EVIDENCE_REUSE), recordPath, resultsRoot, record.identity, plan);
            record.reuseRejection = reused.reason;
            if (reused.checkpoints) {
                record.checkpoints = reused.checkpoints;
                record.reusedFrom = relative(directory, resolve(process.env.EVIDENCE_REUSE)).split(sep).join('/');
                return;
            }
        }
        const account = await prepareAccount(page, environment);
        await fillTodoDraft(page, account.seedTitle, plan.title);
        const capture = async (id: string, verify: () => Promise<void>) => {
            const point = plan.checkpoints.find(point => point.id === id);
            if (!point) return;
            let reference = { path: '', sha256: '' };
            const result = await captureCheckpoint(point, async () => {
                const path = resolve(directory, `${id}.png`);
                await captureEvidenceImage(page, path);
                reference = imageReference(path, recordPath, resultsRoot);
                return reference.path;
            }, verify);
            result.sha256 = reference.sha256;
            record.checkpoints.push(result);
            requireCheckpointSuccess(result);
        };
        await capture('draft', () => verifyTodoDraft(page, plan.title));
        if (!plan.checkpoints.some(point => point.id === 'saved')) return;
        await submitTodoDraft(page, environment.apiBaseURL);
        await capture('saved', () => verifySavedTodo(page, environment.apiBaseURL, plan.title));
    });
});
