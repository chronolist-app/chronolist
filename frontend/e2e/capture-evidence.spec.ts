import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, requestFromBrowser, createAccount, loginThroughUi, seedTask } from './fixtures';
import { parseEvidencePlan, captureCheckpoint, evidenceIdentity, canReuseEvidence, requireCheckpointSuccess } from './evidence';
import { resultPath } from './environment';
import { captureEvidenceImage } from './evidence-images';

test('要求に対応する ToDo の途中・結果を記録する', async ({ page, environment }) => {
    test.skip(!process.env.EVIDENCE_PLAN, '証跡の明示要求がある場合だけ実行する');
    const plan = parseEvidencePlan(JSON.parse(readFileSync(process.env.EVIDENCE_PLAN!, 'utf8')));
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const directory = resolve(root, 'frontend', resultPath(environment.baseURL, process.env), 'evidence');
    mkdirSync(directory, { recursive: true });
    const identity = evidenceIdentity(root, environment.baseURL, environment.apiBaseURL, plan);
    const record = { ...identity, purpose: plan.purpose, createdAt: new Date().toISOString(), worktree: root,
        environment: { browser: 'chromium', node: process.version, database: '開発用 H2（起動構成は呼出元で確認）' },
        checkpoints: [] as Awaited<ReturnType<typeof captureCheckpoint>>[], unverified: [] as string[], reusedFrom: '' };
    try {
        if (process.env.EVIDENCE_REUSE) {
            const previous = JSON.parse(readFileSync(process.env.EVIDENCE_REUSE, 'utf8'));
            if (canReuseEvidence(previous, identity, existsSync, plan)) {
                record.checkpoints = previous.checkpoints;
                record.reusedFrom = resolve(process.env.EVIDENCE_REUSE);
                return;
            }
        }
        await page.goto(`${environment.baseURL}/login`);
        const account = await createAccount(page, environment.apiBaseURL);
        await loginThroughUi(page, environment.baseURL, environment.apiBaseURL, account);
        await seedTask(page, environment.apiBaseURL, account.seedTitle);
        await page.goto('/todolist');
        await expect(page.getByText(account.seedTitle, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: '新規作成', exact: true }).click();
        await page.getByLabel('タスク名', { exact: true }).fill(plan.title);
        const capture = async (id: string, verify: () => Promise<void>) => {
            const point = plan.checkpoints.find(point => point.id === id);
            if (!point) return;
            const result = await captureCheckpoint(point, async () => {
                const path = resolve(directory, `${id}.png`);
                return captureEvidenceImage(page, path);
            }, verify);
            record.checkpoints.push(result);
            requireCheckpointSuccess(result);
        };
        await capture('draft', async () => {
            await expect(page.getByLabel('タスク名', { exact: true })).toHaveValue(plan.title);
            // React Bootstrap の show クラス反映とフェード・位置遷移の完了を確認する。
            await expect(page.getByRole('dialog')).toHaveClass(/\bshow\b/);
            await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
            await expect(page.locator('.modal.show .modal-dialog')).toHaveCSS('transform', 'none');
        });
        if (!plan.checkpoints.some(point => point.id === 'saved')) {
            expect(record.checkpoints.every(point => point.capture === 'passed' && point.verification === 'passed')).toBeTruthy();
            return;
        }
        const saved = page.waitForResponse(response => response.url() === `${environment.apiBaseURL}/api/todolist/register` && response.request().method() === 'POST');
        await page.getByRole('button', { name: '登録', exact: true }).click();
        expect((await saved).ok()).toBeTruthy();
        await page.reload();
        await capture('saved', async () => {
            await expect(page.getByText(plan.title, { exact: true })).toBeVisible();
            const tasks = await requestFromBrowser(page, environment.apiBaseURL, '/todolist/getAll');
            expect(tasks.ok).toBeTruthy();
            expect(tasks.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: plan.title })]));
        });
        expect(record.checkpoints.every(point => point.capture === 'passed' && point.verification === 'passed')).toBeTruthy();
    } finally {
        for (const point of plan.checkpoints) {
            if (!record.checkpoints.some(result => result.id === point.id)) {
                record.checkpoints.push({ ...point, capture: 'unverified', verification: 'unverified', path: '', errors: ['操作中断により未取得'] });
            }
        }
        record.unverified.push('指定要求以外の画面・本番環境・HTTPS・共有セッション');
        writeFileSync(resolve(directory, 'evidence.json'), JSON.stringify(record, null, 2), 'utf8');
        console.log(`証跡記録: ${resolve(directory, 'evidence.json')}`);
    }
});
