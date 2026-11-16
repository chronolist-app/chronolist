import type { RegionLoadStatus } from "../types/regionLoadTypes.ts";

/**
 * 領域の取得を開始し、有効な取得結果だけを反映する。
 * @returns アンマウントや再取得時に古い取得結果の反映を止める関数。
 */
export const loadRegion = <T>(
    load: (isActive: () => boolean) => Promise<T>,
    apply: (value: T) => void,
    setStatus: (status: RegionLoadStatus) => void,
): (() => void) => {
    let active = true;
    setStatus("loading");
    // 同期的な例外も取得失敗として扱う。
    Promise.resolve().then(() => load(() => active)).then(value => {
        if (!active) return;
        apply(value);
        setStatus("success");
    }).catch(() => {
        if (active) setStatus("error");
    });
    return () => { active = false; };
};
