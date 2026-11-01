import { useCallback, useContext, useEffect, useState } from "react";
import classNames from "classnames";

import { SelectedToDoTaskContext } from "../selected-todotask-context";
import AllToDoTasksContext from "../all-todotasks-context";
import CommonTaskDetailDisplayClassNames from "./common-class-names";


// メモ要素の固有クラス名
const TASK_DETAIL_DISPLAY_MEMO_CLASS_TAG = "task-detail-display-memo";
// メモ要素が持つクラス群
const TASK_DETAIL_DISPLAY_MEMO_CLASS_NAMES = classNames(
    TASK_DETAIL_DISPLAY_MEMO_CLASS_TAG,
    CommonTaskDetailDisplayClassNames,
    "d-flex", "flex-column",
);

const Memo = () => {
    const { id: selectedTaskId } = useContext(SelectedToDoTaskContext);
    const { tasks, updateTask } = useContext(AllToDoTasksContext);
    const selectedTask = tasks.find(task => task.id === selectedTaskId);

    // テキストエリアの中身を保持するステート
    const [ memo, setMemo ] = useState<string>("");
    // 編集可能かどうかを保持するステート
    const [ readOnly, setReadOnly ] = useState<boolean>(true);

    // 選択タスクが切り替わった際にテキストエリアの文字列と編集可能状態を初期化
    useEffect(() => {
        setReadOnly(!selectedTask);

        if (!selectedTask) return;
        setMemo(selectedTask.memo || "");
    }, [selectedTask]);

    /**
     * フォーカスアウト時にメモの保存を行うイベントハンドラ。  
     * 元々のメモと変更後のメモが同一の場合は保存しない。  
     * 
     * @param event フォーカスアウト時に発火するイベント
     */
    const handleBlur = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
        if (!selectedTask) return;

        const newMemo = event.target.value.trim();
        const oldMemo = selectedTask.memo || "";
        if (newMemo === oldMemo) return;

        setMemo(newMemo);
        updateTask({...selectedTask, memo: newMemo}, true);
    }, [selectedTask]);

    const formId = `memo-form-${selectedTaskId}`;

    return (
        <div className={TASK_DETAIL_DISPLAY_MEMO_CLASS_NAMES}>
            <label htmlFor={formId}>メモ</label>
            <textarea 
                id={formId}
                value={memo}
                onChange={(e) => {setMemo(e.target.value)}}
                onBlur={handleBlur}
                placeholder="メモを入力..."
                readOnly={readOnly}
            />
        </div>
    )
}

export default Memo;