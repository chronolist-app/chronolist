import CHButton from "@/components/CHButton";
import classNames from "classnames";
import type { FC } from "react";

/** タスクの作成と一括削除の操作を表示する。 */
const Buttons: FC<{
    onRegisterButtonClicked: () => void,
    onDeleteButtonClicked: () => void,
}> = ({ onRegisterButtonClicked, onDeleteButtonClicked }) => {
    return (
        <div className={classNames("d-flex", "justify-content-end", "gap-2")}>
            <CHButton onClick={onRegisterButtonClicked} label="新規作成" />
            <CHButton variant="danger" onClick={onDeleteButtonClicked} label="一括削除" />
        </div>
    );
};

export default Buttons;
