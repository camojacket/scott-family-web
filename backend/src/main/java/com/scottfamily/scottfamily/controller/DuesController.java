package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.DuesService;
import com.scottfamily.scottfamily.service.DuesService.*;
import com.scottfamily.scottfamily.service.DuePeriodService;
import org.jooq.DSLContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Year;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

/**
 * REST API for reunion dues.
 *
 *   GET    /api/dues                     — get current user's dues status for this year
 *   POST   /api/dues/pay                 — initiate dues payment
 *   POST   /api/dues/confirm             — confirm payment after Square processes
 *   GET    /api/dues/admin/status        — admin: paid/unpaid list for a year
 *   GET    /api/dues/admin/summary       — admin: summary stats
 *   POST   /api/dues/admin/record        — admin: manually record a payment
 */
@RestController
@RequestMapping("/api/dues")
public class DuesController {

    private final DuesService duesService;
    private final DuePeriodService periodService;
    private final DSLContext dsl;

    public DuesController(DuesService duesService, DuePeriodService periodService, DSLContext dsl) {
        this.duesService = duesService;
        this.periodService = periodService;
        this.dsl = dsl;
    }

    /** Get the current user's dues page: self status + guest payments. */
    @GetMapping
    public ResponseEntity<?> getMyDues(Authentication auth) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        int year = periodService.resolveReunionYear();
        DuesPageDto page = duesService.getDuesPage(userId, year);
        return ResponseEntity.ok(page);
    }

    /**
     * Initiate a dues payment batch — pay for self and/or family members.
     * Creates PENDING records and returns batch info for Square checkout.
     */
    @PostMapping("/pay")
    public ResponseEntity<?> initiatePayment(
            @RequestBody PayRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        int year = periodService.resolveReunionYear();

        try {
            var batch = duesService.createBatch(
                    userId, year,
                    request.payForSelf != null ? request.payForSelf : true,
                    request.guests != null ? request.guests : List.of());
            return ResponseEntity.ok(batch);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Confirm a batch payment after Square processes successfully. */
    @PostMapping("/confirm")
    public ResponseEntity<?> confirmPayment(
            @RequestBody ConfirmRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        if (request.batchId == null || request.batchId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "batchId is required"));
        }

        try {
            var payments = duesService.confirmBatch(request.batchId,
                    request.squarePaymentId, request.squareReceiptUrl);
            return ResponseEntity.ok(payments);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Admin: get paid/unpaid status for all members, sortable by name or date of birth. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/status")
    public ResponseEntity<?> getDuesStatus(
            @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        List<DuesStatusDto> status = duesService.getDuesStatus(year);

        // Sort
        Comparator<DuesStatusDto> cmp;
        if ("age".equalsIgnoreCase(sortBy) || "dob".equalsIgnoreCase(sortBy)) {
            cmp = Comparator.comparing(
                    DuesStatusDto::dateOfBirth,
                    Comparator.nullsLast(Comparator.naturalOrder())
            );
        } else {
            cmp = Comparator.comparing(
                    DuesStatusDto::displayName,
                    String.CASE_INSENSITIVE_ORDER
            );
        }
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        status.sort(cmp);

        return ResponseEntity.ok(status);
    }

    /** Admin: summary stats for a year. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/summary")
    public DuesSummaryDto getAdminSummary(
            @RequestParam(defaultValue = "#{T(java.time.Year).now().getValue()}") int year
    ) {
        return duesService.getSummary(year);
    }

    /** Admin: manually record a cash/check payment (pay-on-behalf style). */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/record")
    public ResponseEntity<?> adminRecordPayment(@RequestBody AdminRecordRequest request) {
        // Name is required
        if (request.firstName == null || request.firstName.isBlank()
                || request.lastName == null || request.lastName.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "First name and last name are required"));
        }

        int year = request.reunionYear != null ? request.reunionYear : periodService.resolveReunionYear();

        DuesPaymentDto result = duesService.recordManualPayment(
                request.userId,
                year,
                request.amountCents,
                request.firstName,
                request.middleName,
                request.lastName,
                request.prefix,
                request.suffix,
                request.dateOfBirth
        );
        return ResponseEntity.ok(result);
    }

    // ── Helpers ──

    private Long resolveUserId(String username) {
        var rec = dsl.select(USERS.ID)
                .from(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        return rec != null ? rec.value1() : null;
    }

    // ── Request DTOs ──

    public static class PayRequest {
        public Boolean payForSelf;
        public List<DuesService.GuestInfo> guests;
    }

    public static class ConfirmRequest {
        public String batchId;
        public String squarePaymentId;
        public String squareReceiptUrl;
    }

    public static class AdminRecordRequest {
        /** Optional — link payment to an existing user account. */
        public Long userId;
        /** Required name fields for the person being paid for. */
        public String firstName;
        public String middleName;
        public String lastName;
        public String prefix;
        public String suffix;
        /** Optional date of birth (ISO format, e.g. "1990-01-15"). */
        public String dateOfBirth;
        public Integer reunionYear;
        public int amountCents;
    }
}
