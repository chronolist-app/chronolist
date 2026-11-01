import { createContext } from "react";

const SelectedTimeBlockId = createContext<{
    selectedTimeBlockId: string | null,
    setSelectedTimeBlockClientId: ((block: string | null | ((block: string | null) => string | null)) => void)
}>({
    selectedTimeBlockId: null,
    setSelectedTimeBlockClientId: () => { },
});

export default SelectedTimeBlockId;