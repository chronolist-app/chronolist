import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';

const ERROR_MESSAGES = {
    dropTime: 'ブロックを配置できる時刻にドロップしてください。',
    template: 'テンプレートを作成できませんでした。',
    move: 'ブロックを移動できませんでした。',
};

/** 作成ダイアログから HOLD ブロック領域にブロックを追加する。 */
async function createHoldBlock(page: Page, title: string, width?: number) {
    await page.getByRole('button', { name: 'タイムブロックを追加', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('ブロック名', { exact: true }).fill(title);
    if (width !== undefined) {
        // 数値フィールドは fill だと既定値（30）に連結されるため、全選択してから入力する。
        const widthField = dialog.getByLabel('幅', { exact: true });
        await widthField.click();
        await widthField.press('Control+A');
        await widthField.pressSequentially(String(width));
        await expect(widthField).toHaveValue(String(width));
    }
    const registered = page.waitForResponse(response => response.url().endsWith('/api/timeblocking/timeBlock/register'));
    await dialog.getByRole('button', { name: '作成', exact: true }).click();
    expect((await registered).ok(), 'ブロックを作成できる').toBeTruthy();
    await expect(dialog).toHaveCount(0);
    const block = page.getByLabel('HOLDブロック').getByText(title, { exact: true });
    await expect(block).toBeVisible();
    return block;
}

/** dnd-kit の MouseSensor が反応するよう、移動量を確保しつつ段階的にドラッグして離す。 */
async function dragTo(page: Page, source: Locator, target: { x: number; y: number }) {
    const box = (await source.boundingBox())!;
    const start = { x: box.x + 6, y: box.y + 6 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 20, { steps: 5 });
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.mouse.up();
}

/** タイムテーブル（左半分）上の、ビューポート内の座標。 */
function tablePoint(page: Page, y: number) {
    return { x: page.viewportSize()!.width * 0.2, y };
}

/**
 * 共通 Snackbar のエラー通知が右下に出ていることを検証する。
 * enter トランジション完了（位置が右端で安定）まで待つ。旧 MUI Alert が出ていないことも確認する。
 */
async function expectErrorSnackbar(page: Page, message: string) {
    const notice = page.locator('.notistack-MuiContent-error').filter({ hasText: message });
    await expect(notice).toBeVisible();
    const viewport = page.viewportSize()!;
    await expect.poll(async () => {
        const box = await notice.boundingBox();
        return box !== null && box.x + box.width <= viewport.width && box.x + box.width > viewport.width - 40 &&
            box.y + box.height <= viewport.height && box.y + box.height > viewport.height - 40;
    }, { message: '通知が右下に表示される', timeout: 4000 }).toBe(true);
    await expect(page.locator('.MuiAlert-root')).toHaveCount(0);
    await expect(page.locator('.notistack-MuiContent-error')).toHaveCount(1);
}

/** 検証が通った後の証跡として撮影し、レポートにも添付する。 */
async function capture(page: Page, testInfo: TestInfo, name: string) {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, animations: 'disabled' });
    await testInfo.attach(name, { path, contentType: 'image/png' });
}

test.describe('タイムブロックの保存エラーを共通 Snackbar で通知する', () => {
    test.beforeEach(async ({ page, account }) => {
        void account;
        const loaded = page.waitForResponse(response => response.url().includes('/api/timeblocking/timeTable/getByDate/') && response.ok());
        await page.goto('/timeblocking?date=2026-01-15');
        await loaded;
        await expect(page.getByRole('button', { name: 'タイムブロックを追加', exact: true })).toBeVisible();
    });

    test('配置時刻を求められない位置へドロップするとエラー通知が右下に出る', async ({ page }, testInfo) => {
        // 幅1440分のブロックは先頭スロット以外では収まらないため、テーブル先頭から離れた位置が無効になる。
        const block = await createHoldBlock(page, `全日ブロック${Date.now()}`, 1440);
        await dragTo(page, block, tablePoint(page, 400));
        await expectErrorSnackbar(page, ERROR_MESSAGES.dropTime);
        await capture(page, testInfo, 'timeblocking-error-drop-time');
    });

    test('テンプレート作成APIが失敗するとエラー通知が右下に出る', async ({ page }, testInfo) => {
        await page.route('**/api/timeblocking/templateBlock/register', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
        const block = await createHoldBlock(page, `テンプレ元${Date.now()}`);
        const templateArea = page.getByLabel('テンプレートブロック');
        await expect(templateArea).toBeVisible();
        const area = (await templateArea.boundingBox())!;
        await dragTo(page, block, { x: area.x + area.width / 2, y: area.y + area.height / 2 });
        await expectErrorSnackbar(page, ERROR_MESSAGES.template);
        await capture(page, testInfo, 'timeblocking-error-template');
    });

    test('ブロック移動の保存APIが失敗するとエラー通知が右下に出る', async ({ page }, testInfo) => {
        await page.route('**/api/timeblocking/timeBlock/update', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
        const block = await createHoldBlock(page, `移動ブロック${Date.now()}`);
        await dragTo(page, block, tablePoint(page, 400));
        await expectErrorSnackbar(page, ERROR_MESSAGES.move);
        await capture(page, testInfo, 'timeblocking-error-move');
    });
});
