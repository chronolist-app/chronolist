package com.magu1436.chronolist.login.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CsrfController {

    @GetMapping("/api/csrf")
    public ResponseEntity<CsrfResponse> csrf(CsrfToken csrfToken) {
        // Use the request attribute's masked token; never expose the raw repository token.
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName()));
    }

    public record CsrfResponse(String token, String headerName) {
    }
}
