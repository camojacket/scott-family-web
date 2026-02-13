package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.PeopleService;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static com.yourproject.generated.scott_family_web.tables.PersonRequests.PERSON_REQUESTS;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;
import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;

@RestController
@RequestMapping("/api/admin/people/requests")
@RequiredArgsConstructor
public class AdminPeopleRequestsController {

    private final DSLContext dsl;
    private final PeopleService peopleService;

    // Inline field refs for new columns
    private static final Field<Long>   F_PARENT_PERSON_ID = DSL.field(DSL.name("parent_person_id"), Long.class);
    private static final Field<String> F_RELATION          = DSL.field(DSL.name("relation"),         String.class);

    @GetMapping
    public List<DTOs.PersonRequestItem> listPending() {
        // Alias for parent person name lookup
        var PARENT = PEOPLE.as("parent_person");

        return dsl
                .select(
                        PERSON_REQUESTS.ID,
                        PERSON_REQUESTS.USER_ID,
                        DSL.concat(PEOPLE.FIRST_NAME, DSL.inline(" "), DSL.coalesce(PEOPLE.LAST_NAME, DSL.inline(""))).as("requester_display_name"),
                        PERSON_REQUESTS.ACTION,
                        PERSON_REQUESTS.TARGET_PERSON_ID,
                        PERSON_REQUESTS.FIRST_NAME,
                        PERSON_REQUESTS.LAST_NAME,
                        PERSON_REQUESTS.DATE_OF_BIRTH,
                        PERSON_REQUESTS.MOTHER_ID,
                        PERSON_REQUESTS.FATHER_ID,
                        PERSON_REQUESTS.STATUS,
                        PERSON_REQUESTS.REQUESTED_AT,
                        F_PARENT_PERSON_ID,
                        F_RELATION,
                        DSL.concat(PARENT.FIRST_NAME, DSL.inline(" "), DSL.coalesce(PARENT.LAST_NAME, DSL.inline(""))).as("parent_display_name")
                )
                .from(PERSON_REQUESTS)
                .leftJoin(USERS).on(USERS.ID.eq(PERSON_REQUESTS.USER_ID))
                .leftJoin(PEOPLE).on(PEOPLE.ID.eq(USERS.PERSON_ID))
                .leftJoin(PARENT).on(PARENT.ID.eq(F_PARENT_PERSON_ID))
                .where(PERSON_REQUESTS.STATUS.eq("PENDING"))
                .orderBy(PERSON_REQUESTS.REQUESTED_AT.asc())
                .fetch(record -> {
                    var dto = new DTOs.PersonRequestItem();
                    dto.id = record.get(PERSON_REQUESTS.ID).longValue();
                    dto.userId = record.get(PERSON_REQUESTS.USER_ID).longValue();
                    dto.requesterDisplayName = record.get("requester_display_name", String.class);
                    dto.action = record.get(PERSON_REQUESTS.ACTION);
                    dto.targetPersonId = record.get(PERSON_REQUESTS.TARGET_PERSON_ID) == null ? null : record.get(PERSON_REQUESTS.TARGET_PERSON_ID).longValue();
                    dto.firstName = record.get(PERSON_REQUESTS.FIRST_NAME);
                    dto.lastName = record.get(PERSON_REQUESTS.LAST_NAME);
                    dto.dateOfBirth = record.get(PERSON_REQUESTS.DATE_OF_BIRTH);
                    dto.motherId = record.get(PERSON_REQUESTS.MOTHER_ID) == null ? null : record.get(PERSON_REQUESTS.MOTHER_ID).longValue();
                    dto.fatherId = record.get(PERSON_REQUESTS.FATHER_ID) == null ? null : record.get(PERSON_REQUESTS.FATHER_ID).longValue();
                    dto.status = record.get(PERSON_REQUESTS.STATUS);
                    dto.requestedAt = record.get(PERSON_REQUESTS.REQUESTED_AT) == null ? null : record.get(PERSON_REQUESTS.REQUESTED_AT).atOffset(OffsetDateTime.now().getOffset());
                    dto.parentPersonId = record.get(F_PARENT_PERSON_ID);
                    dto.relation = record.get(F_RELATION);
                    dto.parentDisplayName = record.get("parent_display_name", String.class);
                    return dto;
                });
    }

