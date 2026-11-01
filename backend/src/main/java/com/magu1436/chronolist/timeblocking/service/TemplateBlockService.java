package com.magu1436.chronolist.timeblocking.service;

import java.util.List;

import com.magu1436.chronolist.timeblocking.entity.TemplateBlock;

public interface TemplateBlockService {

    List<TemplateBlock> getAllTemplateBlocks(int userId);

    int registerNewTemplateBlock(int userId, TemplateBlock templateBlock);

    boolean updateTemplateBlock(int userId, TemplateBlock templateBlock);

    boolean deleteTemplateBlock(int userId, int id);

}
