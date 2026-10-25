package com.magu1436.chronolist.login.config;

import java.net.URI;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.Assert;

@ConfigurationProperties("chronolist.cors")
public record CorsProperties(List<String> allowedOrigins) {
    public CorsProperties {
        Assert.notEmpty(allowedOrigins, "Configure chronolist.cors.allowed-origins with explicit Frontend Origins");
        for (String value : allowedOrigins) {
            URI origin;
            try {
                origin = URI.create(value);
            } catch (IllegalArgumentException exception) {
                throw new IllegalArgumentException("Invalid Frontend Origin: expected an HTTP(S) scheme, host and optional port", exception);
            }
            Assert.isTrue(("http".equalsIgnoreCase(origin.getScheme()) || "https".equalsIgnoreCase(origin.getScheme()))
                    && origin.getHost() != null && origin.getRawUserInfo() == null
                    && (origin.getRawPath() == null || origin.getRawPath().isEmpty())
                    && origin.getRawQuery() == null && origin.getRawFragment() == null
                    && (origin.getPort() == -1 || (origin.getPort() > 0 && origin.getPort() <= 65535)),
                    "Frontend Origin must contain only an HTTP(S) scheme, host and optional port; wildcards are not allowed");
        }
        allowedOrigins = List.copyOf(allowedOrigins);
    }
}
