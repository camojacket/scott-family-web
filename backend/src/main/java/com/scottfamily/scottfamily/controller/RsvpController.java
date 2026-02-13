package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.RsvpService;
import com.scottfamily.scottfamily.service.RsvpService.RsvpDto;
import com.scottfamily.scottfamily.service.RsvpService.RsvpSummary;
import org.jooq.DSLContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

/**
 * REST API for reunion RSVPs.
 *
 *   GET    /api/rsvp          — get current user's RSVP
 *   PUT    /api/rsvp          — upsert current user's RSVP
 *   GET    /api/rsvp/all      — admin: list all RSVPs
 *   GET    /api/rsvp/summary  — admin: attendance summary
 *   POST   /api/rsvp/reset    — admin: clear all RSVPs (post-reunion)
 */
@RestController
@RequestMapping("/api/rsvp")
public class RsvpController {

    private final RsvpService rsvpService;
    private final DSLContext dsl;

    public RsvpController(RsvpService rsvpService, DSLContext dsl) {
        this.rsvpService = rsvpService;
        this.dsl = dsl;
    }

    /** Get the authenticated user's RSVP (or 204 if none yet). */
    @GetMapping
    public ResponseEntity<?> getMyRsvp(Authentication auth) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        RsvpDto rsvp = rsvpService.getByUserId(userId);
        if (rsvp == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(rsvp);
    }

    /** Create or update the authenticated user's RSVP. */
    @PutMapping
    public ResponseEntity<?> upsertRsvp(
            @RequestBody RsvpRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        RsvpDto rsvp = rsvpService.upsert(
                userId,
                request.attending,
                request.extraGuests != null ? request.extraGuests : 0,
                request.notes
        );
        return ResponseEntity.ok(rsvp);
    }

    /** Admin: list all RSVPs. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/all")
    public List<RsvpDto> listAll() {
        return rsvpService.listAll();
    }

    /** Admin: get summary stats (attending count, guests, headcount). */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/summary")
    public RsvpSummary getSummary() {
        return rsvpService.getSummary();
    }

    /** Admin: reset all RSVPs (run after the reunion is over). */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/reset")
    public ResponseEntity<?> resetAll() {
        int deleted = rsvpService.resetAll();
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    // ── Helpers ──

    private Long resolveUserId(String username) {
        var rec = dsl.select(USERS.ID)
                .from(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        return rec != null ? rec.value1() : null;
    }

    // ── Request DTO ──

    public static class RsvpRequest {
        public boolean attending;
        public Integer extraGuests;
        public String notes;
    }
}
