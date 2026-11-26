import type { Locator, Page } from '@playwright/test';
import { test, expect, requestFromBrowser } from './fixtures';

/** ブラウザの認証情報とCSRFトークンを使い、検証データを実APIへ登録する。 */
async function putBlock(page: Page, apiBaseURL: string, data: unknown) {
    const result = await page.evaluate(async ({ apiBaseURL, data }) => {
        const csrf = await fetch(`${apiBaseURL}/api/csrf`, { credentials: 'include' });
        if (!csrf.ok) throw new Error(`CSRF取得失敗: ${csrf.status}`);
        const { token, headerName } = await csrf.json();
        const response = await fetch(`${apiBaseURL}/api/timeblocking/timeBlock/register`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json', [headerName]: token },
            body: JSON.stringify(data),
        });
        return { ok: response.ok, body: await response.json() };
    }, { apiBaseURL, data });
    expect(result.ok).toBeTruthy();
    return result.body as number;
}

/** 入力確定をblurとEnterで別々に確認する。 */
async function finishField(field: Locator, method: 'blur' | 'Enter') {
    if (method === 'Enter') await field.press('Enter');
    else await field.press('Tab');
    await expect(field).not.toBeFocused();
}

/** 入力と補助文の表示領域がビューポートに収まることを確認する。 */
async function expectFieldFits(field: Locator, width: number) {
    const box = await field.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

test.describe('TimeBlocking作成', () => {
    for (const width of [375, 1280]) {
        for (const form of [
            { name: 'ブロック', button: 'タイムブロックを追加', title: 'ブロック名', color: 'カラー', value: '  ブロックA  ', area: 'HOLDブロック', api: 'timeBlock', list: 'getHoldBlocks' },
            { name: 'テンプレート', button: 'テンプレートタイムブロックを追加', title: 'タイトル', color: '色', value: '  テンプレA  ', area: 'テンプレートブロック', api: 'templateBlock', list: 'getAll' },
        ]) {
            test(`${form.name}の検証・入力・保存中状態・再読込を維持する (${width}px)`, async ({ page, account, environment }) => {
                void account;
                await page.setViewportSize({ width, height: 1000 });
                const loaded = page.waitForResponse(response => response.url().includes('/api/timeblocking/timeTable/getByDate/') && response.ok());
                await page.goto('/timeblocking?date=2026-01-15');
                await loaded;
                await page.getByRole('button', { name: form.button, exact: true }).click();
                const dialog = page.getByRole('dialog');
                const title = dialog.getByRole('textbox', { name: form.title, exact: true });
                const color = dialog.getByRole('textbox', { name: form.color, exact: true });
                const registerURL = `${environment.apiBaseURL}/api/timeblocking/${form.api}/register`;
                let requests = 0;
                page.on('request', request => {
                    if (request.url() === registerURL && request.method() === 'PUT') requests++;
                });
                await dialog.getByRole('button', { name: '作成', exact: true }).click();
                await expect(title).toHaveAttribute('aria-invalid', 'true');
                const helperId = await title.getAttribute('aria-describedby');
                expect(helperId).toBeTruthy();
                const helper = dialog.locator(`[id="${helperId}"]`);
                await expect(helper).toContainText(`${form.title}を入力`);
                expect(await helper.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
                expect(requests).toBe(0);

                await title.fill(form.value);
                await expect(title).toHaveValue(form.value.trim());
                await expect(title).toHaveAttribute('aria-invalid', 'false');
                await expect(helper).toHaveCount(0);
                await expect(title).toBeFocused();
                await title.press('Tab');
                await expect(dialog.getByLabel('幅', { exact: true })).toBeFocused();
                await dialog.getByLabel('幅', { exact: true }).press('Tab');
                await expect(color).toBeFocused();
                await color.fill('  red  ');
                await expect(color).toHaveValue('red');
                for (const field of [title, color]) {
                    const box = await field.boundingBox();
                    expect(box).not.toBeNull();
                    expect(box!.x).toBeGreaterThanOrEqual(0);
                    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
                }

                // 実APIへの送信を保留して保存中状態を確認し、そのまま実サーバーへ続行する。
                let release!: () => void;
                const gate = new Promise<void>(resolve => { release = resolve; });
                await page.route(registerURL, async route => {
                    await gate;
                    await route.continue();
                });
                const registered = page.waitForResponse(response => response.url() === registerURL && response.request().method() === 'PUT');
                await dialog.getByRole('button', { name: '作成', exact: true }).click();
                try {
                    await expect(title).toBeDisabled();
                    await expect(color).toBeDisabled();
                    await expect(dialog.getByLabel('幅', { exact: true })).toBeDisabled();
                    await expect(dialog.getByRole('button', { name: '作成中…', exact: true })).toBeDisabled();
                    await expect(dialog.getByRole('button', { name: 'キャンセル', exact: true })).toBeDisabled();
                } finally {
                    release();
                }
                const response = await registered;
                expect(response.ok()).toBeTruthy();
                expect(response.request().postDataJSON()).toEqual(expect.objectContaining({ title: form.value.trim(), color: 'red' }));
                expect(requests).toBe(1);
                await expect(dialog).toHaveCount(0);
                await expect(page.getByLabel(form.area, { exact: true }).getByText(form.value.trim(), { exact: true })).toBeVisible();

                const reloaded = page.waitForResponse(response => response.url() === `${environment.apiBaseURL}/api/timeblocking/${form.api}/${form.list}` && response.ok());
                await page.reload();
                expect(await (await reloaded).json()).toEqual(expect.arrayContaining([expect.objectContaining({ title: form.value.trim(), color: 'red' })]));
                await expect(page.getByLabel(form.area, { exact: true }).getByText(form.value.trim(), { exact: true })).toBeVisible();
            });
        }
    }
});

test.describe('TimeBlocking幅時刻', () => {
    for (const width of [375, 1280]) {
        for (const method of ['blur', 'Enter'] as const) {
            test(`幅の正常値と不正値を${method}で確定する (${width}px)`, async ({ page, account, environment }) => {
                void account;
                await page.setViewportSize({ width, height: 1000 });
                const title = `幅検証${method}`;
                const id = await putBlock(page, environment.apiBaseURL, { title, width: 30, color: 'gray', status: 'HOLD', timeTableId: null, startAt: null, tasks: [] });
                await page.goto('/timeblocking?date=2026-01-15');
                await page.getByLabel('HOLDブロック', { exact: true }).getByText(title, { exact: true }).dblclick();
                const field = page.getByRole('spinbutton', { name: '幅（分）', exact: true });
                await expect(field).toHaveAttribute('min', '1');
                await expect(field).toHaveAttribute('max', '1440');
                await expect(field).toHaveAttribute('step', '30');
                const updateURL = `${environment.apiBaseURL}/api/timeblocking/timeBlock/update`;
                const updated = page.waitForResponse(response => response.url() === updateURL && response.request().method() === 'PUT');
                await field.fill('60');
                await finishField(field, method);
                const response = await updated;
                expect(response.ok()).toBeTruthy();
                expect(response.request().postDataJSON()).toEqual(expect.objectContaining({ id, width: 60 }));
                await expect(field).toHaveValue('60');

                for (const invalid of ['', '0', '1441', '61']) {
                    // 不正入力ごとに保存済みデータから開き直し、前のdraft/errorを引き継がない。
                    await page.reload();
                    await page.getByLabel('HOLDブロック', { exact: true }).getByText(title, { exact: true }).dblclick();
                    await expect(field).toHaveValue('60');
                    let updates = 0;
                    const count = (request: import('@playwright/test').Request) => {
                        if (request.url() === updateURL && request.method() === 'PUT') updates++;
                    };
                    page.on('request', count);
                    await field.fill(invalid);
                    await finishField(field, method);
                    await expect(field).toHaveAttribute('aria-invalid', 'true');
                    const helperId = await field.getAttribute('aria-describedby');
                    await expect(page.locator(`[id="${helperId}"]`)).toContainText('幅は1〜1440分');
                    expect(updates).toBe(0);
                    page.off('request', count);
                    const saved = await requestFromBrowser(page, environment.apiBaseURL, '/timeblocking/timeBlock/getHoldBlocks');
                    expect(saved.ok).toBeTruthy();
                    expect(saved.body).toEqual(expect.arrayContaining([expect.objectContaining({ id, width: 60 })]));
                }
                await page.reload();
                await page.getByLabel('HOLDブロック', { exact: true }).getByText(title, { exact: true }).dblclick();
                await expect(field).toHaveValue('60');
            });

            test(`FromとToの正常値と不正値を${method}で確定する (${width}px)`, async ({ page, account, environment }) => {
                void account;
                await page.setViewportSize({ width, height: 1000 });
                const date = '2026-01-15';
                const table = await requestFromBrowser(page, environment.apiBaseURL, '/timeblocking/timeTable/createAt', { date });
                expect(table.ok).toBeTruthy();
                const title = `時刻検証${method}`;
                const id = await putBlock(page, environment.apiBaseURL, { title, width: 60, color: 'gray', status: 'PLACED', timeTableId: table.body, startAt: '09:00', tasks: [] });
                await page.goto(`/timeblocking?date=${date}`);
                await page.getByText(title, { exact: true }).dblclick();
                const from = page.getByRole('textbox', { name: 'From', exact: true });
                const to = page.getByRole('textbox', { name: 'To', exact: true });
                const updateURL = `${environment.apiBaseURL}/api/timeblocking/timeBlock/update/startAt`;
                for (const change of [{ field: from, value: '10:00', start: '10:00', end: '11:00' }, { field: to, value: '24:00', start: '23:00', end: '24:00' }]) {
                    const updated = page.waitForResponse(response => response.url() === updateURL && response.request().method() === 'PUT');
                    await change.field.fill(change.value);
                    await finishField(change.field, method);
                    const response = await updated;
                    expect(response.ok()).toBeTruthy();
                    expect(response.request().postDataJSON()).toEqual({ id, startAt: change.start });
                    await expect(from).toHaveValue(change.start);
                    await expect(to).toHaveValue(change.end);
                    const saved = await requestFromBrowser(page, environment.apiBaseURL, `/timeblocking/timeTable/getByDate/${date}`);
                    expect(saved.ok).toBeTruthy();
                    expect(saved.body).toEqual(expect.objectContaining({ timeBlocks: expect.arrayContaining([expect.objectContaining({ id, width: 60, startAt: `${change.start}:00` })]) }));
                }
                for (const invalid of [{ field: from, value: '24:00' }, { field: to, value: '25:00' }, { field: from, value: 'abc' }, { field: from, value: '23:30' }]) {
                    await page.reload();
                    await page.getByText(title, { exact: true }).dblclick();
                    await expect(from).toHaveValue('23:00');
                    await expect(to).toHaveValue('24:00');
                    let updates = 0;
                    const count = (request: import('@playwright/test').Request) => {
                        if (request.url() === updateURL && request.method() === 'PUT') updates++;
                    };
                    page.on('request', count);
                    await invalid.field.fill(invalid.value);
                    await finishField(invalid.field, method);
                    await expect(from).toHaveAttribute('aria-invalid', 'true');
                    await expect(to).toHaveAttribute('aria-invalid', 'true');
                    const helperId = await from.getAttribute('aria-describedby');
                    await expect(page.locator(`[id="${helperId}"]`)).toBeVisible();
                    expect(updates).toBe(0);
                    page.off('request', count);
                    const saved = await requestFromBrowser(page, environment.apiBaseURL, `/timeblocking/timeTable/getByDate/${date}`);
                    expect(saved.ok).toBeTruthy();
                    expect(saved.body).toEqual(expect.objectContaining({ timeBlocks: expect.arrayContaining([expect.objectContaining({ id, width: 60, startAt: '23:00:00' })]) }));
                }
            });
        }

        test(`From・Toと長い補助文の表示領域を確認する (${width}px)`, async ({ page, account, environment }) => {
            void account;
            await page.setViewportSize({ width, height: 1000 });
            const date = '2026-01-15';
            const table = await requestFromBrowser(page, environment.apiBaseURL, '/timeblocking/timeTable/createAt', { date });
            expect(table.ok).toBeTruthy();
            const title = '表示確認';
            await putBlock(page, environment.apiBaseURL, { title, width: 60, color: 'gray', status: 'PLACED', timeTableId: table.body, startAt: '09:00', tasks: [] });
            await page.goto(`/timeblocking?date=${date}`);
            await page.getByText(title, { exact: true }).dblclick();
            const from = page.getByRole('textbox', { name: 'From', exact: true });
            const to = page.getByRole('textbox', { name: 'To', exact: true });
            await expectFieldFits(from, width);
            await expectFieldFits(to, width);
            await from.fill('abc');
            await finishField(from, 'blur');
            const helperId = await from.getAttribute('aria-describedby');
            const helper = page.locator(`[id="${helperId}"]`);
            await expect(helper).toContainText('時刻をHH:mm形式');
            const helperMetrics = await helper.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {
                    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right },
                    text: element.textContent,
                    computed: { fontSize: style.fontSize, lineHeight: style.lineHeight, whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak },
                };
            });
            expect(helperMetrics.scrollWidth, JSON.stringify(helperMetrics)).toBeLessThanOrEqual(helperMetrics.clientWidth);
            await expectFieldFits(helper, width);
        });
    }
});
