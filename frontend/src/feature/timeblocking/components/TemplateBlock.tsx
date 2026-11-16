import { useCallback, useContext, type FC } from "react";
import { useDraggable } from "@dnd-kit/core";

import type { TemplateBlockSource, TemplateBlockPreview } from "../types/blockSourceTypes"
import TimeBlockView from "./TimeBlockView";
import SelectedTemplateBlockId from "../contexts/SelectedTemplateBlockId";


type TemplateBlockProps = {
    source: TemplateBlockSource,
};

const TemplateBlock: FC<TemplateBlockProps> = ({source}) => {

    const blockSource: TemplateBlockPreview = {
        title: source.title,
        width: source.width,
        color: source.color,
        status: "HOLD",
        startAt: null,
        tasks: [],
        timeTableId: null,
        fromTemplateBlockSource: source,
    }
    
    const {
        setNodeRef,
        attributes,
        listeners,
    } = useDraggable({
        id: `template-${source.id}`,
        data: { source: blockSource },
    });

    const {
        setSelectedTemplateBlockId
    } = useContext(SelectedTemplateBlockId);

    const handleDoubleClick = useCallback(() => {
        setSelectedTemplateBlockId(source.id);
        console.log(`selected ${source.id}`);
    }, [setSelectedTemplateBlockId, source.id]);

    return (
        <TimeBlockView
            source={blockSource}
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onDoubleClick={handleDoubleClick}
        />
    )
};

export default TemplateBlock;