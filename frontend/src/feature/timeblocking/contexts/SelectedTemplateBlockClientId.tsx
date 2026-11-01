import { createContext } from "react";

const SelectedTemplateBlockClientId = createContext<{
    selectedTemplateBlockClientId: string | null,
    setSelectedTemplateBlockClientId: ((block: string | null | ((block: string | null) => string | null)) => void)
}>({
    selectedTemplateBlockClientId: null,
    setSelectedTemplateBlockClientId: () => { },
});

export default SelectedTemplateBlockClientId;