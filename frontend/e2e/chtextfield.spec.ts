import { test, expect } from './fixtures';
import { isViteDevelopmentResponse } from './vite-environment';

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
            // FullCalendarのElementMirror.stopはsetTimeout(0)後にdrag終了を通知する。
            // 次のdownがisDraggingで捨てられないよう、同じtimerキューの次ターンまで待つ。
            await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
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
        const harness = await page.goto('/e2e/chtextfield.html');
        expect(harness).not.toBeNull();
        if (harness!.status() !== 404) expect(harness!.ok(), '状態HTMLのサーバー異常をskipしない').toBeTruthy();
        // Chromiumで名前解決し、document用AcceptによるViteのHTMLフォールバックも避ける。
        const vite = await page.evaluate(async () => {
            const response = await fetch('/@vite/client');
            return { status: response.status, contentType: response.headers.get('content-type') ?? '' };
        });
        test.skip(!isViteDevelopmentResponse(vite.status, vite.contentType),
            '状態一覧は開発用Vite専用です。ビルド済み配信ではScheduler等の実画面テストを実行します。');
        expect(harness!.ok(), '開発用Viteでは状態HTMLが存在する').toBeTruthy();
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
        for (const [label, tag] of [['Enterで確定', 'INPUT'], ['複数行のEnterで確定', 'TEXTAREA']]) {
            const field = page.getByLabel(label, { exact: true });
            await field.fill('確定する値');
            await field.press('Enter');
            await expect(field).not.toBeFocused();
            await expect(page.getByLabel('確定イベント')).toHaveText(`確定:${tag}:確定する値`);
        }
        const nativeValues = { date: '2026-11-18', time: '12:30', 'datetime-local': '2026-11-18T12:30', month: '2026-11', week: '2026-W47' };
        for (const [type, value] of Object.entries(nativeValues)) {
            const field = page.getByLabel(`空の${type}`, { exact: true });
            const id = await field.getAttribute('id');
            const inputLabel = page.locator(`label[for="${id}"]`);
            await expect(field).toHaveValue('');
            await expect(inputLabel).toHaveAttribute('data-shrink', 'true');
            await field.fill(value);
            await expect(field).toHaveValue(value);
            await expect(inputLabel).toHaveAttribute('data-shrink', 'true');
            // 入力時のラベル移動アニメーションを含め、最終表示で入力文字と重ならないことを確認する。
            await expect.poll(async () => {
                const labelBox = await inputLabel.boundingBox();
                const fieldBox = await field.boundingBox();
                return labelBox!.y < fieldBox!.y;
            }).toBeTruthy();
        }
        const autofill = page.getByLabel('自動入力検証', { exact: true });
        const autofillId = await autofill.getAttribute('id');
        const autofillLabel = page.locator(`label[for="${autofillId}"]`);
        await expect(autofillLabel).toHaveAttribute('data-shrink', 'false');
        await expect(autofill).toHaveAttribute('aria-invalid', 'false');
        await autofill.evaluate(element => element.dispatchEvent(new AnimationEvent('animationstart', { animationName: 'mui-auto-fill', bubbles: true })));
        await expect(autofillLabel).toHaveAttribute('data-shrink', 'true');
        await expect(page.getByLabel('確定イベント')).not.toHaveText('内部イベントが上書きされた');
        // rootを持たない文書でも、状態コンポーネントのimportだけでは描画を始めない。
        const importedWithoutRoot = await page.evaluate(async () => {
            document.getElementById('root')!.remove();
            const moduleUrl = '/e2e/CHTextFieldStates.tsx?import-only';
            const module = await import(moduleUrl);
            return typeof module.FieldStates === 'function' && document.querySelector('main, input, textarea') === null;
        });
        expect(importedWithoutRoot).toBeTruthy();
    });
}
