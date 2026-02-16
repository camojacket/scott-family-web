package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs.PersonRequestSubmit;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import com.scottfamily.scottfamily.service.SiteSettingsService;

import static com.yourproject.generated.scott_family_web.tables.Users.USERS;
import static com.yourproject.generated.scott_family_web.tables.PersonRequests.PERSON_REQUESTS;

@RestController
@RequestMapping("/api/people/requests")
@RequiredArgsConstructor
public class PersonRequestController {

    private static final int MAX_PENDING_PER_USER = 10;
    private final DSLContext dsl;
    private final SiteSettingsService siteSettings;
    private final AdminPeopleRequestsController adminPeopleRequestsController;

    /** Resolve username from SecurityContext (works regardless of principal type). */
    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /** Returns count of pending requests for the current user. */
    @GetMapping("/pending-count")
    public ResponseEntity<Map<String, Object>> pendingCount() {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        var me = dsl.selectFrom(USERS).where(USERS.USERNAME.eq(username)).fetchOne();
        if (me == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        int count = dsl.selectCount().from(PERSON_REQUESTS)
                .where(PERSON_REQUESTS.USER_ID.eq(me.getId()))
                .and(PERSON_REQUESTS.STATUS.eq("PENDING"))
                .fetchOne(0, int.class);
        return ResponseEntity.ok(Map.of("count", count, "max", MAX_PENDING_PER_USER));
    }

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody PersonRequestSubmit body) {

        String username = currentUsername();
        if (username == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        var me = dsl.selectFrom(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        if (me == null || body == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String action = body.action != null ? body.action.toUpperCase() : "";
        if (!"ADD".equals(action) && !"UPDATE".equals(action) && !"LINK_CHILD".equals(action)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid action"));
        }
        if ("UPDATE".equals(action) && body.targetPersonId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetPersonId required for UPDATE"));
        }
        if ("LINK_CHILD".equals(action) && (body.targetPersonId == null || body.parentPersonId == null)) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetPersonId and parentPersonId required for LINK_CHILD"));
        }

        // Cap check
        int pending = dsl.selectCount().from(PERSON_REQUESTS)
                .where(PERSON_REQUESTS.USER_ID.eq(me.getId()))
                .and(PERSON_REQUESTS.STATUS.eq("PENDING"))
                .fetchOne(0, int.class);
        if (pending >= MAX_PENDING_PER_USER) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error",
                            "You have reached the maximum of " + MAX_PENDING_PER_USER
                                    + " pending requests. Please wait for admin approval before submitting more."));
        }

        // Inline field refs for the new columns (may not be in generated code yet)
        var F_PARENT_PERSON_ID = org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("parent_person_id"), Long.class);
        var F_RELATION = org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("relation"), String.class);

        Long requestId = dsl.insertInto(PERSON_REQUESTS)
                .set(PERSON_REQUESTS.USER_ID, me.getId())
                .set(PERSON_REQUESTS.ACTION, action)
                .set(PERSON_REQUESTS.TARGET_PERSON_ID, body.targetPersonId)
                .set(PERSON_REQUESTS.FIRST_NAME, body.firstName)
                .set(PERSON_REQUESTS.LAST_NAME, body.lastName)
                .set(PERSON_REQUESTS.DATE_OF_BIRTH, body.dateOfBirth)
                .set(PERSON_REQUESTS.MOTHER_ID, body.motherId)
                .set(PERSON_REQUESTS.FATHER_ID, body.fatherId)
                .set(PERSON_REQUESTS.STATUS, "PENDING")
                .set(PERSON_REQUESTS.NOTES, body.notes)
                .set(F_PARENT_PERSON_ID, body.parentPersonId)
                .set(F_RELATION, body.relation)
                .returning(PERSON_REQUESTS.ID)
                .fetchOne(PERSON_REQUESTS.ID);

        // Auto-approve if bypass is enabled
        if (requestId != null && siteSettings.isEnabled(SiteSettingsService.BYPASS_PEOPLE_REQUEST_APPROVAL)) {
            adminPeopleRequestsController.approve(requestId, null);
            return ResponseEntity.ok(Map.of("message", "Request auto-approved"));
        }

        return ResponseEntity.ok(Map.of("message", "Request submitted for admin review"));
    }
}
