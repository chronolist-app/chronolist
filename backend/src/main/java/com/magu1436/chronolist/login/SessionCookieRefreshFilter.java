package com.magu1436.chronolist.login;

import java.io.IOException;

import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.util.OnCommittedResponseWrapper;
import org.springframework.session.web.http.HttpSessionIdResolver;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/** Refresh persistent cookies without creating a session or reviving one invalidated by logout. */
public final class SessionCookieRefreshFilter extends OncePerRequestFilter {

    private final HttpSessionIdResolver resolver;
    private final AuthenticationTrustResolverImpl trustResolver = new AuthenticationTrustResolverImpl();

    public SessionCookieRefreshFilter(HttpSessionIdResolver resolver) {
        this.resolver = resolver;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(request.getContextPath() + "/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        class RefreshResponse extends OnCommittedResponseWrapper {
            private boolean handled;

            RefreshResponse() {
                super(response);
            }

            @Override
            protected void onResponseCommitted() {
                if (handled) {
                    return;
                }
                handled = true;
                HttpSession session = request.getSession(false);
                if (session != null && session.getAttribute(
                        HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY) instanceof SecurityContext context
                        && trustResolver.isAuthenticated(context.getAuthentication())) {
                    // The shared resolver deduplicates issuance if login also changes the session ID.
                    resolver.setSessionId(request, response, session.getId());
                }
            }
        }
        RefreshResponse wrapped = new RefreshResponse();
        try {
            chain.doFilter(request, wrapped);
        } finally {
            if (!response.isCommitted()) {
                wrapped.onResponseCommitted();
            }
        }
    }
}
