package com.magu1436.chronolist.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;
import org.springframework.test.context.jdbc.SqlMergeMode;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.magu1436.chronolist.login.LoginUser;

/**
 * 実際のSecurity・Controller・Service・Mapper・DBを使うAPIテストの共通基盤.
 * テスト全体のトランザクションは作らず、各テスト前にDBを初期化する.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Sql(scripts = "/sql/cleanup.sql", config = @SqlConfig(transactionMode = SqlConfig.TransactionMode.ISOLATED))
@SqlMergeMode(SqlMergeMode.MergeMode.MERGE)
public abstract class ApiIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    protected LoginUser loginUser;

    /** 各テストに対応するDBユーザーと認証用Principalを作成する. */
    @BeforeEach
    void prepareUser() {
        String loginId = "api-test-user";
        String password = "unused-test-password";
        jdbcTemplate.update("INSERT INTO users (login_id, password, role) VALUES (?, ?, ?)",
                loginId, password, "GENERAL");
        Integer id = jdbcTemplate.queryForObject("SELECT id FROM users WHERE login_id = ?",
                Integer.class, loginId);
        loginUser = new LoginUser(id, loginId, password, List.of());
    }

    /** ログインAPIを経由せず、テストユーザーで認証済みのリクエストを送る. */
    protected ResultActions performAsUser(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(user(loginUser)).accept(MediaType.APPLICATION_JSON));
    }

    /** オブジェクトをJSON化し、認証済みのリクエスト本文として送る. */
    protected ResultActions performJsonAsUser(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return performAsUser(request.contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(body)));
    }
}
