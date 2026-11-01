package com.magu1436.chronolist.timeblocking.exception;

/**
 * TimeTable がDBから見つからない場合の例外
 */
public class TimeTableNotFoundException extends RuntimeException {
    public TimeTableNotFoundException(String message) {
        super(message);
    }
}