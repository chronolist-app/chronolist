package com.magu1436.chronolist.timeblocking.service.impl;

import com.magu1436.chronolist.timeblocking.entity.TemplateBlock;
import com.magu1436.chronolist.timeblocking.mapper.TemplateBlockMapper;
import com.magu1436.chronolist.timeblocking.service.TemplateBlockService;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class TemplateBlockServiceImpl implements TemplateBlockService {

    private final TemplateBlockMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<TemplateBlock> getAllTemplateBlocks(int userId){
        return mapper.getAllTemplateBlocks(userId);
    }

    @Override 
    public int registerNewTemplateBlock(int userId, TemplateBlock templateBlock){
        templateBlock.setUserId(userId);
        mapper.insertTemplateBlock(templateBlock);

        return templateBlock.getId();
    }

    @Override 
    public boolean updateTemplateBlock(int userId, TemplateBlock templateBlock){
        templateBlock.setUserId(userId);
        int updatedRows = mapper.updateTemplateBlock(templateBlock);

        return updatedRows == 1;
    }

    @Override
    public boolean deleteTemplateBlock(int userId, int id){
        int deleteRows = mapper.deleteTemplateBlock(id, userId);

        return deleteRows == 1;
    }

}
