package com.magu1436.chronolist.todolist;


import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import com.magu1436.chronolist.login.LoginUser;
import com.magu1436.chronolist.todolist.entity.ToDoTask;
import com.magu1436.chronolist.todolist.service.ToDoListService;

import lombok.RequiredArgsConstructor;

/**
 * ToDoListのコントローラークラス
 * @author milk0924
 */
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("api/todolist/")
@Controller
@RequiredArgsConstructor
public class ToDoListController {
    
    /**
     * 使用するサービス
     */
    private final ToDoListService service;

    /**
     * タスクを全取得するAPIの定義.
     * タスクの取得要求に対して, すべてのタスクを取得して返す
     * @return ResponseEntity status.OKと取得したタスク一覧
     * @author milk0924
     */
    @GetMapping("getAll")
    public ResponseEntity<List<ToDoTask>> getall(
        @AuthenticationPrincipal LoginUser loginUser
    ) {
        List<ToDoTask> tasks =
            service.getAllTasks(loginUser.getId());

        return ResponseEntity.ok(tasks);
    }

    /**
     * タスクを登録するAPIの定義.
     * フロントから受け取ったタスクを登録し, 登録したIDを返す.
     * @param task フロントから受け取った登録したいタスク
     * @return status.OK と登録したタスクのID
     * @author milk0924
     */
    @PostMapping("register")
    public ResponseEntity<Integer> register(
        @AuthenticationPrincipal LoginUser loginUser,
        @RequestBody ToDoTask task
    ) {
        Integer id =
            service.registerTask(loginUser.getId(), task);

        return ResponseEntity.ok(id);
    }

    /** 
     * データを更新するAPIの定義.
     * 既存のタスクの内容をフロントから受け取った情報に置き換える.
     * @param task フロントから受け取った、更新したい部分を持つタスク
     * @retutn status.CREATED
     * @author milk0924
     */
    @PutMapping("update")
    public ResponseEntity<Void> update(
        @AuthenticationPrincipal LoginUser loginUser,
        @RequestBody ToDoTask task
    ) {
        boolean updated =
            service.updateTask(loginUser.getId(), task);

        if (!updated) {
            return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .build();
        }

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .build();
    }

    /** 
     * タスク完了状況更新機能のAPI.
     * 指定のタスクの完了状況のみを更新する.
     * @param task フロントから受け取った、完了状況を変更するタスク
     * @return stutus.NO_CONTENT
     * @author milk0924
     */
    @PutMapping("update/status")
    public ResponseEntity<Void> updateStatus(
        @AuthenticationPrincipal LoginUser loginUser,
        @RequestBody ToDoTask task
    ) {
        boolean updated = service.updateTaskStatus(
            loginUser.getId(),
            task.getId(),
            task.isCompleted()
        );

        if (!updated) {
            return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .build();
        }

        return ResponseEntity
            .status(HttpStatus.NO_CONTENT)
            .build();
    }

    /** 
     * タスク削除機能のAPI.
     * フロントから受け取った削除したいタスクを削除する.
     * @param body id(削除したいタスク1つの{@code int})とids(削除したいタスク複数の{@code List<int>})のどちらかを持つマップオブジェクト
     * @return status.NO_CONTENT
     * @author milk0924
     */
    @DeleteMapping("delete")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal LoginUser loginUser,
        @RequestBody Map<String, Object> body
    ) {
        if (body.containsKey("id")) {
            Integer id = (Integer) body.get("id");

            boolean deleted =
                service.deleteTask(loginUser.getId(), id);

            if (!deleted) {
                return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .build();
            }

        } else if (body.containsKey("ids")) {
            List<Integer> ids;

            try {
                ids = (List<Integer>) body.get("ids");
            } catch (ClassCastException e) {
                return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .build();
            }

            if (ids.isEmpty()) {
                return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .build();
            }

            boolean deleted =
                service.deleteTasks(loginUser.getId(), ids);

            if (!deleted) {
                return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .build();
            }

        } else {
            return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .build();
        }

        return ResponseEntity
            .status(HttpStatus.NO_CONTENT)
            .build();
    }


}
