package com.magu1436.chronolist.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import com.magu1436.chronolist.support.ApiIntegrationTest;
import com.magu1436.chronolist.timeblocking.entity.TimeBlock;
import com.magu1436.chronolist.timeblocking.exception.TimeBlockReferenceNotFoundException;
import com.magu1436.chronolist.timeblocking.mapper.TimeBlockMapper;

class ScheduleTimeBlockUpdateRollbackTests extends ApiIntegrationTest {
    @MockitoSpyBean
    TimeBlockMapper mapper;

    @ParameterizedTest
    @ValueSource(strings = {"UPDATE", "DELETE", "CREATE_FROM_ALL_DAY", "CREATE_MISSING"})
    void failureRollsBackScheduleEventAndNewTable(String operation) throws Exception {
        var dated = Map.<String, Object>of("kind", "DATED", "title", "元の予定", "startAt", "2026-11-02T09:00:00",
                "endAt", "2026-11-02T10:00:00", "color", "#123456", "memo", "元のメモ");
        var allDay = Map.<String, Object>of("kind", "ALL_DAY", "title", "終日", "startDate", "2026-11-02",
                "endDate", "2026-11-03", "color", "#654321");
        var result = performJsonAsUser(post("/api/scheduler/register"),
                operation.equals("CREATE_FROM_ALL_DAY") ? allDay : dated)
                .andExpect(status().isCreated()).andReturn();
        int eventId = Integer.parseInt(result.getResponse().getContentAsString());
        if (operation.equals("CREATE_MISSING")) {
            jdbcTemplate.update("DELETE FROM time_blocks");
        } else if (!operation.equals("CREATE_FROM_ALL_DAY")) {
            jdbcTemplate.update("INSERT INTO time_block_tasks (time_block_id,title) SELECT id,'作業' FROM time_blocks");
        }
        List<String> tables = List.of("schedule", "calendar_event", "time_blocks", "time_tables", "time_block_tasks");
        Map<String, List<Map<String, Object>>> before = new LinkedHashMap<>();
        tables.forEach(table -> before.put(table, jdbcTemplate.queryForList("SELECT * FROM " + table + " ORDER BY id")));
        if (operation.equals("UPDATE")) {
            doReturn(0).when(mapper).updateTimeBlock(anyInt(), any(TimeBlock.class));
        } else if (operation.equals("DELETE")) {
            doReturn(0).when(mapper).deleteTimeBlock(anyInt(), anyInt());
        } else {
            doReturn(0).when(mapper).insertTimeBlock(any(TimeBlock.class));
        }
        var body = new LinkedHashMap<>(operation.equals("DELETE") ? allDay : dated);
        body.put("id", eventId);
        body.put("title", "失敗する変更");
        body.put("color", "#abcdef");
        body.put("memo", "変更後のメモ");
        if (!operation.equals("DELETE")) {
            body.put("startAt", "2026-11-05T11:00:00");
            body.put("endAt", "2026-11-05T12:30:00");
        }
        var failure = performJsonAsUser(put("/api/scheduler/update"), body).andReturn();
        assertThat(failure.getResolvedException()).isInstanceOf(TimeBlockReferenceNotFoundException.class);
        tables.forEach(table -> assertThat(jdbcTemplate.queryForList("SELECT * FROM " + table + " ORDER BY id"))
                .as(table).isEqualTo(before.get(table)));
    }
}
