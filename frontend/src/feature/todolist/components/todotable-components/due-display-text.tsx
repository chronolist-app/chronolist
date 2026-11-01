import type { FC } from "react";
import classNames from "classnames";

import type { DueDisplayTextProps } from "@/feature/todolist/types/props";

/**
 * 期限表示用のテキストを描画するコンポーネント。
 * 期限種別に応じて日時、日付、プレースホルダーを出し分ける。
 */
const DueDisplayText: FC<DueDisplayTextProps> = ({
    dueKind,
    dueDate,
    dueTime,
}) => {
    return (
        <div className={classNames("d-flex", "flex-column", "align-items-center")}>
            {dueKind === "NONE" && "--:--"}
            <div>{dueDate}</div>
            <div>{dueTime}</div>
        </div>
    );
};

export default DueDisplayText;
