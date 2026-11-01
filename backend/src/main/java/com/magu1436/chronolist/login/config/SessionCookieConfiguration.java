package com.magu1436.chronolist.login.config;

import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.session.web.http.SessionRepositoryFilter;
import org.springframework.util.Assert;

import com.magu1436.chronolist.login.SessionCookieRefreshFilter;

@Configuration(proxyBeanMethods = false)
public class SessionCookieConfiguration {

    @Bean
    public DefaultCookieSerializer cookieSerializer(ServerProperties serverProperties) {
        var cookie = serverProperties.getServlet().getSession().getCookie();
        Assert.isTrue(cookie.getMaxAge() != null && cookie.getMaxAge().getSeconds() > 0,
                "Session cookie max-age must be a positive duration");
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName(cookie.getName());
        serializer.setCookiePath(cookie.getPath());
        serializer.setCookieMaxAge(Math.toIntExact(cookie.getMaxAge().getSeconds()));
        serializer.setUseHttpOnlyCookie(cookie.getHttpOnly());
        serializer.setUseSecureCookie(!Boolean.FALSE.equals(cookie.getSecure()));
        serializer.setSameSite(cookie.getSameSite().attributeValue());
        // No Domain: keep the cookie host-only, including on Cloud Run's shared run.app domain.
        return serializer;
    }

    @Bean
    public CookieHttpSessionIdResolver httpSessionIdResolver(DefaultCookieSerializer serializer) {
        CookieHttpSessionIdResolver resolver = new CookieHttpSessionIdResolver();
        resolver.setCookieSerializer(serializer);
        return resolver;
    }

    @Bean
    public FilterRegistrationBean<SessionCookieRefreshFilter> sessionCookieRefreshFilter(
            CookieHttpSessionIdResolver resolver) {
        var registration = new FilterRegistrationBean<>(new SessionCookieRefreshFilter(resolver));
        // Wrap Spring Session's response, before Security starts using the session.
        registration.setOrder(SessionRepositoryFilter.DEFAULT_ORDER + 1);
        return registration;
    }
}
