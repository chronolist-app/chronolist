package com.magu1436.chronolist.timeblocking;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.util.Map;
import org.junit.jupiter.api.Test;
/** 幅と日付境界を検証し、拒否時の保存値を保持する。 */
class BlockBoundaryApiTests extends TimeBlockingApiTest {
    /** 通常・テンプレートの登録更新で欠落・型不正・範囲外を拒否する。 */
    @Test void invalidWidthsDoNotWrite() throws Exception {
        int block = block(null, "HOLD");
        int template = template();
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        var templates = jdbcTemplate.queryForList("SELECT * FROM template_blocks");
        for (String value : new String[]{"0", "-1", "0.5", "1441", "null", "\"60\"", "1e2", "2147483648"}) {
            for (String kind : new String[]{"timeBlock", "templateBlock"}) {
                for (String action : new String[]{"register", "update"}) {
                    var body = objectMapper.createObjectNode();
                    body.put("id", kind.equals("timeBlock") ? block : template);
                    body.put("status", "HOLD"); body.put("title", "変更"); body.put("color", "red");
                    body.set("width", objectMapper.readTree(value));
                    performJsonAsUser(put(BASE + kind + "/" + action), body).andExpect(status().isBadRequest());
                    body.remove("width");
                    performJsonAsUser(put(BASE + kind + "/" + action), body).andExpect(status().isBadRequest());
                }
            }
        }
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(before);
        assertThat(jdbcTemplate.queryForList("SELECT * FROM template_blocks")).isEqualTo(templates);
    }
    /** JSONの非有限値を拒否する。 */
    @Test void nonFiniteJsonDoesNotWrite() throws Exception {
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        for (String width : new String[]{"NaN", "Infinity", "-Infinity"}) {
            for (String kind : new String[]{"timeBlock", "templateBlock"}) {
                performAsUser(put(BASE + kind + "/register")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .content("{\"status\":\"HOLD\",\"width\":" + width + "}"))
                    .andExpect(status().isBadRequest());
            }
        }
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(before);
    }
    /** 1分と全日幅、非スロット幅を受理する。 */
    @Test void validWidths() throws Exception {
        int table = table("2026-11-12");
        for (int width : new int[]{1, 61, 1440}) {
            var body = blockBody(table, "PLACED"); body.put("startAt", "00:00:00"); body.put("width", width);
            performJsonAsUser(put(BASE + "timeBlock/register"), body).andExpect(status().isCreated());
            performJsonAsUser(put(BASE + "templateBlock/register"), body).andExpect(status().isCreated());
        }
    }
    /** 24時ちょうどは受理し、超過する登録・更新・開始のみ更新は保存しない。 */
    @Test void placedBoundary() throws Exception {
        int table = table("2026-11-12"); int id = block(table, "PLACED");
        var body = blockBody(table, "PLACED"); body.put("id", id); body.put("width", 1); body.put("startAt", "23:59:00");
        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isNoContent());
        var before = jdbcTemplate.queryForList("SELECT * FROM time_blocks");
        for (String start : new String[]{"24:00:00", "24:01:00", "23:59:01"}) {
            body.put("startAt", start);
            performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isBadRequest());
            performJsonAsUser(put(BASE + "timeBlock/register"), body).andExpect(status().isBadRequest());
            performJsonAsUser(put(BASE + "timeBlock/update/startAt"), Map.of("id", id, "startAt", start)).andExpect(status().isBadRequest());
        }
        body.put("startAt", "23:59:00"); body.put("width", 2);
        performJsonAsUser(put(BASE + "timeBlock/update"), body).andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForList("SELECT * FROM time_blocks")).isEqualTo(before);
    }
}
