package com.scottfamily.scottfamily.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.Enumeration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Verbose HTTP request/response logger — only active when the "dev" Spring profile is enabled.
 * Activate with:  --spring.profiles.active=dev  or  SPRING_PROFILES_ACTIVE=dev
 */
@Component
@Profile("dev")
public class HttpLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(HttpLogFilter.class);
    private static final int MAX_LOG_BYTES = 10_000;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Wrap to allow safe body logging after chain
        ContentCachingRequestWrapper req = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper res = new ContentCachingResponseWrapper(response);

        long t0 = System.nanoTime();
        try {
            filterChain.doFilter(req, res);
        } finally {
            long dtMs = (System.nanoTime() - t0) / 1_000_000;

            StringBuilder sb = new StringBuilder(8_192);
            sb.append("\n================ HTTP TRACE ================\n");
            sb.append(request.getMethod()).append(" ").append(request.getRequestURI());
            if (request.getQueryString() != null) sb.append("?").append(request.getQueryString());
            sb.append("\nRemoteAddr: ").append(request.getRemoteAddr()).append("\n");

            // --- Headers ---
            sb.append("\n-- Request Headers --\n");
            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                sb.append(name).append(": ").append(request.getHeader(name)).append("\n");
            }

            // --- Cookies ---
            sb.append("\n-- Cookies --\n");
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie c : cookies) {
                    sb.append("  ").append(c.getName()).append("=")
                            .append(c.getValue()).append(" ; Path=").append(c.getPath())
                            .append(" ; Domain=").append(c.getDomain())
                            .append(" ; HttpOnly=").append(c.isHttpOnly())
                            .append(" ; Secure=").append(c.getSecure()).append("\n");
                }
            } else {
                sb.append("  (none)\n");
            }

            // --- Session / SecurityContext in session ---
            sb.append("\n-- Session & SecurityContext (from HttpSession) --\n");
            HttpSession session = request.getSession(false);
            if (session != null) {
                sb.append("SessionId: ").append(session.getId())
                        .append(" | isNew: ").append(session.isNew())
                        .append(" | created: ").append(ts(session.getCreationTime()))
                        .append(" | lastAccess: ").append(ts(session.getLastAccessedTime()))
                        .append(" | maxInactive(s): ").append(session.getMaxInactiveInterval())
                        .append("\n");

                // List session attribute names (no values to avoid secrets)
                sb.append("Attributes: ");
                var names = Collections.list(session.getAttributeNames());
                if (names.isEmpty()) {
                    sb.append("(none)\n");
                } else {
                    sb.append(names).append("\n");
                }

                Object ctxAttr = session.getAttribute("SPRING_SECURITY_CONTEXT");
                if (ctxAttr instanceof SecurityContext ctx) {
                    Authentication a = ctx.getAuthentication();
                    if (a != null) {
                        sb.append("Auth (session): type=")
                                .append(a.getClass().getSimpleName())
                                .append(" | name=").append(safe(a.getName()))
                                .append(" | principalClass=").append(a.getPrincipal() != null ? a.getPrincipal().getClass().getName() : "null")
                                .append(" | authenticated=").append(a.isAuthenticated())
                                .append("\nAuthorities: ").append(a.getAuthorities()).append("\n");
                    } else {
                        sb.append("Auth (session): null\n");
                    }
                } else {
                    sb.append("SPRING_SECURITY_CONTEXT: (absent or not a SecurityContext)\n");
                }
            } else {
                sb.append("No HttpSession\n");
            }

            // --- SecurityContext on thread (what @AuthenticationPrincipal sees) ---
            sb.append("\n-- SecurityContext (thread) --\n");
            SecurityContext threadCtx = SecurityContextHolder.getContext();
            if (threadCtx != null && threadCtx.getAuthentication() != null) {
                Authentication a = threadCtx.getAuthentication();
                sb.append("Auth (thread): type=").append(a.getClass().getSimpleName())
                        .append(" | name=").append(safe(a.getName()))
                        .append(" | principalClass=").append(a.getPrincipal() != null ? a.getPrincipal().getClass().getName() : "null")
                        .append(" | authenticated=").append(a.isAuthenticated())
                        .append("\nAuthorities: ").append(a.getAuthorities()).append("\n");
            } else {
                sb.append("Auth (thread): null\n");
            }

            // --- Request body ---
            sb.append("\n-- Request Body --\n");
            byte[] reqBuf = req.getContentAsByteArray();
            if (reqBuf.length > 0) {
                sb.append(truncate(reqBuf)).append("\n");
            } else {
                sb.append("(empty)\n");
            }

            // --- Response status/headers/body (optional but useful) ---
            sb.append("\n-- Response --\n");
            sb.append("Status: ").append(res.getStatus()).append(" (").append(dtMs).append(" ms)\n");
            sb.append("-- Response Headers --\n");
            for (String name : res.getHeaderNames()) {
                sb.append(name).append(": ").append(String.join(", ", res.getHeaders(name))).append("\n");
            }
            sb.append("-- Response Body --\n");
            byte[] respBuf = res.getContentAsByteArray();
            if (respBuf.length > 0) {
                sb.append(truncate(respBuf)).append("\n");
            } else {
                sb.append("(empty)\n");
            }

            sb.append("============== END HTTP TRACE ==============\n");
            log.debug(sb.toString());

            // IMPORTANT: copy response body back to client
            res.copyBodyToResponse();
        }
    }

    private static String truncate(byte[] bytes) {
        int len = Math.min(bytes.length, MAX_LOG_BYTES);
        return new String(bytes, 0, len, StandardCharsets.UTF_8)
                + (bytes.length > MAX_LOG_BYTES ? "\n... [truncated] ..." : "");
    }

    private static String ts(long epochMs) {
        return Instant.ofEpochMilli(epochMs).toString();
    }

    private static String safe(String s) {
        return s == null ? "null" : s;
    }
}
