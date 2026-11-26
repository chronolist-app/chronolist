import { test, expect } from './fixtures';

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
