package com.magu1436.chronolist.login.Handler;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import com.magu1436.chronolist.login.exception.LoginIdAlreadyExistsException;
import com.magu1436.chronolist.login.exception.LoginIdInvalidCharException;
import com.magu1436.chronolist.login.exception.LoginIdContainsWhitespaceException;
import com.magu1436.chronolist.login.exception.LoginIdTooLongException;
import com.magu1436.chronolist.login.exception.LoginIdTooShortException;
import com.magu1436.chronolist.login.exception.LoginIdUsesReservedWordException;
import com.magu1436.chronolist.login.exception.PasswordMissingRequiredCharTypeException;
import com.magu1436.chronolist.login.exception.PasswordTooLongException;
import com.magu1436.chronolist.login.exception.PasswordTooShortException;
import com.magu1436.chronolist.login.exception.PasswordUsesNonAsciiCharException;
import org.springframework.web.bind.MethodArgumentNotValidException;

/**
 * サインアップ機能の例外ハンドラ
 * 各例外に対応するHTTPステータスとエラーコードを返却する
 */
@ControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(LoginIdAlreadyExistsException.class)
    public ResponseEntity<?> handleLoginIdAlreadyExists() {
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .build();
    }

    @ExceptionHandler(LoginIdContainsWhitespaceException.class)
    public ResponseEntity<?> handleLoginIdContainsWhitespace() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("LOGIN_ID_CONTAINS_WHITESPACE");
    }

    @ExceptionHandler(LoginIdTooLongException.class)
    public ResponseEntity<?> handleLoginIdTooLong() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("LOGIN_ID_TOO_LONG");
    }

    @ExceptionHandler(LoginIdTooShortException.class)
    public ResponseEntity<?> handleLoginIdTooShort() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("LOGIN_ID_TOO_SHORT");
    }

    @ExceptionHandler(LoginIdInvalidCharException.class)
    public ResponseEntity<?> handleLoginIdInvalidChar() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("LOGIN_ID_INVALID_CHARACTER");
    }

    @ExceptionHandler(LoginIdUsesReservedWordException.class)
    public ResponseEntity<?> handleLoginIdUsesReservedWord() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("LOGIN_ID_RESERVED_WORD");
    }

    @ExceptionHandler(PasswordMissingRequiredCharTypeException.class)
    public ResponseEntity<?> handlePasswordMissingRequiredCharType() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("PASSWORD_MISSING_REQUIRED_CHARACTER_TYPE");
    }

    @ExceptionHandler(PasswordTooLongException.class)
    public ResponseEntity<?> handlePasswordTooLong() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("PASSWORD_TOO_LONG");
    }

    @ExceptionHandler(PasswordTooShortException.class)
    public ResponseEntity<?> handlePasswordTooShort(){
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("PASSWORD_TOO_SHORT");
    }

    @ExceptionHandler(PasswordUsesNonAsciiCharException.class)
    public ResponseEntity<?> handlePasswordUsesNonAsciiChar() {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("PASSWORD_NON_ASCII_CHARACTER");
    }
    @ExceptionHandler (MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleMethodArgumentNotValid(){
        return  ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body("FIELD_EMPTY");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleExceptio() {
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .build();
    }
}
