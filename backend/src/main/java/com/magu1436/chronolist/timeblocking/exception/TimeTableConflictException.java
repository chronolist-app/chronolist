package com.magu1436.chronolist.timeblocking.exception;

/**
 * TimeTable が重複している場合の例外
 */
public class TimeTableConflictException extends RuntimeException {
    public TimeTableConflictException(String message) {
        super(message);
    }
}
