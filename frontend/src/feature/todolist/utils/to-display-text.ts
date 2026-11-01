import type { DueKind, Priority } from "@/feature/todolist/types/statics";

/**
 * 優先度を表示するための文字列に変換する。  
 * 現在は日本語にのみ対応。  
 * 
 * TODO: 言語設定に合わせて変更できるようにする
 * 
 * @param priority 内部データ構造の優先度の値
 * @returns 優先度の値を表示するテキストに変換した文字列
 */
export const convertPriorityToDisplayText = ( priority: Priority ) => {
    switch (priority) {
        case "HIGH":
            return "高";
        case "MIDDLE":
            return "中";
        case "LOW":
            return "低";
    };
    throw new Error("unknown priority");
};


/**
 * 期日指定を表示するための文字列に変換する。
 * 
 * TODO: 言語設定に合わせて変更できるようにする
 * 
 * @param dueKind 内部データ構造の期日指定方法
 * @returns 期日指定の値を表示するテキストに変換した文字列
 */
export const convertDueKindToDisplayText = (dueKind: DueKind) => {
    switch (dueKind) {
        case "NONE":
            return "なし";
        case "DATED":
            return "日付";
        case "DATETIME":
            return "日付＋時間";
    };
    throw new Error("unknown dueKind");
};