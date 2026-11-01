package com.magu1436.chronolist.login;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.DefaultCookieSerializer;

class SessionCookieRefreshFilterTests {

    @Test
    void refreshesBeforeEarlyResponseCommitWithoutDuplicateCookie() throws Exception {
        var serializer = new DefaultCookieSerializer();
        serializer.setCookieName("JSESSIONID");
        serializer.setCookieMaxAge(604800);
        var resolver = new CookieHttpSessionIdResolver();
        resolver.setCookieSerializer(serializer);
        var filter = new SessionCookieRefreshFilter(resolver);
        var request = new MockHttpServletRequest("GET", "/api/test");
        var response = new MockHttpServletResponse();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated("user", null, java.util.List.of()));
        request.getSession().setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);

        filter.doFilter(request, response, (req, res) -> res.flushBuffer());

        assertThat(response.isCommitted()).isTrue();
        assertThat(response.getCookies()).hasSize(1);
        assertThat(response.getCookie("JSESSIONID").getMaxAge()).isEqualTo(604800);
    }

    @Test
    void anonymousRequestDoesNotCreateSession() throws Exception {
        var filter = new SessionCookieRefreshFilter(new CookieHttpSessionIdResolver());
        var request = new MockHttpServletRequest("GET", "/api/test");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> res.flushBuffer());

        assertThat(request.getSession(false)).isNull();
        assertThat(response.getCookies()).isEmpty();
    }
}
