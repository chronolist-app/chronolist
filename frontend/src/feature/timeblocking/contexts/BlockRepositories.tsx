import { createContext } from "react";

import type { TimeBlockSource, TemplateBlockSource } from "../types/blockSourceTypes";

/**
 * タイムテーブルやブロック領域内の全てのブロックを管理するコンテキスト
 */
const BlockRepositories = createContext<{
    blocksOnTable: TimeBlockSource[],
    setBlocksOnTable: (blocks: TimeBlockSource[] | ((blocks: TimeBlockSource[]) => TimeBlockSource[])) => void
    blocksAtField: TimeBlockSource[],
    setBlocksAtField: (blocks: TimeBlockSource[] | ((blocks: TimeBlockSource[]) => TimeBlockSource[])) => void,
    templateBlocks: TemplateBlockSource[],
    setTemplateBlocks: (blocks: TemplateBlockSource[] | ((blocks: TemplateBlockSource[]) => TemplateBlockSource[])) => void
}>({
    blocksOnTable: [],
    setBlocksOnTable: () => { return; },
    blocksAtField: [],
    setBlocksAtField: () => { return; },
    templateBlocks: [],
    setTemplateBlocks: () => { return; },
});

export default BlockRepositories;