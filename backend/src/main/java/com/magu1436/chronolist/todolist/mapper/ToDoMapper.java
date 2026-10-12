package com.magu1436.chronolist.todolist.mapper;

import java.time.LocalDate;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.magu1436.chronolist.todolist.entity.ToDoTask;

@Mapper
public interface ToDoMapper {
    /** 指定のユーザーIDをもつToDoTaskを全件取得 */
    List<ToDoTask> getAllTasks(int userId);
    /** ユーザーIDとpriorityを元にToDoTaskを取得 */
    List<ToDoTask> getTasksByPriority(@Param("userId") int userId, @Param("priority") String priority);
    /** ユーザーIDと期日を元にToDoTaskを取得 */
    List<ToDoTask> getTasksByDueDate(
        @Param("userId") int userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    /** 指定のユーザーIDをもち未完了のToDoTaskを取得 */
    List<ToDoTask> getTasksNotCompleted(int userId);
    /** タスクの新規登録 */
    int insertTask(ToDoTask todotask);
    /** 指定したタスクの更新 */
    int updateTask(ToDoTask todotask);

    int updateTaskStatus(
        @Param("id") int id,
        @Param("isCompleted") boolean isCompleted,
        @Param("userId") int userId
    );
    /** idを元にタスクを削除 */
    int deleteTask(
        @Param("id") int id,
        @Param("userId") int userId
    );
}
