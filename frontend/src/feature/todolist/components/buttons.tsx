import classNames from "classnames";
import type { FC } from "react";

const Buttons: FC<{
    onRegisterButtonClicked: () => void,
    onDeleteButtonClicked: () => void,
}> = ({ onRegisterButtonClicked, onDeleteButtonClicked }) => {
    return (
        <div className={classNames("d-flex", "justify-content-end")}>
            <button type="button" className="btn btn-primary mx-1" onClick={onRegisterButtonClicked}>新規作成</button>
            <button type="button" className="btn btn-danger mx-1" onClick={onDeleteButtonClicked}>一括削除</button>
        </div>
    );
};

export default Buttons;