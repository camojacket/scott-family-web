// src/main/java/com/scottfamily/scottfamily/controller/Controller.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.AuthService;
import com.scottfamily.scottfamily.service.CommentService;
import com.scottfamily.scottfamily.service.FamilyTreeService;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Security-context imports for /auth/login remain if you use them
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
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
    private final CommentService commentService;
    private final FamilyTreeService familyTreeService;
    private final DSLContext dsl;
    private final SecurityContextRepository securityContextRepository;

    @Value("${server.servlet.session.timeout:20m}")
    private String sessionTimeout;

    // --- Auth ---
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody DTOs.LoginRequest req,
                                 HttpServletRequest request,
                                 HttpServletResponse response) {
        DTOs.ProfileDto profile;
        try {
            profile = authService.authenticate(req);
        } catch (IllegalStateException ex) {
            String msg = ex.getMessage();
            if (msg != null && msg.startsWith("BANNED|")) {
                // Parse: BANNED|<until>|<reason>
                String[] parts = msg.split("\\|", 3);
                String until = parts.length > 1 ? parts[1] : null;
                String reason = parts.length > 2 && !parts[2].isEmpty() ? parts[2] : null;
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "error", "BANNED",
                        "bannedUntil", until != null ? until : "",
                        "banReason", reason != null ? reason : ""
                ));
            }
            // Re-throw for other IllegalStateException (e.g. "Account pending approval")
            throw ex;
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

        return ResponseEntity.ok(profile);
    }

    @PostMapping("/auth/signup")
    public DTOs.ProfileDto signup(@RequestBody DTOs.SignupRequest req) {
        return authService.signup(req);
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

    // --- Comments ---
    @GetMapping("/comments/post/{postId}")
    public List<DTOs.CommentDto> getCommentsForBlogPost(@PathVariable Long postId) {
        return commentService.getComments(postId);
    }

    // --- Family tree ---
    @GetMapping("/family/tree")
    public DTOs.FamilyNodeDto getFamilyTree() {
        return familyTreeService.buildTree();
    }

    // (Admin endpoints moved to AdminModerationController)
}
