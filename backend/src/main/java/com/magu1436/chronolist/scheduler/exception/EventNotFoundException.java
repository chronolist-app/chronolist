package com.magu1436.chronolist.scheduler.exception;

/** 所有する予定が取得できない、または更新・削除件数が期待値を満たさない場合の例外. */
public class EventNotFoundException extends RuntimeException {
    public EventNotFoundException() {
        super("Event was not found");
    }
}
