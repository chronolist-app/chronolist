import { Time } from "@/utils/time";
import { createContext } from "react";

const TimeTableConfigure = createContext<{
    timeTableId: number,
    gridSize: number,
    tableHeight: number,
    tableWidth: number | string,
    startTime: Time,
    slotMinutes: number,
    slotHeight: number,
    setTimeTableId: (timeTableId: number) => void
}>({
    timeTableId: 0,
    gridSize: 1,
    tableHeight: 2000,
    tableWidth: "100%",
    startTime: new Time(0, 0),
    slotMinutes: 30,
    slotHeight: 2000 * 30 / (24 * 60),
    setTimeTableId: () => {},
});

export default TimeTableConfigure;