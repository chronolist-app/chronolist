package com.magu1436.chronolist.login.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.magu1436.chronolist.login.entity.Users;

@Mapper
public interface LoginMapper {
    // 指定のログインIDをもつユーザー情報を取得する
    Users getUsersByLoginId(String loginId);
    // 受け取ったユーザー情報をDBに登録する
    void insertUser(Users user);
}
