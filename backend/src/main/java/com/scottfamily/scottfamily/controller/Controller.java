// src/main/java/com/scottfamily/scottfamily/controller/Controller.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.AuthService;
import com.scottfamily.scottfamily.service.FamilyTreeService;
import com.scottfamily.scottfamily.security.LoginRateLimiter;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Security-context imports for /auth/login remain if you use them
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class Controller {

    private final AuthService authService;
    private final FamilyTreeService familyTreeService;
    private final DSLContext dsl;
    private final SecurityContextRepository securityContextRepository;

    @Value("${server.servlet.session.timeout:20m}")
    private String sessionTimeout;

    // --- Auth ---
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@Valid @RequestBody DTOs.LoginRequest req,
                                 HttpServletRequest request,
                                 HttpServletResponse response) {

        // IP-based rate limiting to prevent brute-force attacks.
        // Throttles the attacker's IP, not the target account — so a
        // legitimate user on a different IP can still log in normally.
        String clientIp = getClientIp(request);
        LoginRateLimiter.RateLimitResult rateCheck = LoginRateLimiter.check(clientIp);
        if (!rateCheck.allowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "TOO_MANY_ATTEMPTS",
                    "message", "Too many login attempts. Please try again in " + rateCheck.retryAfterSeconds() + " seconds.",
                    "retryAfterSeconds", rateCheck.retryAfterSeconds()
            ));
        }

        DTOs.ProfileDto profile;
        try {
            profile = authService.authenticate(req);
        } catch (IllegalArgumentException ex) {
            // Bad credentials — record the failed attempt and return a clear message
            LoginRateLimiter.recordFailure(clientIp);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "INVALID_CREDENTIALS",
                    "message", "Invalid username or password."
            ));
        } catch (IllegalStateException ex) {
            String msg = ex.getMessage();
            if (msg != null && msg.startsWith("BANNED|")) {
                String[] parts = msg.split("\\|", 3);
                String until = parts.length > 1 ? parts[1] : null;
                String reason = parts.length > 2 && !parts[2].isEmpty() ? parts[2] : null;
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "BANNED",
                        "bannedUntil", until != null ? until : "",
                        "banReason", reason != null ? reason : ""
                ));
            }
            // Account pending approval, etc.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "ACCOUNT_RESTRICTED",
                    "message", msg != null ? msg : "Account access restricted."
            ));
        }

        String role = profile.userRole(); // adapt to your accessor
        String springRole = role != null && role.startsWith("ROLE_") ? role : "ROLE_" + role;

        var auth = new UsernamePasswordAuthenticationToken(
                profile.username(),
                null,
                List.of(new SimpleGrantedAuthority(springRole))
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        // Clear rate-limit counter on successful login
        LoginRateLimiter.recordSuccess(clientIp);

        return ResponseEntity.ok(profile);
    }

    /** Extracts the real client IP, respecting X-Forwarded-For from Azure load balancers. */
    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/auth/signup")
    public DTOs.SignupResponse signup(@Valid @RequestBody DTOs.SignupRequest req) {
        return authService.signup(req);
    }

    /**
     * Returns the currently authenticated user's profile from the server session.
     * This is the canonical source of truth for role/admin status — the frontend
     * must never rely solely on localStorage, which users can tamper with.
     */
    @GetMapping("/auth/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "Unauthenticated",
                    "message", "No active session."
            ));
        }
        String username = auth.getName();
        return authService.getProfileByUsername(username)
                .map(p -> ResponseEntity.ok((Object) p))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "error", "NOT_FOUND",
                        "message", "User not found."
                )));
    }

    /**
     * Returns session configuration so the frontend can sync its idle timer.
     * Also resets the session's last-accessed time (counts as activity).
     */
    @GetMapping("/auth/session-info")
    public Map<String, Object> sessionInfo(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        int maxInactive = session != null ? session.getMaxInactiveInterval() : parseTimeoutSeconds(sessionTimeout);
        return Map.of(
                "timeoutSeconds", maxInactive,
                "authenticated", session != null
        );
    }

    /**
     * Lightweight ping that resets the server-side session idle timer.
     * The frontend calls this on user activity to keep the session alive.
     */
    @PostMapping("/auth/session-ping")
    public Map<String, Object> sessionPing(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            // Accessing the session resets the last-accessed time automatically
            return Map.of("alive", true, "timeoutSeconds", session.getMaxInactiveInterval());
        }
        return Map.of("alive", false);
    }

    /** Parse Spring duration strings like "20m", "1800s", "1h" into seconds. */
    private int parseTimeoutSeconds(String timeout) {
        if (timeout == null || timeout.isBlank()) return 1200; // default 20 min
        timeout = timeout.trim().toLowerCase();
        try {
            if (timeout.endsWith("m")) return Integer.parseInt(timeout.replace("m", "")) * 60;
            if (timeout.endsWith("h")) return Integer.parseInt(timeout.replace("h", "")) * 3600;
            if (timeout.endsWith("s")) return Integer.parseInt(timeout.replace("s", ""));
            return Integer.parseInt(timeout); // plain seconds
        } catch (NumberFormatException e) {
            return 1200;
        }
    }

    // --- Family tree ---
    @GetMapping("/family/tree")
    public DTOs.FamilyNodeDto getFamilyTree() {
        return familyTreeService.buildTree();
    }

    // (Admin endpoints moved to AdminModerationController)
}
