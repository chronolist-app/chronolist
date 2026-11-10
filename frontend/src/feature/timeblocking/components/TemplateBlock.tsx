import { useCallback, useContext, type FC } from "react";
import { useDraggable } from "@dnd-kit/core";

import type { TemplateBlockSource, TimeBlockSource } from "../types/blockSourceTypes"
import TimeBlockView from "./TimeBlockView";
import SelectedTemplateBlockClientId from "../contexts/SelectedTemplateBlockClientId";


type TemplateBlockProps = {
    source: TemplateBlockSource,
};

const TemplateBlock: FC<TemplateBlockProps> = ({source}) => {

    const blockSource: TimeBlockSource = {
        ...source,
        status: "HOLD",
        relatedSchedle: null,
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
        id: source.clientId,
        data: { source: blockSource },
    });

    const {
        setSelectedTemplateBlockClientId
    } = useContext(SelectedTemplateBlockClientId);

    const handleDoubleClick = useCallback(() => {
        setSelectedTemplateBlockClientId(source.clientId);
        console.log(`selected ${source.clientId}`);
    }, []);

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