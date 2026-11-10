package com.magu1436.chronolist.timeblocking;

import java.util.LinkedHashMap;
import java.util.Map;

import com.magu1436.chronolist.support.ApiIntegrationTest;

/** タイムブロッキングのテストデータをAPIに依存せず準備する. */
abstract class TimeBlockingApiTest extends ApiIntegrationTest {
    protected static final String BASE = "/api/timeblocking/";

    /** 日付に対応するタイムテーブルを作る. */
    protected int table(String date) {
        jdbcTemplate.update("INSERT INTO time_tables (user_id,date) VALUES (?,?)", loginUser.getId(), date);
        return jdbcTemplate.queryForObject("SELECT id FROM time_tables WHERE user_id=? AND date=?",
                Integer.class, loginUser.getId(), date);
    }

    /** ブロックを作る. */
    protected int block(Integer tableId, String status, Integer scheduleId) {
        jdbcTemplate.update("""
                INSERT INTO time_blocks (user_id,table_id,title,status,schedule_id,width,start_at,color)
                VALUES (?,?,?,?,?,?,?,?)
                """, loginUser.getId(), tableId, "ブロック", status, scheduleId, 60,
                status.equals("HOLD") ? null : "09:30:00", "#ff0000");
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM time_blocks", Integer.class);
    }

    /** ブロックタスクを作る. */
    protected int task(int blockId, String title) {
        jdbcTemplate.update("INSERT INTO time_block_tasks (time_block_id,title) VALUES (?,?)", blockId, title);
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM time_block_tasks", Integer.class);
    }

    /** テンプレートを作る. */
    protected int template() {
        jdbcTemplate.update("INSERT INTO template_blocks (user_id,title,width,color) VALUES (?,?,?,?)",
                loginUser.getId(), "テンプレート", 30, "#00ff00");
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM template_blocks", Integer.class);
    }

    /** 関連付け用の終日予定を作る. */
    protected int schedule() {
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,start_date,end_date,title)
                VALUES (?, 'ALL_DAY', '2026-10-12', '2026-10-12', '予定')
                """, loginUser.getId());
        return jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
    }

    /** ブロックの登録・更新本文を作る. */
    protected Map<String, Object> blockBody(Integer tableId, String status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timeTableId", tableId);
        body.put("title", "変更後のブロック");
        body.put("status", status);
        body.put("width", 90);
        body.put("startAt", status.equals("HOLD") ? null : "15:00:00");
        body.put("color", "#0000ff");
        body.put("relatedSchedule", null);
        return body;
    }
}
