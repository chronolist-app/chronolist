import { EvidenceError } from './evidence-errors.ts';
import type { Page } from '@playwright/test';

/** レイアウトに参加する表示画像を期限内にデコードし、準備完了後の証跡を保存する。 */
export async function captureEvidenceImage(page: Page, path: string, timeout = 15_000): Promise<string> {
    const started = Date.now();
    const state = await page.evaluate(async budget => {
        const images = Array.from(document.images).filter(image => {
            const style = getComputedStyle(image);
            // 未読込ロゴは幅0でも高さを持つため、幅だけでは除外しない。
            return image.getClientRects().length > 0 && style.visibility !== 'hidden' && style.visibility !== 'collapse';
        });
        if (!images.length) return 'ready';
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                Promise.all(images.map(async image => {
                    await image.decode();
                    if (!image.complete || image.naturalWidth === 0) throw new Error();
                })).then(() => 'ready', () => 'decode-failed'),
                new Promise<string>(resolve => { timer = setTimeout(() => resolve('timeout'), budget); }),
            ]);
        } finally { clearTimeout(timer); }
    }, timeout);
    if (state === 'timeout') throw new EvidenceError('image-timeout');
    if (state !== 'ready') throw new EvidenceError('image-decode');
    const remaining = timeout - (Date.now() - started);
    if (remaining <= 0) throw new EvidenceError('image-timeout');
    await page.screenshot({ path, fullPage: true, animations: 'disabled', timeout: remaining });
    return path;
}
