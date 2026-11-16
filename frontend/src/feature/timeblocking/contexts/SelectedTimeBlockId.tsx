import { createContext } from "react";

const SelectedTimeBlockId = createContext<{
    selectedTimeBlockId: number | null,
    setSelectedTimeBlockId: ((block: number | null | ((block: number | null) => number | null)) => void)
}>({
    selectedTimeBlockId: null,
    setSelectedTimeBlockId: () => { },
});

export default SelectedTimeBlockId;