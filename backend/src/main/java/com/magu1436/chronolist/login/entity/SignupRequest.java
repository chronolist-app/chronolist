package com.magu1436.chronolist.login.entity;

import lombok.Getter;
import jakarta.validation.constraints.NotBlank;


@Getter
public class SignupRequest {

    @NotBlank
    private String loginId;

    @NotBlank
    private String password;
}
