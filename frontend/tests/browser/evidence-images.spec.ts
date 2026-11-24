import { test, expect } from '@playwright/test';
import { captureEvidenceImage } from '../../e2e/evidence-images';
import { captureCheckpoint, requireCheckpointSuccess } from '../../e2e/evidence';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');

test('幅0の未読込画像も応答とデコードを待ってから撮影する', async ({ page }, testInfo) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('http://images.localhost/delayed.png', async route => {
        await gate;
        await route.fulfill({ contentType: 'image/png', body: pixel });
    });
    await page.setContent('<img src="http://images.localhost/delayed.png" style="height:108px;width:auto">', { waitUntil: 'domcontentloaded' });
    await page.locator('img').evaluate(element => {
        const image = element as HTMLImageElement;
        const decode = image.decode.bind(image);
        image.decode = () => { image.dataset.decodeStarted = 'true'; return decode(); };
    });
    const screenshot = page.screenshot.bind(page);
    page.screenshot = async options => {
        // 待機を削除した実装では、実際の撮影開始前に必ず失敗する。
        expect(await page.locator('img').evaluate(image => ({ complete: (image as HTMLImageElement).complete, width: (image as HTMLImageElement).naturalWidth })))
            .toEqual({ complete: true, width: 1 });
        return screenshot(options);
    };
    let captured = false;
    const capture = captureEvidenceImage(page, testInfo.outputPath('delayed.png')).then(() => { captured = true; });
    void capture.catch(() => {});
    try {
        await expect(page.locator('img')).toHaveAttribute('data-decode-started', 'true');
        await expect(page.locator('img')).toHaveJSProperty('complete', false);
        expect(await page.locator('img').evaluate(image => image.getBoundingClientRect().width)).toBe(0);
        expect(captured).toBe(false);
    } finally { release(); }
    await capture;
    await expect(page.locator('img')).toHaveJSProperty('naturalWidth', 1);
    expect(captured).toBe(true);
});

test('破損画像は取得失敗となり、確認成功を維持して後続操作を止める', async ({ page }, testInfo) => {
    await page.route('http://images.localhost/broken.png', route => route.fulfill({ contentType: 'image/png', body: 'broken' }));
    await page.setContent('<img src="http://images.localhost/broken.png" style="height:108px;width:auto">');
    await expect(captureEvidenceImage(page, testInfo.outputPath('broken-direct.png'))).rejects.toThrow('表示画像のデコードに失敗しました。');
    const result = await captureCheckpoint({ id: 'draft', requirement: '画面', expected: '表示' },
        () => captureEvidenceImage(page, testInfo.outputPath('broken.png')), async () => {});
    expect(result.capture).toBe('failed');
    expect(result.verification).toBe('passed');
    expect(result.failures).toEqual([{ stage: 'capture', code: 'image-decode', message: '表示画像のデコードに失敗しました。' }]);
    let continued = false;
    expect(() => { requireCheckpointSuccess(result); continued = true; }).toThrow('中断');
    expect(continued).toBe(false);
});

test('応答未完了も明示予算で取得処理に戻り、機微をエラーへ出さない', async ({ page }, testInfo) => {
    await page.route('http://images.localhost/pending.png?private=secret', () => {});
    await page.setContent('<img src="http://images.localhost/pending.png?private=secret" style="height:108px;width:auto">', { waitUntil: 'domcontentloaded' });
    await expect(captureEvidenceImage(page, testInfo.outputPath('pending.png'), 100)).rejects.toThrow('表示画像の準備が制限時間内に完了しませんでした。');
});

test('非表示の未応答画像は除外し、画像0枚でも撮影できる', async ({ page }, testInfo) => {
    await page.route('http://images.localhost/hidden.png', () => {});
    await page.setContent('<div style="display:none"><img src="http://images.localhost/hidden.png"></div><img style="visibility:hidden" src="http://images.localhost/hidden.png">', { waitUntil: 'domcontentloaded' });
    await captureEvidenceImage(page, testInfo.outputPath('hidden.png'));
    await page.setContent('<p>画像なし</p>', { waitUntil: 'domcontentloaded' });
    await captureEvidenceImage(page, testInfo.outputPath('empty.png'));
});

test('画面外のlazy画像もfullPage撮影前に取得しloading属性を復元する', async ({ page }, testInfo) => {
    await page.route('http://images.localhost/lazy.png', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await page.setContent('<div style="height:20000px"></div><img loading="lazy" src="http://images.localhost/lazy.png" style="height:108px;width:auto">', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('img')).toHaveJSProperty('complete', false);
    const screenshot = page.screenshot.bind(page);
    page.screenshot = async options => {
        expect(await page.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1);
        return screenshot(options);
    };
    await captureEvidenceImage(page, testInfo.outputPath('lazy.png'));
    await expect(page.locator('img')).toHaveAttribute('loading', 'lazy');
});

test('画像候補のないplaceholderはdecodeせず除外する', async ({ page }, testInfo) => {
    await page.setContent('<img style="height:108px"><img src="" srcset=" " style="height:108px"><picture><source srcset=""><img style="height:108px"></picture>');
    await page.locator('img').evaluateAll(images => images.forEach(image => {
        (image as HTMLImageElement).decode = () => { throw new Error('placeholderをdecodeしない'); };
    }));
    await captureEvidenceImage(page, testInfo.outputPath('placeholder.png'));
    await expect(page.locator('img[loading]')).toHaveCount(0);
});

for (const kind of ['srcset', 'picture'] as const) {
    test(`currentSrcが空でも読込途中の${kind}候補を待つ`, async ({ page }, testInfo) => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        await page.route('http://images.localhost/candidate.png', async route => { await gate; await route.fulfill({ contentType: 'image/png', body: pixel }); });
        const image = '<img style="height:108px"' + (kind === 'srcset' ? ' srcset="http://images.localhost/candidate.png 1x">' : '>');
        await page.setContent(kind === 'picture' ? `<picture><source srcset="http://images.localhost/candidate.png 1x">${image}</picture>` : image, { waitUntil: 'domcontentloaded' });
        await page.locator('img').evaluate(element => {
            const image = element as HTMLImageElement;
            const decode = image.decode.bind(image);
            image.decode = () => { image.dataset.decodeStarted = 'true'; return decode(); };
        });
        let captured = false;
        const capture = captureEvidenceImage(page, testInfo.outputPath(`${kind}.png`)).then(() => { captured = true; });
        void capture.catch(() => {});
        try {
            await expect(page.locator('img')).toHaveAttribute('data-decode-started', 'true');
            expect(captured).toBe(false);
        } finally { release(); }
        await capture;
        await expect(page.locator('img')).toHaveJSProperty('naturalWidth', 1);
        await expect(page.locator('img')).not.toHaveAttribute('loading');
    });
}

for (const failure of ['broken', 'timeout'] as const) {
    test(`${failure}でもlazy属性を復元する`, async ({ page }, testInfo) => {
        await page.route('http://images.localhost/failure.png', failure === 'broken'
            ? route => route.fulfill({ contentType: 'image/png', body: 'broken' }) : () => {});
        await page.setContent('<div style="height:20000px"></div><img loading="lazy" src="http://images.localhost/failure.png" style="height:108px;width:auto">', { waitUntil: 'domcontentloaded' });
        await expect(captureEvidenceImage(page, testInfo.outputPath(`${failure}-lazy.png`), failure === 'timeout' ? 100 : undefined)).rejects.toThrow(failure === 'broken' ? 'image-decode' : 'image-timeout');
        await expect(page.locator('img')).toHaveAttribute('loading', 'lazy');
    });
}
