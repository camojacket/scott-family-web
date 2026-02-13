package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.dto.DTOs.PendingProfileChangeItem;
import com.scottfamily.scottfamily.service.MailService;
import com.scottfamily.scottfamily.service.PeopleService;
import com.yourproject.generated.scott_family_web.Tables;
import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;
import static com.yourproject.generated.scott_family_web.tables.ProfileChangeRequests.PROFILE_CHANGE_REQUESTS;
import static org.jooq.impl.DSL.selectOne;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    private final DSLContext dsl;
    private final MailService mail;
    private final PeopleService peopleService;

    public AdminModerationController(DSLContext dsl, MailService mail, PeopleService peopleService) {
        this.dsl = dsl;
        this.mail = mail;
        this.peopleService = peopleService;
    }

    // =========================
    // Pending Signups (list/approve/reject + bulk)
    // =========================



    // --- Admin: pending + approve/reject single
    @GetMapping("/pending-signups")
    public List<DTOs.PendingUserDto> getPendingSignups() {
        return dsl.select(Tables.USERS.ID, Tables.USERS.USERNAME, Tables.USERS.EMAIL,
                        Tables.USERS.REQUESTED_AT, Tables.USERS.PERSON_ID,
                        PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(Tables.USERS)
                .leftJoin(PEOPLE).on(PEOPLE.ID.eq(Tables.USERS.PERSON_ID))
                .where(Tables.USERS.APPROVED_AT.isNull())
                .orderBy(Tables.USERS.REQUESTED_AT.asc())
                .fetch(r -> {
                    String firstName = r.get(PEOPLE.FIRST_NAME);
                    String lastName = r.get(PEOPLE.LAST_NAME);
                    String displayName = ((firstName != null ? firstName : "") + " " +
                            (lastName != null ? lastName : "")).trim();
                    return new DTOs.PendingUserDto(
                            r.get(Tables.USERS.ID),
                            r.get(Tables.USERS.USERNAME),
                            displayName.isEmpty() ? null : displayName,
                            r.get(Tables.USERS.EMAIL),
                            r.get(Tables.USERS.REQUESTED_AT) == null
                                    ? null
                                    : r.get(Tables.USERS.REQUESTED_AT)
                                    .atZone(ZoneId.systemDefault())
                                    .toInstant()
                                    .truncatedTo(ChronoUnit.MILLIS)
                                    .toString()
                    );
                });
    }

    @PostMapping("/approve/{userId}")
    public ResponseEntity<Void> approveUser(@PathVariable Long userId) {
        UsersRecord r = dsl.selectFrom(Tables.USERS).where(Tables.USERS.ID.eq(userId)).fetchOne();
        if (r != null) {
            dsl.update(Tables.USERS)
                    .set(Tables.USERS.APPROVED_AT, DSL.currentLocalDateTime())
                    .where(Tables.USERS.ID.eq(userId))
                    .execute();
            if (r.getEmail() != null) mail.sendApprovalEmail(r.getEmail());
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reject/{userId}")
    public ResponseEntity<Void> rejectUser(@PathVariable Long userId) {
        UsersRecord user = dsl.selectFrom(Tables.USERS).where(Tables.USERS.ID.eq(userId)).fetchOne();
        if (user != null) {
            String email = user.getEmail();
            Long personId = user.getPersonId();
            dsl.deleteFrom(Tables.USERS).where(Tables.USERS.ID.eq(userId)).execute();
            // Clean up orphan PEOPLE row
            if (personId != null) {
                dsl.deleteFrom(Tables.PEOPLE).where(Tables.PEOPLE.ID.eq(personId)).execute();
            }
            if (email != null) mail.sendRejectionEmail(email);
        }
        return ResponseEntity.ok().build();
    }

    // --- Admin: bulk approve/reject to support table multi-select
    public record Ids(List<Long> ids) {}

    @PostMapping("/approve")
    public ResponseEntity<Void> bulkApprove(@RequestBody Ids body) {
        if (body.ids() != null && !body.ids().isEmpty()) {
            dsl.update(Tables.USERS)
                    .set(Tables.USERS.APPROVED_AT, DSL.currentLocalDateTime())
                    .where(Tables.USERS.ID.in(body.ids()))
                    .execute();

            dsl.selectFrom(Tables.USERS)
                    .where(Tables.USERS.ID.in(body.ids()))
                    .fetch()
                    .forEach(u -> { if (u.getEmail()!=null) mail.sendApprovalEmail(u.getEmail()); });
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reject")
    public ResponseEntity<Void> bulkReject(@RequestBody Ids body) {
        if (body.ids() != null && !body.ids().isEmpty()) {
            var usersToReject = dsl.selectFrom(Tables.USERS)
                    .where(Tables.USERS.ID.in(body.ids()))
                    .fetch();
            var emails = usersToReject.stream().map(UsersRecord::getEmail).filter(e -> e != null).toList();
            var personIds = usersToReject.stream().map(UsersRecord::getPersonId).filter(p -> p != null).toList();
            dsl.deleteFrom(Tables.USERS).where(Tables.USERS.ID.in(body.ids())).execute();
            // Clean up orphan PEOPLE rows
            if (!personIds.isEmpty()) {
                dsl.deleteFrom(Tables.PEOPLE).where(Tables.PEOPLE.ID.in(personIds)).execute();
            }
            emails.forEach(mail::sendRejectionEmail);
        }
        return ResponseEntity.ok().build();
    }

    // =========================
    // Profile Change Requests (list/approve/reject)
    // =========================

    @GetMapping("/pending-profile-changes")
    public List<PendingProfileChangeItem> listProfileChanges() {
        return dsl
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
                .fetch(record -> {
                    var dto = new DTOs.PendingProfileChangeItem();
                    dto.id = record.get(PROFILE_CHANGE_REQUESTS.ID);
                    dto.userId = record.get(PROFILE_CHANGE_REQUESTS.USER_ID);
                    dto.username = record.get(USERS.USERNAME);
                    String fn = record.get(PEOPLE.FIRST_NAME);
                    String ln = record.get(PEOPLE.LAST_NAME);
                    dto.displayName = ((fn != null ? fn : "") + " " + (ln != null ? ln : "")).trim();
                    dto.field = record.get(PROFILE_CHANGE_REQUESTS.FIELD);
                    dto.oldValue = record.get(PROFILE_CHANGE_REQUESTS.OLD_VALUE);
                    dto.newValue = record.get(PROFILE_CHANGE_REQUESTS.NEW_VALUE);
                    dto.requestedAt = record.get(PROFILE_CHANGE_REQUESTS.REQUESTED_AT);
                    return dto;
                });
    }

    @PostMapping("/profile-change-requests/{id}/approve")
    public ResponseEntity<Void> approveProfileChange(@PathVariable Long id) {
        var r = dsl.selectFrom(PROFILE_CHANGE_REQUESTS)
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(id))
                .fetchOne();

        if (r == null || !"PENDING".equals(r.getStatus())) return ResponseEntity.ok().build();

        String field = r.getField();
        if (field != null && field.startsWith("person_")) {
            // People-only profile change — extract personId from OLD_VALUE "person:123"
            String oldVal = r.getOldValue();
            if (oldVal != null && oldVal.startsWith("person:")) {
                Long personId = Long.valueOf(oldVal.substring("person:".length()));
                applyPersonFieldChange(personId, field, r.getNewValue());
            }
        } else {
            applyProfileChange(r.getUserId(), field, r.getNewValue());
        }

        dsl.update(PROFILE_CHANGE_REQUESTS)
                .set(PROFILE_CHANGE_REQUESTS.STATUS, "APPROVED")
                .set(PROFILE_CHANGE_REQUESTS.REVIEWED_AT, OffsetDateTime.now())
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(id))
                .execute();

        return ResponseEntity.ok().build();
    }

    @PostMapping("/profile-change-requests/{id}/reject")
    public ResponseEntity<Void> rejectProfileChange(@PathVariable Long id) {
        dsl.update(PROFILE_CHANGE_REQUESTS)
                .set(PROFILE_CHANGE_REQUESTS.STATUS, "REJECTED")
                .set(PROFILE_CHANGE_REQUESTS.REVIEWED_AT, OffsetDateTime.now())
                .where(PROFILE_CHANGE_REQUESTS.ID.eq(id))
                .execute();
        return ResponseEntity.ok().build();
    }

    // ------------ helpers ------------
    private void applyPersonFieldChange(Long personId, String field, String newValue) {
        DTOs.EditPersonRequest req = new DTOs.EditPersonRequest();
        switch (field) {
            case "person_firstName"   -> req.setFirstName(newValue);
            case "person_lastName"    -> req.setLastName(newValue);
            case "person_dateOfBirth" -> req.setDateOfBirth(newValue);
            case "person_dateOfDeath" -> req.setDateOfDeath(newValue);
            case "person_motherId"   -> {
                // newValue may be "personId" or "personId:RELATION"
                String[] parts = newValue.split(":", 2);
                req.setMotherId(parseNullableLong(parts[0]));
                if (parts.length > 1 && !parts[1].isBlank())
                    req.setMotherRelation(parts[1]);
            }
            case "person_fatherId"   -> {
                String[] parts = newValue.split(":", 2);
                req.setFatherId(parseNullableLong(parts[0]));
                if (parts.length > 1 && !parts[1].isBlank())
                    req.setFatherRelation(parts[1]);
            }
            default -> { return; }
        }
        peopleService.updatePerson(personId, req);
    }

    private void applyProfileChange(Long userId, String field, String newValue) {
        switch (field) {
            case "display_name" -> {
                // Legacy: no longer used (names are now structured fields).
                // Keep case to avoid breaking old pending requests — just no-op
            }
            case "mother_id" -> {
                // newValue may be "personId" (legacy) or "personId:RELATION" (new)
                String[] parts = newValue.split(":", 2);
                Long personId = parseNullableLong(parts[0]);
                String relation = parts.length > 1 && !parts[1].isBlank() ? parts[1] : "BIOLOGICAL_MOTHER";

                Long childPersonId = dsl.select(USERS.PERSON_ID)
                        .from(USERS)
                        .where(USERS.ID.eq(userId))
                        .fetchOneInto(Long.class);

                // Write to PEOPLE.MOTHER_ID only for biological
                if (childPersonId != null) {
                    if ("BIOLOGICAL_MOTHER".equals(relation)) {
                        dsl.update(Tables.PEOPLE)
                                .set(Tables.PEOPLE.MOTHER_ID, personId)
                                .where(Tables.PEOPLE.ID.eq(childPersonId))
                                .execute();
                    }
                }

                if (childPersonId != null && personId != null) {
                    upsertPersonParent(dsl, childPersonId, personId, relation);
                }
            }

            case "father_id" -> {
                // newValue may be "personId" (legacy) or "personId:RELATION" (new)
                String[] parts = newValue.split(":", 2);
                Long personId = parseNullableLong(parts[0]);
                String relation = parts.length > 1 && !parts[1].isBlank() ? parts[1] : "BIOLOGICAL_FATHER";

                Long childPersonId = dsl.select(USERS.PERSON_ID)
                        .from(USERS)
                        .where(USERS.ID.eq(userId))
                        .fetchOneInto(Long.class);

                // Write to PEOPLE.FATHER_ID only for biological
                if (childPersonId != null) {
                    if ("BIOLOGICAL_FATHER".equals(relation)) {
                        dsl.update(Tables.PEOPLE)
                                .set(Tables.PEOPLE.FATHER_ID, personId)
                                .where(Tables.PEOPLE.ID.eq(childPersonId))
                                .execute();
                    }
                }

                if (childPersonId != null && personId != null) {
                    upsertPersonParent(dsl, childPersonId, personId, relation);
                }
            }
            case "add_child" -> {
                // newValue format: childPersonId:relation
                String[] parts = newValue.split(":", 2);
                if (parts.length == 2) {
                    Long childPersonId = parseNullableLong(parts[0]);
                    String relation = parts[1];
                    Long parentPersonId = dsl.select(USERS.PERSON_ID)
                            .from(USERS)
                            .where(USERS.ID.eq(userId))
                            .fetchOneInto(Long.class);
                    if (childPersonId != null && parentPersonId != null && relation != null && !relation.isBlank()) {
                        upsertPersonParent(dsl, childPersonId, parentPersonId, relation);
                    }
                }
            }
            case "add_sibling" -> {
                // newValue format: siblingPersonId:relation
                String[] parts = newValue.split(":", 2);
                if (parts.length == 2) {
                    Long siblingPersonId = parseNullableLong(parts[0]);
                    String relation = parts[1];
                    Long myPersonId = dsl.select(USERS.PERSON_ID)
                            .from(USERS)
                            .where(USERS.ID.eq(userId))
                            .fetchOneInto(Long.class);
                    if (siblingPersonId != null && myPersonId != null && relation != null && !relation.isBlank()) {
                        // Canonical order: smaller ID first
                        Long aId = Math.min(myPersonId, siblingPersonId);
                        Long bId = Math.max(myPersonId, siblingPersonId);
                        boolean exists = dsl.fetchExists(
                                org.jooq.impl.DSL.selectOne()
                                        .from(org.jooq.impl.DSL.table(org.jooq.impl.DSL.name("PERSON_SIBLING")))
                                        .where(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_A_ID"), Long.class).eq(aId))
                                        .and(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_B_ID"), Long.class).eq(bId))
                        );
                        if (!exists) {
                            dsl.insertInto(org.jooq.impl.DSL.table(org.jooq.impl.DSL.name("PERSON_SIBLING")))
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_A_ID"), Long.class), aId)
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_B_ID"), Long.class), bId)
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("RELATION"), String.class), relation)
                                    .execute();
                        }
                    }
                }
            }
            case "add_spouse" -> {
                // newValue format: spousePersonId:relation
                String[] parts = newValue.split(":", 2);
                if (parts.length == 2) {
                    Long spousePersonId = parseNullableLong(parts[0]);
                    String relation = parts[1];
                    Long myPersonId = dsl.select(USERS.PERSON_ID)
                            .from(USERS)
                            .where(USERS.ID.eq(userId))
                            .fetchOneInto(Long.class);
                    if (spousePersonId != null && myPersonId != null && relation != null && !relation.isBlank()) {
                        // Canonical order: smaller ID first
                        Long aId = Math.min(myPersonId, spousePersonId);
                        Long bId = Math.max(myPersonId, spousePersonId);
                        boolean exists = dsl.fetchExists(
                                org.jooq.impl.DSL.selectOne()
                                        .from(org.jooq.impl.DSL.table(org.jooq.impl.DSL.name("PERSON_SPOUSE")))
                                        .where(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_ID"), Long.class).eq(aId))
                                        .and(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("SPOUSE_PERSON_ID"), Long.class).eq(bId))
                        );
                        if (!exists) {
                            dsl.insertInto(org.jooq.impl.DSL.table(org.jooq.impl.DSL.name("PERSON_SPOUSE")))
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("PERSON_ID"), Long.class), aId)
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("SPOUSE_PERSON_ID"), Long.class), bId)
                                    .set(org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("RELATION"), String.class), relation)
                                    .execute();
                        }
                    }
                }
            }
            default -> { /* no-op for unknown fields */ }
        }
    }

    // Minimal helper; adjust table/columns to your actual jOOQ classes if you generated them.
    private void upsertPersonParent(DSLContext dsl, Long childId, Long parentId, String relation) {
        if (childId == null || parentId == null || relation == null || relation.isBlank()) return;

        boolean exists = dsl.fetchExists(
                selectOne()
                        .from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(relation))
        );

        if (!exists) {
            // If you created VALID_FROM / VALID_TO columns and want to set them, add them here.
            dsl.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID,
                            PERSON_PARENT.PARENT_PERSON_ID,
                            PERSON_PARENT.RELATION)
                    .values(childId, parentId, relation)
                    .execute();
        }
    }


    private Long parseNullableLong(String s) {
        if (s == null || s.isBlank()) return null;
        return Long.valueOf(s);
    }

}
