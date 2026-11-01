package com.magu1436.chronolist.login;

import java.util.Collections;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import com.magu1436.chronolist.login.entity.Users;
import com.magu1436.chronolist.login.mapper.LoginMapper;

@Service
@RequiredArgsConstructor
public class LoginUserDatailsServiceImpl implements UserDetailsService{

    private final LoginMapper loginMapper;

    @Override
    public UserDetails loadUserByUsername(String loginId)
            throws UsernameNotFoundException{

        Users authentication = loginMapper.getUsersByLoginId(loginId);

        if (authentication != null){
            return new LoginUser(authentication.getId(),
                                    authentication.getLoginId(),
                                    authentication.getPassword(),
                                    Collections.emptyList());
        } else {
            throw new UsernameNotFoundException(loginId + "→ 指定しているユーザー名は存在しません");
        }
    }
}
