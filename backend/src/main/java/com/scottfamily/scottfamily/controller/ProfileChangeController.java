// src/main/java/com/scottfamily/scottfamily/controller/ProfileChangeController.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs.Change;
import com.scottfamily.scottfamily.dto.DTOs.MyPendingChange;
import com.scottfamily.scottfamily.dto.DTOs.MyPendingChangesResponse;
import com.scottfamily.scottfamily.dto.DTOs.MyPendingPerson;
import com.scottfamily.scottfamily.dto.DTOs.PendingProfileChangeItem;
import com.scottfamily.scottfamily.dto.DTOs.ProfileChangeSubmitRequest;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import com.scottfamily.scottfamily.service.SiteSettingsService;

import static com.yourproject.generated.scott_family_web.tables.ProfileChangeRequests.PROFILE_CHANGE_REQUESTS;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;
import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static org.jooq.impl.DSL.*;

@RestController
@RequestMapping("/api/profile-change-requests")
@RequiredArgsConstructor
public class ProfileChangeController {

    private final DSLContext dsl;
    private final SiteSettingsService siteSettings;

    private static final java.util.Set<String> ACCEPTED_FIELDS =
            java.util.Set.of("mother_id", "father_id", "add_child", "add_sibling", "add_spouse");

    /** Resolve username from SecurityContext (works regardless of principal type). */
    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /**
     * Client POST for submitting profile change requests.
     * Accepted fields: mother_id, father_id, display_name, add_child.
     * If a PENDING request already exists for the same (user, field), it is replaced
     * (except add_child, which allows multiple).
     */
    @PostMapping
    public void submit(@Valid @RequestBody ProfileChangeSubmitRequest body) {

        String username = currentUsername();
        if (username == null || body == null || body.changes == null || body.changes.isEmpty()) return;

        var me = dsl.selectFrom(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        if (me == null) return;

        for (Change c : body.changes) {
            if (c == null || c.field == null || c.newValue == null) continue;

            String field = c.field.trim();
            if (!ACCEPTED_FIELDS.contains(field)) continue;

            String oldValue = null;

            if ("mother_id".equals(field) || "father_id".equals(field)) {
                // Read current parent IDs from PEOPLE (via user's person_id)
                Long myPersonId = me.getPersonId();
                Long currentMotherId = null;
                Long currentFatherId = null;
                if (myPersonId != null) {
                    var personRec = dsl.select(PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID)
                            .from(PEOPLE).where(PEOPLE.ID.eq(myPersonId)).fetchOne();
                    if (personRec != null) {
                        currentMotherId = personRec.get(PEOPLE.MOTHER_ID);
                        currentFatherId = personRec.get(PEOPLE.FATHER_ID);
                    }
                }

                // Empty newValue means "clear parent" — allow it
                if (c.newValue.trim().isEmpty()) {
                    // clearing the parent — keep newValue empty, old value for history
                    if ("mother_id".equals(field) && currentMotherId != null) {
                        oldValue = currentMotherId.toString();
                    } else if ("father_id".equals(field) && currentFatherId != null) {
                        oldValue = currentFatherId.toString();
                    }
                } else {
                    // newValue may be "personId" (legacy) or "personId:RELATION" (new)
                    String[] parts = c.newValue.split(":", 2);
                    Long newPersonId = parseLongOrNull(parts[0]);
                    if (newPersonId == null) {
                        throw new IllegalArgumentException("newValue must be a valid personId (numeric), optionally followed by :RELATION");
                    }
                    boolean exists = dsl.fetchExists(
                            selectOne().from(PEOPLE).where(PEOPLE.ID.eq(newPersonId))
                    );
                    if (!exists) {
                        throw new IllegalArgumentException("Person not found for id=" + newPersonId);
                    }
                    if ("mother_id".equals(field) && currentMotherId != null) {
                        oldValue = currentMotherId.toString();
                    } else if ("father_id".equals(field) && currentFatherId != null) {
                        oldValue = currentFatherId.toString();
                    }
                }
            } else if ("add_child".equals(field)) {
                // Format: childPersonId:relation
                String[] parts = c.newValue.split(":", 2);
                if (parts.length != 2) {
                    throw new IllegalArgumentException("add_child newValue must be 'personId:relation'");
                }
                Long childPersonId = parseLongOrNull(parts[0]);
                if (childPersonId == null) {
                    throw new IllegalArgumentException("Invalid child personId");
                }
                boolean exists = dsl.fetchExists(
                        selectOne().from(PEOPLE).where(PEOPLE.ID.eq(childPersonId))
                );
                if (!exists) {
                    throw new IllegalArgumentException("Child person not found for id=" + childPersonId);
                }
            } else if ("add_sibling".equals(field)) {
                // Format: siblingPersonId:relation
                String[] parts = c.newValue.split(":", 2);
                if (parts.length != 2) {
                    throw new IllegalArgumentException("add_sibling newValue must be 'personId:relation'");
                }
                Long siblingPersonId = parseLongOrNull(parts[0]);
                if (siblingPersonId == null) {
                    throw new IllegalArgumentException("Invalid sibling personId");
                }
                boolean exists = dsl.fetchExists(
                        selectOne().from(PEOPLE).where(PEOPLE.ID.eq(siblingPersonId))
                );
                if (!exists) {
                    throw new IllegalArgumentException("Sibling person not found for id=" + siblingPersonId);
                }
            } else if ("add_spouse".equals(field)) {
                // Format: spousePersonId:relation
                String[] parts = c.newValue.split(":", 2);
                if (parts.length != 2) {
                    throw new IllegalArgumentException("add_spouse newValue must be 'personId:relation'");
                }
                Long spousePersonId = parseLongOrNull(parts[0]);
                if (spousePersonId == null) {
                    throw new IllegalArgumentException("Invalid spouse personId");
                }
                boolean exists = dsl.fetchExists(
                        selectOne().from(PEOPLE).where(PEOPLE.ID.eq(spousePersonId))
                );
                if (!exists) {
                    throw new IllegalArgumentException("Spouse person not found for id=" + spousePersonId);
                }
            }
            // Replace existing PENDING request for (user, field) — but NOT for add_child/add_sibling/add_spouse (multiple allowed)
            if (!"add_child".equals(field) && !"add_sibling".equals(field) && !"add_spouse".equals(field)) {
                dsl.deleteFrom(PROFILE_CHANGE_REQUESTS)
                        .where(PROFILE_CHANGE_REQUESTS.USER_ID.eq(me.getId())
                                .and(PROFILE_CHANGE_REQUESTS.FIELD.eq(field))
                                .and(PROFILE_CHANGE_REQUESTS.STATUS.eq("PENDING")))
                        .execute();
            }

            // Insert PENDING request
            Long requestId = dsl.insertInto(PROFILE_CHANGE_REQUESTS)
                    .set(PROFILE_CHANGE_REQUESTS.USER_ID, me.getId())
                    .set(PROFILE_CHANGE_REQUESTS.FIELD, field)
                    .set(PROFILE_CHANGE_REQUESTS.OLD_VALUE, oldValue)
                    .set(PROFILE_CHANGE_REQUESTS.NEW_VALUE, c.newValue)
                    .set(PROFILE_CHANGE_REQUESTS.STATUS, "PENDING")
                    .set(PROFILE_CHANGE_REQUESTS.REQUESTED_AT, currentOffsetDateTime())
                    .returning(PROFILE_CHANGE_REQUESTS.ID)
                    .fetchOne(PROFILE_CHANGE_REQUESTS.ID);

            // Auto-approve if bypass is enabled (inline logic to avoid
            // AdminModerationController's class-level @PreAuthorize("hasRole('ADMIN')"))
            if (requestId != null && siteSettings.isEnabled(SiteSettingsService.BYPASS_PROFILE_CHANGE_APPROVAL)) {
                autoApprove(requestId);
            }
        }
    }

    /**
     * Get the current user's own PENDING profile change requests
     * plus any pending person-creation requests (action=ADD).
     * Visible only to the requesting user.
     */
    @GetMapping("/mine")
    public MyPendingChangesResponse mine() {
        MyPendingChangesResponse resp = new MyPendingChangesResponse();
        resp.profileChanges = new ArrayList<>();
        resp.pendingPeople = new ArrayList<>();

        String username = currentUsername();
        if (username == null) return resp;

        var me = dsl.selectFrom(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        if (me == null) return resp;

        // 1) PENDING profile change requests
        var pcRows = dsl.selectFrom(PROFILE_CHANGE_REQUESTS)
                .where(PROFILE_CHANGE_REQUESTS.USER_ID.eq(me.getId())
                        .and(PROFILE_CHANGE_REQUESTS.STATUS.eq("PENDING")))
                .fetch();

        for (var r : pcRows) {
            MyPendingChange pc = new MyPendingChange();
            pc.field = r.getField();
            pc.newValue = r.getNewValue();

            // Resolve label for mother_id / father_id / add_child
            if ("mother_id".equals(pc.field) || "father_id".equals(pc.field)) {
                // newValue may be "personId" (legacy) or "personId:RELATION" (new)
                String[] parts = pc.newValue.split(":", 2);
                Long pid = parseLongOrNull(parts[0]);
                if (pid != null) {
                    pc.label = resolvePersonName(pid);
                } else {
                    pc.label = "(clear)";
                }
            } else if ("add_child".equals(pc.field) || "add_sibling".equals(pc.field) || "add_spouse".equals(pc.field)) {
                String[] parts = pc.newValue.split(":", 2);
                Long relatedId = parts.length > 0 ? parseLongOrNull(parts[0]) : null;
                String relation = parts.length > 1 ? parts[1] : "";
                if (relatedId != null) {
                    String typeLabel = "add_child".equals(pc.field) ? "" : "add_sibling".equals(pc.field) ? "sibling, " : "spouse, ";
                    pc.label = resolvePersonName(relatedId) + " (" + typeLabel + relation.replace("_", " ").toLowerCase() + ")";
                }
            } else {
                // other fields — the newValue is the label
                pc.label = pc.newValue;
            }

            resp.profileChanges.add(pc);
        }

        // 2) PENDING person-creation requests (from PERSON_REQUESTS)
        org.jooq.Table<?> pr = DSL.table("PERSON_REQUESTS");
        org.jooq.Field<Long> prId = DSL.field("ID", Long.class);
        org.jooq.Field<Long> prUserId = DSL.field("USER_ID", Long.class);
        org.jooq.Field<String> prAction = DSL.field("ACTION", String.class);
        org.jooq.Field<String> prStatus = DSL.field("STATUS", String.class);
        org.jooq.Field<String> prFirstName = DSL.field("FIRST_NAME", String.class);
        org.jooq.Field<String> prLastName = DSL.field("LAST_NAME", String.class);
        org.jooq.Field<String> prDob = DSL.field("DATE_OF_BIRTH", String.class);

        var personRows = dsl.select(prId, prFirstName, prLastName, prDob)
                .from(pr)
                .where(prUserId.eq(me.getId())
                        .and(prAction.eq("ADD"))
                        .and(prStatus.eq("PENDING")))
                .fetch();

        for (var r : personRows) {
            MyPendingPerson pp = new MyPendingPerson();
            pp.requestId = r.get(prId);
            pp.firstName = r.get(prFirstName);
            pp.lastName = r.get(prLastName);
            pp.dateOfBirth = r.get(prDob);
            resp.pendingPeople.add(pp);
        }

        return resp;
    }

    /**
     * Admin-only: list PENDING profile change requests.
     */
    @GetMapping("/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public List<PendingProfileChangeItem> listPending() {
        var rows = dsl
                .select(
                        PROFILE_CHANGE_REQUESTS.ID,
                        PROFILE_CHANGE_REQUESTS.USER_ID,
                        USERS.USERNAME,
                        PEOPLE.FIRST_NAME,
                        PEOPLE.LAST_NAME,
                        PROFILE_CHANGE_REQUESTS.FIELD,
                        PROFILE_CHANGE_REQUESTS.OLD_VALUE,
                        PROFILE_CHANGE_REQUESTS.NEW_VALUE,
                        PROFILE_CHANGE_REQUESTS.REQUESTED_AT
                )
                .from(PROFILE_CHANGE_REQUESTS)
                .join(USERS).on(USERS.ID.eq(PROFILE_CHANGE_REQUESTS.USER_ID))
                .leftJoin(PEOPLE).on(PEOPLE.ID.eq(USERS.PERSON_ID))
                .where(PROFILE_CHANGE_REQUESTS.STATUS.eq("PENDING"))
                .orderBy(PROFILE_CHANGE_REQUESTS.REQUESTED_AT.asc())
                .fetch();

        List<PendingProfileChangeItem> out = new ArrayList<>();
        for (Record r : rows) {
            PendingProfileChangeItem dto = new PendingProfileChangeItem();
            dto.id = r.get(PROFILE_CHANGE_REQUESTS.ID).longValue();
            dto.userId = r.get(PROFILE_CHANGE_REQUESTS.USER_ID).longValue();
            dto.username = r.get(USERS.USERNAME);
            String fn = r.get(PEOPLE.FIRST_NAME);
            String ln = r.get(PEOPLE.LAST_NAME);
            dto.displayName = ((fn != null ? fn : "") + " " + (ln != null ? ln : "")).trim();
            dto.field = r.get(PROFILE_CHANGE_REQUESTS.FIELD);
            dto.oldValue = r.get(PROFILE_CHANGE_REQUESTS.OLD_VALUE);
            dto.newValue = r.get(PROFILE_CHANGE_REQUESTS.NEW_VALUE);
            dto.requestedAt = r.get(PROFILE_CHANGE_REQUESTS.REQUESTED_AT) == null
                    ? null
                    : r.get(PROFILE_CHANGE_REQUESTS.REQUESTED_AT).withOffsetSameLocal(OffsetDateTime.now().getOffset());
            out.add(dto);
        }
        return out;
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public void reject(@PathVariable("id") Long id,
                       @RequestParam(name = "notes", required = false) String notes) {

        var rec = dsl.selectFrom(PROFILE_CHANGE_REQUESTS)
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(id))
                .fetchOne();
        if (rec == null || !"PENDING".equals(rec.getStatus())) return;

        String adminUsername = currentUsername();
        Long adminUserId = null;
        if (adminUsername != null) {
            adminUserId = dsl.select(USERS.ID)
                    .from(USERS)
                    .where(USERS.USERNAME.eq(adminUsername))
                    .fetchOne(USERS.ID);
        }

        dsl.update(PROFILE_CHANGE_REQUESTS)
                .set(PROFILE_CHANGE_REQUESTS.STATUS, "REJECTED")
                .set(PROFILE_CHANGE_REQUESTS.REVIEWED_AT, DSL.currentOffsetDateTime())
                .set(PROFILE_CHANGE_REQUESTS.REVIEWED_BY, adminUserId)
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(id))
                .execute();
    }

    // ---- helpers ----

    private String resolvePersonName(Long personId) {
        if (personId == null) return null;
        var person = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(PEOPLE)
                .where(PEOPLE.ID.eq(personId))
                .fetchOne();
        if (person == null) return "Unknown";
        String first = person.get(PEOPLE.FIRST_NAME);
        String last = person.get(PEOPLE.LAST_NAME);
        return ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
    }

    private static Long parseLongOrNull(String s) {
        try {
            if (s == null) return null;
            String t = s.trim();
            return t.isEmpty() ? null : Long.parseLong(t);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Auto-approve a profile change request without requiring admin role.
     * Replicates the core logic from AdminModerationController.approveProfileChange()
     * to avoid triggering its class-level @PreAuthorize("hasRole('ADMIN')").
     */
    private void autoApprove(Long requestId) {
        if (requestId == null) return;

        var r = dsl.selectFrom(PROFILE_CHANGE_REQUESTS)
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(requestId))
                .fetchOne();
        if (r == null || !"PENDING".equals(r.getStatus())) return;

        String field = r.getField();
        String newValue = r.getNewValue();
        Long userId = r.getUserId();

        Long myPersonId = dsl.select(USERS.PERSON_ID)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOneInto(Long.class);

        if (myPersonId != null && newValue != null) {
            String[] parts = newValue.split(":", 2);
            Long targetPersonId = parseLongOrNull(parts[0]);
            String relation = parts.length > 1 && !parts[1].isBlank() ? parts[1] : null;

            switch (field) {
                case "mother_id" -> {
                    if (relation == null) relation = "BIOLOGICAL_MOTHER";
                    if ("BIOLOGICAL_MOTHER".equals(relation) && targetPersonId != null) {
                        dsl.update(PEOPLE).set(PEOPLE.MOTHER_ID, targetPersonId)
                                .where(PEOPLE.ID.eq(myPersonId)).execute();
                    }
                    if (targetPersonId != null) {
                        upsertPersonParent(myPersonId, targetPersonId, relation);
                    }
                }
                case "father_id" -> {
                    if (relation == null) relation = "BIOLOGICAL_FATHER";
                    if ("BIOLOGICAL_FATHER".equals(relation) && targetPersonId != null) {
                        dsl.update(PEOPLE).set(PEOPLE.FATHER_ID, targetPersonId)
                                .where(PEOPLE.ID.eq(myPersonId)).execute();
                    }
                    if (targetPersonId != null) {
                        upsertPersonParent(myPersonId, targetPersonId, relation);
                    }
                }
                case "add_child" -> {
                    if (targetPersonId != null && relation != null) {
                        upsertPersonParent(targetPersonId, myPersonId, relation);
                    }
                }
                case "add_sibling" -> {
                    if (targetPersonId != null && relation != null) {
                        Long aId = Math.min(myPersonId, targetPersonId);
                        Long bId = Math.max(myPersonId, targetPersonId);
                        boolean exists = dsl.fetchExists(
                                selectOne()
                                        .from(table(name("PERSON_SIBLING")))
                                        .where(field(name("PERSON_A_ID"), Long.class).eq(aId))
                                        .and(field(name("PERSON_B_ID"), Long.class).eq(bId))
                        );
                        if (!exists) {
                            dsl.insertInto(table(name("PERSON_SIBLING")))
                                    .set(field(name("PERSON_A_ID"), Long.class), aId)
                                    .set(field(name("PERSON_B_ID"), Long.class), bId)
                                    .set(field(name("RELATION"), String.class), relation)
                                    .execute();
                        }
                    }
                }
                case "add_spouse" -> {
                    if (targetPersonId != null && relation != null) {
                        Long aId = Math.min(myPersonId, targetPersonId);
                        Long bId = Math.max(myPersonId, targetPersonId);
                        boolean exists = dsl.fetchExists(
                                selectOne()
                                        .from(table(name("PERSON_SPOUSE")))
                                        .where(field(name("PERSON_ID"), Long.class).eq(aId))
                                        .and(field(name("SPOUSE_PERSON_ID"), Long.class).eq(bId))
                        );
                        if (!exists) {
                            dsl.insertInto(table(name("PERSON_SPOUSE")))
                                    .set(field(name("PERSON_ID"), Long.class), aId)
                                    .set(field(name("SPOUSE_PERSON_ID"), Long.class), bId)
                                    .set(field(name("RELATION"), String.class), relation)
                                    .execute();
                        }
                    }
                }
                default -> { /* no-op */ }
            }
        }

        // Mark as APPROVED
        dsl.update(PROFILE_CHANGE_REQUESTS)
                .set(PROFILE_CHANGE_REQUESTS.STATUS, "APPROVED")
                .set(PROFILE_CHANGE_REQUESTS.REVIEWED_AT, OffsetDateTime.now())
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(requestId))
                .execute();
    }

    private void upsertPersonParent(Long childId, Long parentId, String relation) {
        if (childId == null || parentId == null || relation == null || relation.isBlank()) return;
        boolean exists = dsl.fetchExists(
                selectOne()
                        .from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(relation))
        );
        if (!exists) {
            dsl.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID,
                            PERSON_PARENT.PARENT_PERSON_ID,
                            PERSON_PARENT.RELATION)
                    .values(childId, parentId, relation)
                    .execute();
        }
    }
}
