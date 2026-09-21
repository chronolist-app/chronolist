package com.magu1436.chronolist.login.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.magu1436.chronolist.login.entity.SignupRequest;
import com.magu1436.chronolist.login.service.SignupService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;


@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SignupController {

    private final SignupService signupService;

    /**
     * 新規ユーザーを登録する
     * @param loginId 登録したいログインID
     * @param password 登録したいパスワード
     * @return 正常終了時 200 OK
     * @author milk0924
     */
    @PostMapping("/signup")
    public ResponseEntity<?> register(@Valid  @RequestBody SignupRequest user){
        signupService.register(user.getLoginId(), user.getPassword());
        return ResponseEntity.ok().build();
    }
    
}
