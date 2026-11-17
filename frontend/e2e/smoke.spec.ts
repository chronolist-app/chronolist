import { test, expect, requestFromBrowser } from './fixtures';

test('ログイン後に主要画面を表示し、作成した ToDo をリロード後も取得できる', async ({ page, account, environment }) => {
    await page.goto('/todolist');
    await expect(page.getByText(account.seedTitle, { exact: true })).toBeVisible();

    const title = `ブラウザ作成${account.loginId}`;
    await page.getByRole('button', { name: '新規作成', exact: true }).click();
    await page.getByLabel('タスク名', { exact: true }).fill(title);
    const saved = page.waitForResponse(response => response.url() === `${environment.apiBaseURL}/api/todolist/register` && response.request().method() === 'POST');
    await page.getByRole('button', { name: '登録', exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const tasks = await requestFromBrowser(page, environment.apiBaseURL, '/todolist/getAll');
    expect(tasks.ok).toBeTruthy();
    expect(tasks.body).toEqual(expect.arrayContaining([expect.objectContaining({ title })]));

    const scheduleLoaded = page.waitForResponse(response => response.url().includes('/api/scheduler/getEvents/') && response.ok());
    await page.goto('/scheduler');
    await scheduleLoaded;
    await expect(page.locator('.fc')).toBeVisible();
    await expect(page.locator('.fc-toolbar-title')).toBeVisible();

    const tableLoaded = page.waitForResponse(response => response.url().includes('/api/timeblocking/timeTable/getByDate/2026-01-15') && response.ok());
    await page.goto('/timeblocking?date=2026-01-15');
    await tableLoaded;
    await expect(page.getByRole('heading', { name: 'タイムブロック', exact: true })).toBeVisible();
    await expect(page.getByText('2026-01-15', { exact: true })).toBeVisible();
});
