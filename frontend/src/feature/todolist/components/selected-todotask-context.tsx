import { createContext } from "react";


export const SelectedToDoTaskContext = createContext<{ id: number | null, set: ((taskId: number | null) => void) | null }>({ id: null, set: () => null });