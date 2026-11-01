export const DueKindEnum = {
    NONE: "NONE",
    DATED: "DATED",
    DATETIME: "DATETIME",
}

export type DueKind = (typeof DueKindEnum)[keyof typeof DueKindEnum];

export const PriorityEnum = {
    HIGH: "HIGH",
    MIDDLE: "MIDDLE",
    LOW: "LOW",
} as const;

export type Priority = (typeof PriorityEnum)[keyof typeof PriorityEnum];