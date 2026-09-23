package com.magu1436.chronolist.todolist.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.magu1436.chronolist.todolist.entity.ToDoTask;
import com.magu1436.chronolist.todolist.mapper.ToDoMapper;
import com.magu1436.chronolist.todolist.service.ToDoListService;

import lombok.RequiredArgsConstructor;

@Service
@Transactional
@RequiredArgsConstructor
public class ToDoListServiceImpl implements ToDoListService {

    private final ToDoMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<ToDoTask> getAllTasks(int userId) {
        return mapper.getAllTasks(userId);
    }

    @Override
    public Integer registerTask(int userId, ToDoTask task) {
        task.setUserId(userId);
        mapper.insertTask(task);

        return task.getId();
    }

    @Override
    public boolean updateTask(int userId, ToDoTask task) {
        task.setUserId(userId);

        int updatedRows = mapper.updateTask(task);

        return updatedRows == 1;
    }

    @Override
    public boolean updateTaskStatus(
        int userId,
        int taskId,
        boolean isCompleted
    ) {
        int updatedRows = mapper.updateTaskStatus(
            taskId,
            isCompleted,
            userId
        );

        return updatedRows == 1;
    }

    @Override
    public boolean deleteTask(int userId, int taskId) {
        int deletedRows =
            mapper.deleteTask(taskId, userId);

        return deletedRows == 1;
    }

    @Override
    public boolean deleteTasks(
        int userId,
        List<Integer> taskIds
    ) {
        for (Integer taskId : taskIds) {
            int deletedRows =
                mapper.deleteTask(taskId, userId);

            if (deletedRows != 1) {
                return false;
            }
        }

        return true;
    }
}
