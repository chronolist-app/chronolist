import type { TimeBlockStatus } from "./statics"
import type { Time } from "@/utils/time"

export type TimeBlockTask = {
    id: number,
    timeBlockId: number,
    title: string,
};

export type TimeBlockSource = {
    id: number,
    timeTableId: number | null,
    title: string,
    status: TimeBlockStatus,
    width: number,
    startAt: Time | null,
    tasks: TimeBlockTask[],
    color: string,
    fromTemplateBlockSource?: never,
}

export type TemplateBlockSource = {
    id: number,
    title: string,
    width: number,
    color: string,
}

/** サーバー登録前の入力。永続化されたIDは持たない。 */
export type TimeBlockInput = Omit<TimeBlockSource, "id" | "fromTemplateBlockSource">;
export type TemplateBlockInput = Omit<TemplateBlockSource, "id">;
export type TimeBlockTaskInput = Omit<TimeBlockTask, "id">;

/** テンプレートから生成する未保存ブロックのドラッグ表示。 */
export type TemplateBlockPreview = TimeBlockInput & { fromTemplateBlockSource: TemplateBlockSource; id?: never };

export type DraggableBlock = TimeBlockSource | TemplateBlockPreview;
