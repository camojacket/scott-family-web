package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.DonationService;
import com.scottfamily.scottfamily.service.DonationService.*;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for donations.
 *
 *   POST   /api/donations              — create a PENDING donation (authenticated)
 *   POST   /api/donations/guest        — create a PENDING guest donation (unauthenticated)
 *   GET    /api/donations/mine         — list current user's donations
 *   GET    /api/donations/{id}         — get a donation by ID (for polling after checkout)
 *   GET    /api/donations/admin/list   — admin: list all donations
 *   GET    /api/donations/admin/summary — admin: donation stats
 */
@RestController
@RequestMapping("/api/donations")
public class DonationController {

    private final DonationService donationService;
    private final UserHelper userHelper;

    public DonationController(DonationService donationService, UserHelper userHelper) {
        this.donationService = donationService;
        this.userHelper = userHelper;
    }

    /**
     * Create a PENDING donation for the logged-in user.
     * Returns donation info for Square checkout.
     */
    @PostMapping
    public ResponseEntity<?> createDonation(
            @RequestBody CreateDonationRequestBody request,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        try {
            var donation = donationService.createPending(userId, new CreateDonationRequest(
                    request.amountCents,
                    request.note,
                    request.reunionYear
            ));
            return ResponseEntity.ok(donation);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create a PENDING guest donation (unauthenticated).
     * This endpoint is permitAll in SecurityConfig — no session required.
     */
    @PostMapping("/guest")
    public ResponseEntity<?> createGuestDonation(@RequestBody GuestDonationRequestBody request) {
        if (request.name == null || request.name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name is required"));
        }
        if (request.amountCents < DonationService.MIN_AMOUNT_CENTS) {
            return ResponseEntity.badRequest().body(Map.of("error", "Minimum donation is $1.00"));
        }

        try {
            var donation = donationService.createGuestPending(new CreateGuestDonationRequest(
                    request.name,
                    request.email,
                    request.amountCents,
                    request.note
            ));
            return ResponseEntity.ok(donation);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Get a single donation by ID (used for polling after Square checkout return). */
    @GetMapping("/{id}")
    public ResponseEntity<?> getDonation(@PathVariable Long id) {
        var donation = donationService.getById(id);
        if (donation == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(donation);
    }

    /** List the current user's donations. */
    @GetMapping("/mine")
    public ResponseEntity<?> getMyDonations(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        return ResponseEntity.ok(donationService.getByUser(userId));
    }

    /** Admin: list all donations. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/list")
    public List<DonationDto> adminListDonations(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "100") int limit
    ) {
        return donationService.listAll(status, offset, limit);
    }

    /** Admin: donation summary stats. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/summary")
    public DonationSummaryDto adminSummary() {
        return donationService.getSummary();
    }

    // ── Request DTOs ──

    public static class CreateDonationRequestBody {
        public int amountCents;
        public String note;
        public Integer reunionYear;
    }

    public static class GuestDonationRequestBody {
        public String name;
        public String email;
        public int amountCents;
        public String note;
    }
}
