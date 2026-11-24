import { test, expect, fillTodoDraft, verifyTodoDraft, submitTodoDraft, verifySavedTodo } from './fixtures';

test('ログイン後に主要画面を表示し、作成した ToDo をリロード後も取得できる', async ({ page, account, environment }) => {
    const title = `ブラウザ作成${account.loginId}`;
    await fillTodoDraft(page, account.seedTitle, title);
    await verifyTodoDraft(page, title);
    await submitTodoDraft(page, environment.apiBaseURL);
    await verifySavedTodo(page, environment.apiBaseURL, title);

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
