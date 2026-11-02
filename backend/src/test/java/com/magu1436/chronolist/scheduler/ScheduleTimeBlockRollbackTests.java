package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import com.magu1436.chronolist.support.ApiIntegrationTest;
import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;

class ScheduleTimeBlockRollbackTests extends ApiIntegrationTest {
    @MockitoSpyBean
    TimeBlockMapper blockMapper;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void blockFailureRollsBackAllNewRowsAndPreservesExistingTable(boolean existing) throws Exception {
        if (existing) {
            jdbcTemplate.update("INSERT INTO time_tables (user_id, date) VALUES (?, '2026-11-02')", loginUser.getId());
        }
        var tablesBefore = jdbcTemplate.queryForList("SELECT * FROM time_tables");
        doReturn(0).when(blockMapper).insertTimeBlock(any(TimeBlock.class));
        var body = Map.of("kind", "DATED", "title", "予定", "startAt", "2026-11-02T09:15:00",
                "endAt", "2026-11-02T10:45:00", "color", "#123456");
        var result = performJsonAsUser(post("/api/scheduler/register"), body).andReturn();
        assertThat(result.getResolvedException()).isInstanceOf(TimeBlockReferenceNotFoundException.class);
        for (String table : java.util.List.of("schedule", "calendar_event", "time_blocks")) {
            assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class))
                    .as(table).isZero();
        }
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_tables")).isEqualTo(tablesBefore);
    }
}
