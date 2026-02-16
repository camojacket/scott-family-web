package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.InquiryService;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class InquiryController {

    private final InquiryService inquiryService;
    private final UserHelper userHelper;

    public InquiryController(InquiryService inquiryService, UserHelper userHelper) {
        this.inquiryService = inquiryService;
        this.userHelper = userHelper;
    }

    // ──────────── Contact form submission ────────────

    public record ContactRequest(String name, String email, String message) {}

    @PostMapping("/contact")
    public ResponseEntity<?> submitContact(@RequestBody ContactRequest req, Authentication auth) {
        if (req.name() == null || req.name().isBlank()
            || req.email() == null || req.email().isBlank()
            || req.message() == null || req.message().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name, email, and message are required"));
        }
        Long userId = auth != null ? userHelper.resolveUserId(auth) : null;
        long id = inquiryService.submitInquiry(req.name(), req.email(), req.message(), userId);
        return ResponseEntity.ok(Map.of("id", id));
    }

    // ──────────── Admin: list inquiries ────────────

    @GetMapping("/admin/inquiries")
    @PreAuthorize("hasRole('ADMIN')")
    public List<InquiryService.InquirySummary> listInquiries(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        return inquiryService.listInquiries(status, search, sortBy, sortDir);
    }

    // ──────────── Admin: get inquiry detail + thread ────────────

    @GetMapping("/admin/inquiries/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getInquiry(@PathVariable long id) {
        var detail = inquiryService.getInquiry(id);
        if (detail == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(detail);
    }

    // ──────────── Admin: reply to inquiry ────────────

    public record AdminReplyRequest(String body) {}

    @PostMapping("/admin/inquiries/{id}/reply")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminReply(
            @PathVariable long id,
            @RequestBody AdminReplyRequest req,
            Authentication auth
    ) {
        if (req.body() == null || req.body().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Reply body is required"));
        }
        Long adminId = userHelper.resolveUserId(auth);
        if (adminId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve admin user"));
        inquiryService.adminReply(id, adminId, req.body());
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ──────────── User: notifications ────────────

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Not authenticated"));
        var notifications = inquiryService.getUserNotifications(userId);
        int unread = inquiryService.getUnreadCount(userId);
        return ResponseEntity.ok(Map.of("notifications", notifications, "unreadCount", unread));
    }

    @PostMapping("/notifications/{replyId}/read")
    public ResponseEntity<?> markRead(@PathVariable long replyId, Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Not authenticated"));
        inquiryService.markReplyRead(replyId, userId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/inquiries/{id}/read-all")
    public ResponseEntity<?> markAllRead(@PathVariable long id, Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Not authenticated"));
        inquiryService.markAllRepliesReadForInquiry(id, userId);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ──────────── User: get own inquiry thread ────────────

    @GetMapping("/inquiries/{id}")
    public ResponseEntity<?> getUserInquiry(@PathVariable long id, Authentication auth) {
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Not authenticated"));
        var detail = inquiryService.getUserInquiry(id, userId);
        if (detail == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(detail);
    }

    // ──────────── User: reply to admin's response ────────────

    public record UserReplyRequest(String body) {}

    @PostMapping("/inquiries/{id}/reply")
    public ResponseEntity<?> userReply(
            @PathVariable long id,
            @RequestBody UserReplyRequest req,
            Authentication auth
    ) {
        if (req.body() == null || req.body().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Reply body is required"));
        }
        Long userId = userHelper.resolveUserId(auth);
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Not authenticated"));
        try {
            inquiryService.userReply(id, userId, req.body());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
