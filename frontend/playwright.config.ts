import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { loadE2eEnvironment, resultPath } from './e2e/environment';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const environment = loadE2eEnvironment(process.env, existsSync(envPath) ? readFileSync(envPath, 'utf8') : '');
const resultDirectory = fileURLToPath(new URL(`./${resultPath(environment.baseURL, process.env)}/`, import.meta.url));

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    outputDir: `${resultDirectory}/artifacts`,
    reporter: [
        ['list'],
        ['html', { outputFolder: `${resultDirectory}/report`, open: 'never' }],
        ['json', { outputFile: `${resultDirectory}/results.json` }],
    ],
    metadata: { baseURL: environment.baseURL, apiBaseURL: environment.apiBaseURL, peer: environment.peer?.baseURL },
    use: {
        baseURL: environment.baseURL,
        headless: true,
        trace: environment.artifacts === 'all' ? 'on' : 'retain-on-failure',
        screenshot: environment.artifacts === 'all' ? 'on' : 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
