import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';

// 通知は notistack の SnackbarContent（role="alert"）として描画される。
const alerts = (page: Page) => page.getByRole('alert');

/**
 * 時計を進め、その結果の React 更新で新たに登録されたタイマー（exit トランジション等）も消化する。
 * fake clock の runFor はタイマー発火中の再描画で登録される後続タイマーを同じ呼び出しでは進めないため、
 * 実時間の短い待機を挟んで追加で進める（合計で約 1 秒超の時間が余分に経過する）。
 */
async function elapse(page: Page, ms: number) {
    await page.clock.runFor(ms);
    for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(50);
        await page.clock.runFor(300);
    }
}

/** 通知の表示と、mount 時の autoHide タイマー登録（useEffect）を待つ。 */
async function waitForShown(page: Page, count = 1) {
    await expect(alerts(page)).toHaveCount(count);
    await expect(alerts(page).first()).toBeVisible();
    await page.waitForTimeout(100);
}

/** 検証が通った後の証跡として撮影し、レポートにも添付する。 */
async function capture(page: Page, testInfo: TestInfo, name: string) {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, animations: 'disabled' });
    await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** 時計を固定してから確認ページを開く。時間経過は page.clock.runFor で進める。 */
async function openSnackbarPage(page: Page) {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00') });
    await page.goto('/test/snackbar');
    await expect(page.getByRole('heading', { name: 'Snackbar', exact: true })).toBeVisible();
    await page.clock.pauseAt(new Date('2026-01-01T00:00:10'));
}

test('通知は画面の右下に表示される', async ({ page }) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: '通常', exact: true }).click();
    await waitForShown(page);
    // スライドインのトランジション（enter）を完了させてから位置を測る。
    await elapse(page, 1000);
    const box = await alerts(page).first().boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeGreaterThan(viewport.width - 40);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 40);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
});

test('通常・成功・情報・警告・エラーの種別を表示できる', async ({ page }, testInfo) => {
    await openSnackbarPage(page);
    for (const [name, variant] of [['通常', 'default'], ['成功', 'success'], ['情報', 'info'], ['警告', 'warning'], ['エラー', 'error']]) {
        await page.getByRole('button', { name, exact: true }).click();
        await expect(page.locator(`.notistack-MuiContent-${variant}`).filter({ hasText: `${name}の通知` })).toBeVisible();
    }
    await expect(alerts(page)).toHaveCount(5);
    // enter トランジションを完了させてから、5種別が右下に積まれた状態を撮影する。
    await elapse(page, 1000);
    await expect(alerts(page)).toHaveCount(5);
    await capture(page, testInfo, 'snackbar-variants-stacked');
});

test('6件連続で追加しても同時表示は最大5件で、最古が消えて最新が表示される', async ({ page }) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: '6件連続追加', exact: true }).click();
    // notistack の標準動作により、上限超過時は最古の通知を押し出して新しい通知を表示する。
    await elapse(page, 1000);
    await expect(alerts(page)).toHaveCount(5);
    await expect(page.getByText('連続通知 6', { exact: true })).toBeVisible();
    await expect(page.getByText('連続通知 1', { exact: true })).toHaveCount(0);
    await expect(page.getByText('連続通知 2', { exact: true })).toBeVisible();
});

test('同一メッセージは重複して表示しない', async ({ page }) => {
    await openSnackbarPage(page);
    const button = page.getByRole('button', { name: '同一メッセージ', exact: true });
    await button.click();
    await button.click();
    await button.click();
    await expect(page.getByText('同一メッセージの通知', { exact: true })).toHaveCount(1);
    // 消えた後は再び表示できる。
    await elapse(page, 6000);
    await expect(alerts(page)).toHaveCount(0);
    await button.click();
    await expect(page.getByText('同一メッセージの通知', { exact: true })).toHaveCount(1);
});

test('通常通知は5秒で自動消去される', async ({ page }) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: '通常', exact: true }).click();
    await waitForShown(page);
    // notistack の autoHide タイマーは Snackbar の mount 時（open の useEffect、enter 完了待ちではない）に
    // 5000ms で始まり、満了で exit トランジションに入る。境界の前後で表示と消去を確認する。
    await page.clock.runFor(4900);
    await expect(alerts(page)).toHaveCount(1);
    await elapse(page, 1000);
    await expect(alerts(page)).toHaveCount(0);
});

test('アクション付き通知は10秒で自動消去され、アクション実行は呼び出し元の処理になる', async ({ page }) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: 'アクション付き', exact: true }).click();
    const alert = alerts(page);
    await expect(alert.getByRole('button', { name: '実行', exact: true })).toBeVisible();
    // アクション付きでも×ボタンが残る。
    await expect(alert.getByRole('button', { name: '閉じる', exact: true })).toBeVisible();

    await page.waitForTimeout(100);
    // autoHide は mount 時に 10000ms で始まる。通常通知（5 秒）より長く、10 秒の境界前後で確認する。
    await page.clock.runFor(5500);
    await expect(alert).toHaveCount(1);
    await page.clock.runFor(4400);
    await expect(alert).toHaveCount(1);
    await elapse(page, 1000);
    await expect(alert).toHaveCount(0);
});

test('アクションをクリックすると呼び出し元の処理が実行される', async ({ page }) => {
    await openSnackbarPage(page);
    await expect(page.getByTestId('action-count')).toHaveText('アクション実行回数: 0');
    await page.getByRole('button', { name: 'アクション付き', exact: true }).click();
    await alerts(page).getByRole('button', { name: '実行', exact: true }).click();
    await expect(page.getByTestId('action-count')).toHaveText('アクション実行回数: 1');
});

test('×ボタンで手動消去できる', async ({ page }) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: '通常', exact: true }).click();
    await alerts(page).getByRole('button', { name: '閉じる', exact: true }).click();
    await elapse(page, 1000);
    await expect(alerts(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'アクション付き', exact: true }).click();
    await alerts(page).getByRole('button', { name: '閉じる', exact: true }).click();
    await elapse(page, 1000);
    await expect(alerts(page)).toHaveCount(0);
});

test('アクション付き通知は実行ボタンと×ボタンを並べて表示する', async ({ page }, testInfo) => {
    await openSnackbarPage(page);
    await page.getByRole('button', { name: 'アクション付き', exact: true }).click();
    await waitForShown(page);
    await elapse(page, 1000);
    const alert = alerts(page);
    await expect(alert.getByRole('button', { name: '実行', exact: true })).toBeVisible();
    await expect(alert.getByRole('button', { name: '閉じる', exact: true })).toBeVisible();
    await capture(page, testInfo, 'snackbar-action');
});
