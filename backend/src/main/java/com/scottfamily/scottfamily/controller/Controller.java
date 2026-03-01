// src/main/java/com/scottfamily/scottfamily/controller/Controller.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.AuthService;
import com.scottfamily.scottfamily.service.FamilyTreeService;
import com.scottfamily.scottfamily.service.TwoFactorAuthService;
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
    private final TwoFactorAuthService twoFactorAuthService;
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

        // ── Two-Factor Authentication check ────────────────────────────
        if (profile.id() != null && twoFactorAuthService.isEnabled(profile.id())) {
            // Don't create full session yet — store pending 2FA in HTTP session
            HttpSession session = request.getSession(true);
            session.setAttribute("2FA_PENDING_USER_ID", profile.id());
            session.setAttribute("2FA_PENDING_USERNAME", profile.username());
            session.setAttribute("2FA_PENDING_ROLE", springRole);

            // Clear any previous security context (credentials validated, but 2FA not yet)
            SecurityContextHolder.clearContext();

            // Send OTP code
            try {
                String maskedPhone = twoFactorAuthService.sendCode(profile.id());
                return ResponseEntity.ok(Map.of(
                        "twoFactorRequired", true,
                        "maskedPhone", maskedPhone
                ));
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                        "error", "2FA_SEND_FAILED",
                        "message", "Failed to send verification code. Please try again."
                ));
            }
        }

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

    /**
     * Verify a 2FA code (OTP or backup code) to complete login.
     */
    @PostMapping("/auth/verify-2fa")
    public ResponseEntity<?> verify2fa(@RequestBody Map<String, String> body,
                                       HttpServletRequest request,
                                       HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "NO_SESSION", "message", "No pending 2FA session. Please log in again."));
        }

        Long userId = (Long) session.getAttribute("2FA_PENDING_USER_ID");
        String username = (String) session.getAttribute("2FA_PENDING_USERNAME");
        String springRole = (String) session.getAttribute("2FA_PENDING_ROLE");

        if (userId == null || username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "NO_2FA_PENDING", "message", "No pending 2FA verification. Please log in again."));
        }

        String code = body.get("code");
        boolean useBackup = "true".equals(body.get("useBackupCode"));

        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "MISSING_CODE", "message", "Verification code is required."));
        }

        try {
            boolean verified;
            if (useBackup) {
                verified = twoFactorAuthService.verifyBackupCode(userId, code.trim());
            } else {
                verified = twoFactorAuthService.verifyCode(userId, code.trim());
            }

            if (!verified) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                        "error", "INVALID_CODE", "message", "Invalid verification code."));
            }
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "2FA_ERROR", "message", e.getMessage()));
        }

        // Load profile first — if this fails, don't commit auth
        var profileOpt = authService.getProfileByUsername(username);
        if (profileOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "PROFILE_ERROR", "message", "Failed to load profile."));
        }

        // 2FA verified — clear pending state and create full session
        session.removeAttribute("2FA_PENDING_USER_ID");
        session.removeAttribute("2FA_PENDING_USERNAME");
        session.removeAttribute("2FA_PENDING_ROLE");

        var auth = new UsernamePasswordAuthenticationToken(
                username, null,
                List.of(new SimpleGrantedAuthority(springRole != null ? springRole : "ROLE_USER"))
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        // Rate limit success
        LoginRateLimiter.recordSuccess(getClientIp(request));

        return ResponseEntity.ok((Object) profileOpt.get());
    }

    /**
     * Resend the 2FA OTP code.
     */
    @PostMapping("/auth/resend-2fa")
    public ResponseEntity<?> resend2fa(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "NO_SESSION", "message", "No pending 2FA session. Please log in again."));
        }

        Long userId = (Long) session.getAttribute("2FA_PENDING_USER_ID");
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "NO_2FA_PENDING", "message", "No pending 2FA verification. Please log in again."));
        }

        // Enforce 60-second cooldown between resend requests
        Long lastResend = (Long) session.getAttribute("2FA_LAST_RESEND_TIME");
        if (lastResend != null && System.currentTimeMillis() - lastResend < 60_000) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "RATE_LIMITED",
                    "message", "Please wait 60 seconds before requesting another code."));
        }
        session.setAttribute("2FA_LAST_RESEND_TIME", System.currentTimeMillis());

        try {
            String maskedPhone = twoFactorAuthService.sendCode(userId);
            return ResponseEntity.ok(Map.of("maskedPhone", maskedPhone, "sent", true));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "2FA_SEND_FAILED", "message", "Failed to resend code. Please try again."));
        }
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
