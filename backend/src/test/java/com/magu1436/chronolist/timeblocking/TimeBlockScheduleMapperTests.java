package com.magu1436.chronolist.timeblocking;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.magu1436.chronolist.support.ApiIntegrationTest;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;

class TimeBlockScheduleMapperTests extends ApiIntegrationTest {
    @Autowired
    TimeBlockMapper mapper;

    @Test
    void findsLinkedBlockOnlyWhenBothOwnersMatch() {
        jdbcTemplate.update("""
                INSERT INTO schedule (user_id,kind,title,start_at,end_at)
                VALUES (?, 'DATED', '予定', '2026-11-02 09:00:00', '2026-11-02 10:00:00')
                """, loginUser.getId());
        int scheduleId = jdbcTemplate.queryForObject("SELECT MAX(id) FROM schedule", Integer.class);
        jdbcTemplate.update("""
                INSERT INTO time_blocks (user_id,title,status,schedule_id,width,start_at,color)
                VALUES (?, 'ブロック', 'HOLD', ?, 60, '09:00:00', '#123456')
                """, loginUser.getId(), scheduleId);
        int blockId = jdbcTemplate.queryForObject("SELECT MAX(id) FROM time_blocks", Integer.class);
        var block = mapper.getTimeBlockByScheduleId(loginUser.getId(), scheduleId);
        assertThat(block.getId()).isEqualTo(blockId);
        assertThat(block.getTitle()).isEqualTo("ブロック");
        assertThat(block.getColor()).isEqualTo("#123456");
        assertThat(block.getWidth()).isEqualTo(60);
        assertThat(block.getRelatedSchedule().getId()).isEqualTo(scheduleId);
        assertThat(mapper.getTimeBlockByScheduleId(loginUser.getId(), -1)).isNull();

        jdbcTemplate.update("INSERT INTO users (login_id,password,role) VALUES ('other','unused','GENERAL')");
        int other = jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id='other'", Integer.class);
        assertThat(mapper.getTimeBlockByScheduleId(other, scheduleId)).isNull();
        jdbcTemplate.update("UPDATE time_blocks SET user_id=? WHERE id=?", other, blockId);
        assertThat(mapper.getTimeBlockByScheduleId(loginUser.getId(), scheduleId)).isNull();
        assertThat(mapper.getTimeBlockByScheduleId(other, scheduleId)).isNull();
    }
}
