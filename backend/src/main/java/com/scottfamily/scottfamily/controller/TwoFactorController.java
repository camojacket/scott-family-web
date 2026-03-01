package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.TwoFactorAuthService;
import com.scottfamily.scottfamily.service.TwoFactorAuthService.*;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * User-facing 2FA management endpoints (profile page).
 *
 * GET    /api/2fa/status                → current 2FA status
 * POST   /api/2fa/enable                → enable 2FA (requires phoneNumber + password)
 * POST   /api/2fa/disable               → disable 2FA (requires password)
 * POST   /api/2fa/regenerate-codes      → regenerate backup codes (requires password)
 * POST   /api/admin/2fa/reset/{userId}  → admin resets a user's 2FA
 */
@RestController
public class TwoFactorController {

    private final TwoFactorAuthService twoFactorAuthService;
    private final UserHelper userHelper;

    public TwoFactorController(TwoFactorAuthService twoFactorAuthService, UserHelper userHelper) {
        this.twoFactorAuthService = twoFactorAuthService;
        this.userHelper = userHelper;
    }

    @GetMapping("/api/2fa/status")
    public ResponseEntity<TwoFactorStatusDto> getStatus(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(twoFactorAuthService.getStatus(userId));
    }

    @PostMapping("/api/2fa/enable")
    public ResponseEntity<?> enable(Authentication auth, @RequestBody Map<String, String> body) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        String phoneNumber = body.get("phoneNumber");
        String password = body.get("password");
        try {
            TwoFactorSetupResult result = twoFactorAuthService.enable(userId, phoneNumber, password);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/2fa/disable")
    public ResponseEntity<?> disable(Authentication auth, @RequestBody Map<String, String> body) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        String password = body.get("password");
        try {
            twoFactorAuthService.disable(userId, password);
            return ResponseEntity.ok(Map.of("disabled", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/api/2fa/regenerate-codes")
    public ResponseEntity<?> regenerateCodes(Authentication auth, @RequestBody Map<String, String> body) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();

        String password = body.get("password");
        try {
            List<String> codes = twoFactorAuthService.regenerateBackupCodes(userId, password);
            return ResponseEntity.ok(Map.of("backupCodes", codes));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Admin endpoint ─────────────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/admin/2fa/reset/{userId}")
    public ResponseEntity<?> adminReset(@PathVariable Long userId) {
        twoFactorAuthService.adminReset(userId);
        return ResponseEntity.ok(Map.of("reset", true, "userId", userId));
    }
}
