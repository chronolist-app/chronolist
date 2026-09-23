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
        if (!checkTaskExisting(task.getId())
                || !checkTaskOwner(task.getId(), userId)) {
            return false;
        }

        mapper.updateTask(task);
        return true;
    }

    @Override
    public boolean updateTaskStatus(
            int userId,
            int taskId,
            boolean isCompleted
    ) {
        ToDoTask existingTask = mapper.getTaskById(taskId);

        if (existingTask == null
                || !checkTaskOwner(taskId, userId)) {
            return false;
        }

        existingTask.setCompleted(isCompleted);
        mapper.updateTask(existingTask);

        return true;
    }
    @Override
    public boolean deleteTask(int userId, int taskId) {
        if (!checkTaskExisting(taskId)
                || !checkTaskOwner(taskId, userId)) {
            return false;
        }

        mapper.deleteTask(taskId);
        return true;
    }
    @Override
    public boolean deleteTasks(int userId, List<Integer> taskIds) {
        for (Integer taskId : taskIds) {
            if (!checkTaskExisting(taskId)
                    || !checkTaskOwner(taskId, userId)) {
                return false;
            }
        }

        for (Integer taskId : taskIds) {
            mapper.deleteTask(taskId);
        }

        return true;
    }

    private boolean checkTaskExisting(int taskId) {
        return mapper.getTaskById(taskId) != null;
    }

    private boolean checkTaskOwner(int taskId, int loginUserId) {
        Integer ownerUserId = mapper.getUserIdByTaskId(taskId);

        return ownerUserId != null
            && ownerUserId == loginUserId;
    }
}