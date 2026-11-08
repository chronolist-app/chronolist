import { createContext } from "react";

import type { TimeBlockSource, TemplateBlockSource } from "../types/blockSourceTypes";

/**
 * タイムテーブルやブロック領域内の全てのブロックを管理するコンテキスト
 */
const BlockRepositories = createContext<{
    blocksOnTable: TimeBlockSource[],
    setBlocksOnTable: (blocks: TimeBlockSource[] | ((blocks: TimeBlockSource[]) => TimeBlockSource[])) => void
    previewBlock: TimeBlockSource | null,
    tableRevision: number,
    blocksAtField: TimeBlockSource[],
    setBlocksAtField: (blocks: TimeBlockSource[] | ((blocks: TimeBlockSource[]) => TimeBlockSource[])) => void,
    templateBlocks: TemplateBlockSource[],
    setTemplateBlocks: (blocks: TemplateBlockSource[] | ((blocks: TemplateBlockSource[]) => TemplateBlockSource[])) => void
}>({
    blocksOnTable: [],
    setBlocksOnTable: () => { return; },
    previewBlock: null,
    tableRevision: 0,
    blocksAtField: [],
    setBlocksAtField: () => { return; },
    templateBlocks: [],
    setTemplateBlocks: () => { return; },
});

export default BlockRepositories;
