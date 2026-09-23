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
import com.magu1436.chronolist.todolist.mapper.ToDoMapper;

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
     * 使うマッパー
     */
    private final ToDoMapper mapper;

    /**
     * タスクを全取得するAPIの定義.
     * タスクの取得要求に対して, すべてのタスクを取得して返す
     * @return ResponseEntity status.OKと取得したタスク一覧
     * @author milk0924
     */
    @GetMapping("getAll")
    public ResponseEntity<List<ToDoTask>> getall(@AuthenticationPrincipal LoginUser loginUser){
        List<ToDoTask> tasks = mapper.getAllTasks(loginUser.getId());
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
    public ResponseEntity<Integer> register(@AuthenticationPrincipal LoginUser loginUser, @RequestBody ToDoTask task){
        task.setUserId(loginUser.getId());
        mapper.insertTask(task);
        Integer id = task.getId();
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
        @AuthenticationPrincipal LoginUser loginuser,
        @RequestBody ToDoTask task){

        /** 
         * IDが存在しない場合に404を返す 
         */
        if(checkTaskExisting(task.getId(), loginuser.getId())){

        /** 
         * タスクの更新を返す 
         */
        mapper.updateTask(task);
        return ResponseEntity.status(HttpStatus.CREATED).build();
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
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
        @AuthenticationPrincipal LoginUser loginuser,
        @RequestBody ToDoTask task) {

        ToDoTask existingTask = mapper.getTaskById(task.getId(), loginuser.getId());

        /**
         *  IDが存在しない場合に404を返す
         */
        if(existingTask != null){

            /**
             *  受け取ったjsonのboolを入力 
             */
            existingTask.setCompleted(task.isCompleted());
            /** 
             * データベースの更新 
             */
            mapper.updateTask(existingTask);
            
            return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

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
        @AuthenticationPrincipal LoginUser loginuser, 
        /** 
         * Listで受け取ることができる形 
         */
        @RequestBody Map<String, Object> body
    ){
        if(body.containsKey("id")){
            Integer id = (Integer)body.get("id");

            if(checkTaskExisting(id, loginuser.getId())){
                mapper.deleteTask(id);
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            
        } else if(body.containsKey("ids")){
            /** 
             * 値を受け取ったときの動き 
             */
            List<Integer> ids;
            /** 
             * 変な方に変換しないためのチェック 
             */
            try {
                ids = (List<Integer>)body.get("ids");
            } catch (ClassCastException e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            /** 
             * 渡されたidsのリストが空だった時 
             */
            if(ids.isEmpty()){
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            /** 
             * 中身の値一つ一つで削除機能を行う 
             */
            for(Integer eachId : ids){
                if(checkTaskExisting(eachId, loginuser.getId())){
                    mapper.deleteTask(eachId);
                } else{
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
                }
            }
        /** 
         * なんも投げられてないときまたはids以外が投げられたときの処理 
         */
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }    
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();

        // idとidsの共通化（id->idsのリスト化）をして共通処理

    }

    /**
     * タスクの存在を確かめるメソッド
     * @param id
     * @return boolean
     */
    private boolean checkTaskExisting(int id, int userId){
        ToDoTask existingTasksId = mapper.getTaskById(id, userId);
        return existingTasksId != null;
    }

}
