import { test, expect } from './fixtures';

for (const width of [375, 1280]) {
    test(`SchedulerのTitleが入力・エラー解除・保存と再読込に対応する (${width}px)`, async ({ page, account, environment }) => {
        await page.setViewportSize({ width, height: 1000 });
        const loaded = page.waitForResponse(response => response.url().includes('/api/scheduler/getEvents/') && response.ok());
        await page.goto('/scheduler');
        await loaded;
        const day = await page.locator('.fc-day-today .fc-daygrid-day-frame').boundingBox();
        expect(day).not.toBeNull();
        const x = day!.x + day!.width / 2;
        const y = day!.y + day!.height / 2;
        // FullCalendarはdown/up間のmousemoveでfinalHitを更新する。
        // 移動を伴わない合成dblclickではdateClickが発生しないため、小さく動かす。
        await page.mouse.move(x, y);
        for (const clickCount of [1, 2]) {
            await page.mouse.down({ clickCount });
            await page.mouse.move(x + clickCount, y);
            await page.mouse.up({ clickCount });
        }
        const dialog = page.getByRole('dialog');
        const title = dialog.getByRole('textbox', { name: 'Title', exact: true });
        await expect(title).toBeVisible();
        const id = await title.getAttribute('id');
        expect(id).toBeTruthy();
        await expect(dialog.locator(`label[for="${id}"]`)).toHaveText('Title');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        await expect(title).toHaveAttribute('aria-invalid', 'true');
        const descriptionId = await title.getAttribute('aria-describedby');
        expect(descriptionId).toBeTruthy();
        await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('タイトルを入力');

        const savedTitle = `連続入力テスト${account.loginId}`;
        await title.focus();
        for (const character of savedTitle) {
            await page.keyboard.insertText(character);
            await expect(title).toBeFocused();
        }
        await expect(title).toHaveValue(savedTitle);
        await expect(title).toHaveAttribute('aria-invalid', 'false');
        await expect(title).not.toHaveAttribute('aria-describedby');
        await dialog.locator(`label[for="${id}"]`).click();
        await expect(title).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(title).not.toBeFocused();
        const box = await title.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        const saved = page.waitForResponse(response => response.url() === `${environment.apiBaseURL}/api/scheduler/register` && response.request().method() === 'POST');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        expect((await saved).ok()).toBeTruthy();
        await page.reload();
        await expect(page.locator('.fc').getByText(savedTitle, { exact: true })).toBeVisible();
    });

    test(`共通入力の状態とキーボード操作を確認する (${width}px)`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.route('**/__chtextfield-check', route => route.fulfill({ contentType: 'text/html', body:
            `<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div>
<script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
</script><script type="module" src="/e2e/chtextfield-harness.tsx"></script></body></html>` }));
        await page.goto('/__chtextfield-check');
        const normal = page.getByRole('textbox', { name: '通常', exact: true });
        await normal.focus();
        await page.keyboard.insertText('日本語を続けて入力');
        await expect(normal).toBeFocused();
        await expect(normal).toHaveValue('日本語を続けて入力');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('textbox', { name: '小サイズ', exact: true })).toBeFocused();
        await expect(page.getByLabel('必須', { exact: false })).toHaveJSProperty('required', true);
        await expect(page.getByLabel('無効', { exact: true })).toBeDisabled();
        await expect(page.getByLabel('読み取り専用', { exact: true })).not.toBeEditable();
        await expect(page.getByLabel('パスワード', { exact: true })).toHaveAttribute('type', 'password');
        const small = await page.getByLabel('小サイズ', { exact: true }).boundingBox();
        const medium = await page.getByLabel('標準サイズ', { exact: true }).boundingBox();
        expect(small!.height).toBeLessThan(medium!.height);
        const error = page.getByLabel('長いラベルとエラー表示の確認', { exact: true });
        await expect(error).toHaveAttribute('aria-invalid', 'true');
        const descriptionId = await error.getAttribute('aria-describedby');
        const helper = page.locator(`[id="${descriptionId}"]`);
        await expect(helper).toBeVisible();
        expect(await helper.evaluate(element => element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth)).toBeTruthy();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        const required = page.getByLabel('必須', { exact: false });
        await required.focus();
        await page.keyboard.press('Tab');
        await expect(page.getByLabel('パスワード', { exact: true })).toBeFocused();
        await page.getByLabel('複数行', { exact: true }).fill('一行目\n二行目');
        await expect(page.getByLabel('複数行', { exact: true })).toHaveValue('一行目\n二行目');
    });
}
