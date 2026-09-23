package com.magu1436.chronolist.todolist.service;

import java.util.List;

import com.magu1436.chronolist.todolist.entity.ToDoTask;

public interface ToDoListService {

    List<ToDoTask> getAllTasks(int userId);

    Integer registerTask(int userId, ToDoTask task);

    boolean updateTask(int userId, ToDoTask task);

    boolean updateTaskStatus(
        int userId,
        int taskId,
        boolean isCompleted
    );

    boolean deleteTask(int userId, int taskId);

    boolean deleteTasks(int userId, List<Integer> taskIds);
}
