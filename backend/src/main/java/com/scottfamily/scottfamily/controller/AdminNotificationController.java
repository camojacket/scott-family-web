package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.NotificationPreferencesService;
import com.scottfamily.scottfamily.service.NotificationSendService;
import com.scottfamily.scottfamily.service.NotificationSendService.SendNotificationRequest;
import com.scottfamily.scottfamily.service.NotificationSendService.SendNotificationResponse;
import com.scottfamily.scottfamily.service.NotificationSendService.NotificationLogEntry;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin endpoints for sending bulk notifications and viewing history.
 *
 * POST /api/admin/notifications/send       → send bulk email/SMS
 * GET  /api/admin/notifications/log        → notification history
 * GET  /api/admin/notifications/subscribers → subscriber counts
 */
@RestController
@RequestMapping("/api/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final NotificationSendService sendService;
    private final NotificationPreferencesService preferencesService;
    private final UserHelper userHelper;

    public AdminNotificationController(NotificationSendService sendService,
                                       NotificationPreferencesService preferencesService,
                                       UserHelper userHelper) {
        this.sendService = sendService;
        this.preferencesService = preferencesService;
        this.userHelper = userHelper;
    }

    /**
     * Send a notification to all opted-in subscribers.
     */
    @PostMapping("/send")
    public ResponseEntity<SendNotificationResponse> sendNotification(
            Authentication auth,
            @RequestBody SendNotificationRequest req
    ) {
        Long adminUserId = userHelper.resolveUserId(auth);
        if (adminUserId == null) return ResponseEntity.status(401).build();
        SendNotificationResponse resp = sendService.sendBulkNotification(adminUserId, req);
        return ResponseEntity.ok(resp);
    }

    /**
     * Get notification send history (last 50 entries).
     */
    @GetMapping("/log")
    public ResponseEntity<List<NotificationLogEntry>> getLog() {
        return ResponseEntity.ok(sendService.getNotificationLog());
    }

    /**
     * Get counts of email/SMS subscribers.
     */
    @GetMapping("/subscribers")
    public ResponseEntity<Map<String, Integer>> getSubscriberCounts() {
        return ResponseEntity.ok(preferencesService.getSubscriberCounts());
    }
}
