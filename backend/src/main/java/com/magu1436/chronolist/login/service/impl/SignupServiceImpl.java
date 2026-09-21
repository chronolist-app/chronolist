package com.magu1436.chronolist.login.service.impl;


import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.magu1436.chronolist.login.ReservedWord;
import com.magu1436.chronolist.login.entity.Role;
import com.magu1436.chronolist.login.entity.Users;
import com.magu1436.chronolist.login.exception.LoginIdAlreadyExistsException;
import com.magu1436.chronolist.login.exception.LoginIdContainsWhitespaceException;
import com.magu1436.chronolist.login.exception.LoginIdInvalidCharException;
import com.magu1436.chronolist.login.exception.LoginIdTooLongException;
import com.magu1436.chronolist.login.exception.LoginIdTooShortException;
import com.magu1436.chronolist.login.exception.LoginIdUsesReservedWordException;
import com.magu1436.chronolist.login.exception.PasswordMissingRequiredCharTypeException;
import com.magu1436.chronolist.login.exception.PasswordTooLongException;
import com.magu1436.chronolist.login.exception.PasswordTooShortException;
import com.magu1436.chronolist.login.exception.PasswordUsesNonAsciiCharException;
import com.magu1436.chronolist.login.mapper.LoginMapper;
import com.magu1436.chronolist.login.service.SignupService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SignupServiceImpl implements SignupService{

    private final LoginMapper loginMapper;
    private final PasswordEncoder passwordEncoder;
    /**
     * IDのバリデーションチェックを行う
     * @param loginId バリデーションチェックを行うフロントエンドから送られてきたID
     * @throws LoginIdTooShortException IDが4文字以下の場合
     * @throws LoginIdTooLongException IDが26文字以上の場合
     * @throws LoginIdInvalidCharException 半角英数字以外が使われている場合
     * @throws LoginIdContainsWhitespaceException IDに空白が含まれる場合
     * @throws LoginIdUsesReservedWordException IDに予約語が含まれる場合
     * @author milk0924 
     */
    @Override
    public void validateLoginId(String loginId){
        if (loginId.length() <= 4 ){
            throw new LoginIdTooShortException();
        }
        if (loginId.length() >= 26){
            throw new LoginIdTooLongException();
        }
        if (loginId.contains(" ")){
            throw new LoginIdContainsWhitespaceException();
        }
        if (!loginId.matches("^[a-z0-9]+$")){
            throw new LoginIdInvalidCharException();
        }
        if (ReservedWord.contains(loginId)){
            throw new LoginIdUsesReservedWordException();
        }
    }

    /**
     * IDがすでにDBに登録されているかを確認する
     * @param loginId 重複を確認するフロントエンドから送られてきたID
     * @throws LoginIdAlreadyExistsException IDがすでにデータベースに登録されている場合
     * @author milk0924
     */
    @Override
    public void checkLoginIdDuplicate(String loginId){
        Users user = loginMapper.getUsersByLoginId(loginId);
        if (user != null){
            throw new LoginIdAlreadyExistsException();
            }
        }
        

    /**
     * パスワードのバリデーションチェックを行う
     * @param password バリデーションチェックを行うフロントエンドから送られてきたID
     * @throws PasswordMissingRequiredCharTypeException パスワードに英数字どちらかもしくはどちらも含まれていない場合
     * @throws PasswordTooLongException パスワードが64文字以上の場合
     * @throws PasswordTooShortException パスワードが7文字以下の場合
     * @throws PasswordUsesNonAsciiCharException パスワードが指定種類以外の文字を使っている場合
     * @author milk0924
     */
    @Override
    public void validatePassword(String password){
        if (password.length() <= 7){
            throw new PasswordTooShortException();
        }
        if (password.length() >=64){
            throw new PasswordTooLongException();
        }
        if (!password.matches("^[\\x20-\\x7E]+$")){
            throw new PasswordUsesNonAsciiCharException();
        }
        if (!password.matches(".*[a-zA-Z].*")){
            throw new PasswordMissingRequiredCharTypeException();
        }
        if (!password.matches(".*[0-9].*")){
            throw new PasswordMissingRequiredCharTypeException();
        }
    }

    /**
     * パスワードをハッシュ化し、ログインIDとパスワードをデータベースに登録する
     * @param loginID 登録するID
     * @param password 登録するパスワード
     * @author milk0924
     */
    @Override
    public void register(String loginId, String password){
        // 前処理
        String trimed_loginId = loginId.trim().toLowerCase();

        // バリデーションチェック
        validateLoginId(trimed_loginId);
        checkLoginIdDuplicate(trimed_loginId);
        validatePassword(password);

        // ハッシュ化→DB登録
        String hashedPassword =  passwordEncoder.encode(password);
        Users register_Users = new Users();
        register_Users.setLoginId(trimed_loginId);
        register_Users.setPassword(hashedPassword);
        register_Users.setRole(Role.GENERAL);
        loginMapper.insertUser(register_Users);
    }
}
