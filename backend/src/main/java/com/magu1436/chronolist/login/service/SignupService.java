package com.magu1436.chronolist.login.service;

public interface SignupService {
    /**
     * IDのバリデーションチェックを行う
     * @param loginId バリデーションチェックを行うフロントエンドから送られてきたID
     * @author milk0924 
     */
    void validateLoginId(String loginId);

    /**
     * IDがすでにDBに登録されているかを確認する
     * @param loginId 重複を確認するフロントエンドから送られてきたID
     * @author milk0924
     */
    void checkLoginIdDuplicate(String loginId);

    /**
     * パスワードのバリデーションチェックを行う
     * @param password バリデーションチェックを行うフロントエンドから送られてきたID
     * @author milk0924
     */
    void validatePassword(String password);

    /**
     * パスワードをハッシュ化し、データベースにログインIDとパスワードを登録する
     * @param loginId
     * @param passWord
     */
    void register(String loginId, String passWord);

} 