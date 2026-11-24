import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';
import { loadE2eEnvironment } from './environment';

type Account = { loginId: string; password: string; seedTitle: string };
type E2eEnvironment = ReturnType<typeof loadE2eEnvironment>;

/** ブラウザの名前解決・Cookie・CORS を通して実 API を呼び出す。 */
export async function requestFromBrowser(page: Page, apiBaseURL: string, path: string, data?: unknown) {
    return page.evaluate(async ({ url, data }) => {
        const headers: Record<string, string> = {};
        if (data !== undefined) {
            const csrf = await fetch(`${new URL(url).origin}/api/csrf`, { credentials: 'include' });
            if (!csrf.ok) throw new Error(`CSRF 取得失敗: ${csrf.status}`);
            const { token, headerName } = await csrf.json() as { token: string; headerName: string };
            headers[headerName] = token;
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(url, {
            method: data === undefined ? 'GET' : 'POST', credentials: 'include', headers,
            body: data === undefined ? undefined : JSON.stringify(data),
        });
        const text = await response.text();
        return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) as unknown : null };
    }, { url: `${apiBaseURL}/api${path}`, data });
}

/** 他の実行と衝突しない検証専用ユーザーを作る。認証情報はファイルに保存しない。 */
export async function createAccount(page: Page, apiBaseURL: string): Promise<Account> {
    const loginId = `e2e${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const password = `E2e${randomUUID().replaceAll('-', '')}`;
    const response = await requestFromBrowser(page, apiBaseURL, '/signup', { loginId, password });
    expect(response.ok, '検証専用ユーザーを登録できる').toBeTruthy();
    return { loginId, password, seedTitle: `初期タスク${loginId}` };
}

/** 認証状態を使い回さず、ログイン画面から実 API にログインする。 */
export async function loginThroughUi(page: Page, baseURL: string, apiBaseURL: string, account: Account) {
    if (page.url() !== `${baseURL}/login`) await page.goto(`${baseURL}/login`);
    await page.locator('input[name="login_id"]').fill(account.loginId);
    await page.locator('input[name="password"]').fill(account.password);
    const loggedIn = page.waitForResponse(response => response.url() === `${apiBaseURL}/api/login` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'APIログイン', exact: true }).click();
    expect((await loggedIn).ok(), 'ブラウザでログインできる').toBeTruthy();
    await expect(page).toHaveURL(`${baseURL}/`);
}

/** 検証ユーザーに既知の初期 ToDo を実 API で作る。 */
export async function seedTask(page: Page, apiBaseURL: string, title: string) {
    const response = await requestFromBrowser(page, apiBaseURL, '/todolist/register', {
        title, dueKind: 'NONE', dueDate: null, dueTime: null, priority: 'HIGH', isCompleted: false, memo: null,
    });
    expect(response.ok, '初期 ToDo を登録できる').toBeTruthy();
}

/** API取得元のOriginを確立してから、検証ユーザー・UIログイン・初期ToDoを準備する。 */
export async function prepareAccount(page: Page, environment: E2eEnvironment): Promise<Account> {
    await page.goto(`${environment.baseURL}/login`);
    const account = await createAccount(page, environment.apiBaseURL);
    await loginThroughUi(page, environment.baseURL, environment.apiBaseURL, account);
    await seedTask(page, environment.apiBaseURL, account.seedTitle);
    return account;
}

/** 一覧の準備を確認し、新規ToDoの入力途中まで進める。送信は行わない。 */
export async function fillTodoDraft(page: Page, seedTitle: string, title: string): Promise<void> {
    await page.goto('/todolist');
    await expect(page.getByText(seedTitle, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.getByLabel('タスク名', { exact: true }).fill(title);
}

/** 入力値とモーダルの遷移完了を確認する。 */
export async function verifyTodoDraft(page: Page, title: string): Promise<void> {
    await expect(page.getByLabel('タスク名', { exact: true })).toHaveValue(title);
    await expect(page.getByRole('dialog')).toHaveClass(/\bshow\b/);
    await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
    await expect(page.locator('.modal.show .modal-dialog')).toHaveCSS('transform', 'none');
}

/** 入力済みToDoを送信し、実APIの登録応答を確認する。 */
export async function submitTodoDraft(page: Page, apiBaseURL: string): Promise<void> {
    const saved = page.waitForResponse(response => response.url() === `${apiBaseURL}/api/todolist/register` && response.request().method() === 'POST');
    await page.getByRole('button', { name: '登録', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
}

/** 再読込した一覧と実APIの双方で登録内容の永続化を確認する。 */
export async function verifySavedTodo(page: Page, apiBaseURL: string, title: string): Promise<void> {
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const tasks = await requestFromBrowser(page, apiBaseURL, '/todolist/getAll');
    expect(tasks.ok).toBeTruthy();
    expect(tasks.body).toEqual(expect.arrayContaining([expect.objectContaining({ title })]));
}

export const test = base.extend<{ environment: E2eEnvironment; account: Account }>({
    // Playwright の fixture 関数は第1引数の分割代入を要求する。
    // eslint-disable-next-line no-empty-pattern
    environment: async ({}, provide) => {
        const envPath = fileURLToPath(new URL('../../.env', import.meta.url));
        await provide(loadE2eEnvironment(process.env, existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''));
    },
    account: async ({ page, environment }, provide) => {
        await provide(await prepareAccount(page, environment));
    },
});

export { expect };
