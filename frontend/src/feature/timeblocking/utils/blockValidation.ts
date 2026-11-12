import type { TimeBlockSource } from "../types/blockSourceTypes";
/** 有限の整数で、1〜1440分の幅かを判定する。 */
export const isValidBlockWidth = (width: number): boolean =>
    Number.isFinite(width) && Number.isInteger(width) && width >= 1 && width <= 1440;
/** 画面入力ではスロット単位の幅を使用する。 */
export const isValidUiBlockWidth = (width: number, slotMinutes: number): boolean =>
    isValidBlockWidth(width) && Number.isInteger(slotMinutes) && slotMinutes > 0 && width % slotMinutes === 0;

/** 保存前に幅と配置時刻を検証し、修正に必要なエラーを返す。 */
export const getBlockValidationError = (block: Pick<TimeBlockSource, "width" | "status" | "startAt">): string | null => {
    if (!isValidBlockWidth(block.width)) return "幅は1〜1440分の整数で入力してください。";
    if (block.status === "PLACED") {
        const start = block.startAt?.toMinutes();
        if (start === undefined || !Number.isInteger(start) || start < 0 || start >= 1440 || start + block.width > 1440)
            return "開始は00:00以降、終了は24:00までにしてください。開始時刻または幅を修正できます。";
    }
    return null;
};
/** 既存の不正データも選択・修正できる高さで表示する。保存値は変更しない。 */
export const getBlockDisplayWidth = (width: number): number => isValidBlockWidth(width) ? width : 15;
