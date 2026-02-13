package com.scottfamily.scottfamily.controller;

import org.jooq.DSLContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourproject.generated.scott_family_web.tables.PendingSignups.PENDING_SIGNUPS;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSignupController {

    private final DSLContext dsl;
    public AdminSignupController(DSLContext dsl) { this.dsl = dsl; }

    @GetMapping("/pending-signups")
    public List<PendingSignupDto> list() {
        return dsl.selectFrom(PENDING_SIGNUPS)
                .orderBy(PENDING_SIGNUPS.REQUESTED_AT.asc())
                .fetch(rec -> new PendingSignupDto(
                        rec.getId(),
                        rec.getUsername(),
                        rec.getEmail(),
                        rec.getDisplayName(),
                        rec.getRequestedAt()
                ));
    }

    @PostMapping("/signups/{id}/approve")
    public void approve(@PathVariable Long id) {
        // move to USERS, then delete from pending
        var rec = dsl.selectFrom(PENDING_SIGNUPS).where(PENDING_SIGNUPS.ID.eq(id)).fetchOne();
        if (rec == null) return;
        // ... insert into USERS (set default password or send set-password mail), then:
        dsl.deleteFrom(PENDING_SIGNUPS).where(PENDING_SIGNUPS.ID.eq(id)).execute();
    }

    @PostMapping("/signups/{id}/reject")
    public void reject(@PathVariable Long id) {
        dsl.deleteFrom(PENDING_SIGNUPS).where(PENDING_SIGNUPS.ID.eq(id)).execute();
    }

    public record PendingSignupDto(Long id, String username, String email, String displayName, java.time.OffsetDateTime requestedAt) {}
}
