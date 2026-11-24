import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// アプリ用設定や.envに依存せず、ブラウザhelperだけを独立して検証する。
const runId = process.env.CHRONOLIST_BROWSER_RUN_ID ?? `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
if (!/^[\da-fTZ-]+$/.test(runId)) throw new Error('ブラウザ検証の実行 ID が不正です。');
process.env.CHRONOLIST_BROWSER_RUN_ID = runId;
const results = fileURLToPath(new URL(`./e2e-results/browser/${runId}/`, import.meta.url));
export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    outputDir: `${results}/artifacts`,
    reporter: [
        ['list'],
        ['html', { outputFolder: `${results}/report`, open: 'never' }],
        ['json', { outputFile: `${results}/results.json` }],
    ],
    use: { headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
