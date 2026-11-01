import { useCallback, useContext, type FC } from "react";
import { useDraggable } from "@dnd-kit/core";

import { type TimeBlockSource } from "../types/blockSourceTypes";
import TimeTableConfigure from "../contexts/TimeTableConfigure";
import TimeBlockView from "./TimeBlockView";
import SelectedTimeBlockClientId from "../contexts/SelectedTimeBlockClientId";

type TimeBlockProps = {
    source: TimeBlockSource,
    conlumnIndex?: number,
    maxColumnIndex?: number,
    ref?: React.Ref<HTMLDivElement>,
}

/**
 * タイムブロッキングにおける {@link TimeBlock} を描画するコンポーネント.
 * 
 * {@link TimeBlockSource} を受け取り、それに基づいてタイムブロックを描画する.  
 * このコンポーネントは、{@link useDraggable} を使用して、ドラッグ可能なコンポーネント  
 * として実装されている.  
 * 
 * @param {TimeBlockProps} props
 * @returns {JSX.Element}描画する {@link TimeBlock}
 */
const TimeBlock: FC<TimeBlockProps> = ({source, conlumnIndex, maxColumnIndex, ref}) => {

    const {
        setNodeRef,
        listeners,
        attributes,
        isDragging,
    } = useDraggable({
        id: source.clientId,
        data: { source },
    });

    const {
        setSelectedTimeBlockClientId,
    } = useContext(SelectedTimeBlockClientId);

    const handleDoubleClick = useCallback(() => {
        setSelectedTimeBlockClientId(source.clientId);
        console.log(`selected ${source.clientId}`);
    }, []);

    // refを利用するための処理
    // 受け取ったrefとuseDraggableのrefをマージする
    // 元々refを直接操作してプレビューブロックを表示しようとしたときの名残り
    // 現在は別のロジックでプレビューブロックを実装したため, refをマージせずとも動作する
    // refのロジック自体は今後必要になる可能性もあるため, 念の為残してある
    const mergedRef = useCallback(
        (node: HTMLDivElement | null) => {
            setNodeRef(node);

            if (!ref) return;

            if (typeof ref === "function") {
                ref(node);
            } else {
                ref.current = node;
            }
        }, [setNodeRef, ref]
    );

    const {
        slotHeight,
        slotMinutes,
    } = useContext(TimeTableConfigure);

    // ブロックのy座標を計算する処理
    // ブロックが設置状態なら, 開始時刻を基準にy座標を計算し与える
    let top;
    if (source.status === "PLACED" && source.startAt) {
        top = source.startAt.toMinutes() * (slotHeight / slotMinutes);
    }

    let left;
    if (
        source.status === "PLACED" && 
        conlumnIndex !== undefined &&
        maxColumnIndex !== undefined
    ) {
        left = `${(conlumnIndex / maxColumnIndex) * 100}%`;
    }

    return (
        <TimeBlockView
            source={source}
            ref={mergedRef}
            {...attributes}
            {...listeners}
            sx={{
                width: maxColumnIndex ? `${100 / maxColumnIndex}%` : "100%",
                position: source.status === "PLACED" ? "absolute" : "unset",
                top,
                left,
                opacity: isDragging ? 0.5 : 1,  // ドロップ中は透明
            }}
            onDoubleClick={handleDoubleClick}
        />
    );
};

export default TimeBlock;