    @PostMapping("/{id}/approve")
    public void approve(@PathVariable("id") Long id,
                        @RequestParam(name = "reviewedBy", required = false) Long reviewedByUserId) {

        var req = dsl.selectFrom(PERSON_REQUESTS)
                .where(PERSON_REQUESTS.ID.eq(id))
                .fetchOne();
        if (req == null || !"PENDING".equals(req.getStatus())) return;

        String action = req.getAction();
        Long parentPersonId = dsl.select(F_PARENT_PERSON_ID).from(PERSON_REQUESTS).where(PERSON_REQUESTS.ID.eq(id)).fetchOne(F_PARENT_PERSON_ID);
        String relation = dsl.select(F_RELATION).from(PERSON_REQUESTS).where(PERSON_REQUESTS.ID.eq(id)).fetchOne(F_RELATION);

        if ("ADD".equals(action)) {
            var newId = dsl.insertInto(PEOPLE)
                    .set(PEOPLE.FIRST_NAME, req.getFirstName())
                    .set(PEOPLE.LAST_NAME, req.getLastName())
                    .set(PEOPLE.DATE_OF_BIRTH, req.getDateOfBirth())
                    .set(PEOPLE.MOTHER_ID, req.getMotherId())
                    .set(PEOPLE.FATHER_ID, req.getFatherId())
                    .returning(PEOPLE.ID)
                    .fetchOne(PEOPLE.ID);

            // If relationship context is set, link the new person as a child
            if (newId != null && parentPersonId != null && relation != null) {
                linkChildToParent(newId, parentPersonId, relation);
            }

            // If the requester has no person_id, link them
            var requester = dsl.selectFrom(USERS).where(USERS.ID.eq(req.getUserId())).fetchOne();
            if (requester != null && requester.getPersonId() == null && newId != null && parentPersonId == null) {
                dsl.update(USERS).set(USERS.PERSON_ID, newId).where(USERS.ID.eq(requester.getId())).execute();
            }
        } else if ("LINK_CHILD".equals(action)) {
            // Link existing child (targetPersonId) to parent (parentPersonId)
            Long childId = req.getTargetPersonId();
            if (childId != null && parentPersonId != null && relation != null) {
                linkChildToParent(childId, parentPersonId, relation);
            }
        } else {
            // UPDATE existing person
            if (req.getTargetPersonId() != null) {
                dsl.update(PEOPLE)
                        .set(PEOPLE.FIRST_NAME, req.getFirstName())
                        .set(PEOPLE.LAST_NAME, req.getLastName())
                        .set(PEOPLE.DATE_OF_BIRTH, req.getDateOfBirth())
                        .set(PEOPLE.MOTHER_ID, req.getMotherId())
                        .set(PEOPLE.FATHER_ID, req.getFatherId())
                        .where(PEOPLE.ID.eq(req.getTargetPersonId()))
                        .execute();
            }
        }

        dsl.update(PERSON_REQUESTS)
                .set(PERSON_REQUESTS.STATUS, "APPROVED")
                .set(PERSON_REQUESTS.REVIEWED_AT, java.time.LocalDateTime.now())
                .set(PERSON_REQUESTS.REVIEWED_BY, reviewedByUserId)
                .where(PERSON_REQUESTS.ID.eq(id))
                .execute();
    }

    /** Create the parent-child link (mirrors logic from PeopleService.linkChild). */
    private void linkChildToParent(Long childId, Long parentId, String relation) {
        // 1) Mirror biological into PEOPLE columns
        if ("BIOLOGICAL_MOTHER".equals(relation)) {
            dsl.update(PEOPLE).set(PEOPLE.MOTHER_ID, parentId).where(PEOPLE.ID.eq(childId)).execute();
        } else if ("BIOLOGICAL_FATHER".equals(relation)) {
            dsl.update(PEOPLE).set(PEOPLE.FATHER_ID, parentId).where(PEOPLE.ID.eq(childId)).execute();
        }

        // 2) Upsert into PERSON_PARENT
        boolean exists = dsl.fetchExists(
                dsl.selectOne().from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(relation))
        );
        if (!exists) {
            dsl.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID, PERSON_PARENT.PARENT_PERSON_ID, PERSON_PARENT.RELATION, PERSON_PARENT.VALID_FROM)
                    .values(childId, parentId, relation, LocalDate.now())
                    .execute();
        }
    }

    @PostMapping("/{id}/reject")
    public void reject(@PathVariable("id") Long id,
                       @RequestParam(name = "reviewedBy", required = false) Long reviewedByUserId,
                       @RequestParam(name = "notes", required = false) String notes) {
        var req = dsl.selectFrom(PERSON_REQUESTS)
                .where(PERSON_REQUESTS.ID.eq(id))
                .fetchOne();
        if (req == null || !"PENDING".equals(req.getStatus())) return;

        dsl.update(PERSON_REQUESTS)
                .set(PERSON_REQUESTS.STATUS, "REJECTED")
                .set(PERSON_REQUESTS.REVIEWED_AT, java.time.LocalDateTime.now())
                .set(PERSON_REQUESTS.REVIEWED_BY, reviewedByUserId)
                .set(PERSON_REQUESTS.NOTES, notes)
                .where(PERSON_REQUESTS.ID.eq(id))
                .execute();
    }
}
