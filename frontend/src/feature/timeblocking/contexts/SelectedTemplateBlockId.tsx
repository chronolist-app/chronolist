import { createContext } from "react";

const SelectedTemplateBlockId = createContext<{
    selectedTemplateBlockId: number | null,
    setSelectedTemplateBlockId: ((block: number | null | ((block: number | null) => number | null)) => void)
}>({
    selectedTemplateBlockId: null,
    setSelectedTemplateBlockId: () => { },
});

export default SelectedTemplateBlockId;