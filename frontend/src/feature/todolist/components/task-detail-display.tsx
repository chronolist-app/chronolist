import classNames from "classnames"

import Title from "./task-detail-display-components/title"
import IsCompleted from "./task-detail-display-components/is-completed"
import Priority from "./task-detail-display-components/priority"
import Due from "./task-detail-display-components/due"
import Memo from "./task-detail-display-components/memo"
import CommonTaskDetailDisplayClassNames from "./task-detail-display-components/common-class-names"


const TASK_DETAIL_DISPLAY_ID = "task-detail-display"
const TASK_DETAIL_DISPLAY_CLASS_NAMES = classNames(
    "flex-fill", "border", "border-dark",
    "d-flex", "flex-column", "align-items-center", "align-items-stretch",
)

const TaskDetailDisplay = () => {
    return (
        <div id={TASK_DETAIL_DISPLAY_ID} className={TASK_DETAIL_DISPLAY_CLASS_NAMES}>
            <Title />
            <div className={classNames(CommonTaskDetailDisplayClassNames, "d-flex", "justify-content-evenly")}>
                <IsCompleted />
                <Priority />
            </div>
            <Due />
            <Memo />
        </div>
    )
}

export default TaskDetailDisplay;