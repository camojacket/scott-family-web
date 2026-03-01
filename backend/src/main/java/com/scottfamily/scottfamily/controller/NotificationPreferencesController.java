package com.scottfamily.scottfamily.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.scottfamily.scottfamily.service.NotificationPreferencesService;
import com.scottfamily.scottfamily.service.NotificationPreferencesService.NotificationPrefsDto;
import com.scottfamily.scottfamily.service.NotificationPreferencesService.PromptStatusDto;
import com.scottfamily.scottfamily.service.NotificationPreferencesService.UpdatePrefsRequest;
import com.scottfamily.scottfamily.service.UserHelper;

/**
 * User-facing endpoints for managing notification preferences.
 *
 * GET  /api/notification-preferences            → get current prefs
 * PUT  /api/notification-preferences            → update prefs (opt-in/out + phone)
 * GET  /api/notification-preferences/prompt      → should we show the opt-in prompt?
 * POST /api/notification-preferences/dismiss     → permanently dismiss the opt-in prompt
 */
@RestController
@RequestMapping("/api/notification-preferences")
@PreAuthorize("isAuthenticated()")
public class NotificationPreferencesController {

    private final NotificationPreferencesService preferencesService;
    private final UserHelper userHelper;

    public NotificationPreferencesController(NotificationPreferencesService preferencesService,
                                             UserHelper userHelper) {
        this.preferencesService = preferencesService;
        this.userHelper = userHelper;
    }

    @GetMapping
    public ResponseEntity<NotificationPrefsDto> getPreferences(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(preferencesService.getPreferences(userId));
    }

    @PutMapping
    public ResponseEntity<NotificationPrefsDto> updatePreferences(
            Authentication auth,
            @RequestBody UpdatePrefsRequest req
    ) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(preferencesService.updatePreferences(userId, req));
    }

    /** Should the opt-in prompt banner be shown to this user? */
    @GetMapping("/prompt")
    public ResponseEntity<PromptStatusDto> getPromptStatus(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(preferencesService.shouldShowPrompt(userId));
    }

    /** User chose "stop showing this" — permanently dismiss the prompt. */
    @PostMapping("/dismiss")
    public ResponseEntity<Void> dismissPrompt(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        preferencesService.dismissPrompt(userId);
        return ResponseEntity.ok().build();
    }

    /** Record that the prompt was displayed (starts the cooldown timer). */
    @PostMapping("/prompt-shown")
    public ResponseEntity<Void> markPromptShown(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        preferencesService.markPromptShown(userId);
        return ResponseEntity.ok().build();
    }

    /**
     * Quick opt-in from the notification prompt banner.
     * Enables email notifications (and optionally SMS if phone already on file).
     */
    @PostMapping("/opt-in")
    public ResponseEntity<NotificationPrefsDto> quickOptIn(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(preferencesService.quickOptIn(userId));
    }
}
