// src/main/java/com/scottfamily/scottfamily/controller/PeopleController.java
package com.scottfamily.scottfamily.controller;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.PeopleService;
import static com.yourproject.generated.scott_family_web.tables.ProfileChangeRequests.PROFILE_CHANGE_REQUESTS;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PeopleController {
    private final PeopleService people;
    private final DSLContext dsl;

    @GetMapping("/people/search")
    public List<DTOs.PersonSummaryDto> search(@RequestParam("q") String q,
                                              @RequestParam(value = "limit", defaultValue = "10") int limit,
                                              @RequestParam(value = "excludeArchived", defaultValue = "true") boolean excludeArchived) {
        return people.searchPeople(q, Math.max(1, Math.min(limit, 25)), excludeArchived);
    }

    /**
     * Search for unclaimed people profiles (no linked user account).
     * Used during signup to let users claim existing person records.
     */
    @GetMapping("/people/unclaimed")
    public List<DTOs.PersonSummaryDto> searchUnclaimed(
            @RequestParam("firstName") String firstName,
            @RequestParam(value = "lastName", required = false) String lastName) {
        return people.searchUnclaimed(firstName, lastName);
    }

    /**
     * Search for archived but living profiles matching name + DOB.
     * Used during signup to let living elders claim their archived records.
     * Claims always require admin approval.
     */
    @GetMapping("/people/unclaimed-archived")
    public List<DTOs.PersonSummaryDto> searchUnclaimedArchived(
            @RequestParam("firstName") String firstName,
            @RequestParam(value = "lastName", required = false) String lastName,
            @RequestParam("dateOfBirth") String dateOfBirth) {
        LocalDate dob = LocalDate.parse(dateOfBirth);
        return people.searchUnclaimedArchived(firstName, lastName, dob);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/people")
    public ResponseEntity<DTOs.PersonSummaryDto> create(@Valid @RequestBody DTOs.CreatePersonRequest req) {
        Long id = people.createPerson(req);
        LocalDate dob = req.getDateOfBirth() != null && !req.getDateOfBirth().isBlank()
                ? LocalDate.parse(req.getDateOfBirth()) : null;
        LocalDate dod = req.getDateOfDeath() != null && !req.getDateOfDeath().isBlank()
                ? LocalDate.parse(req.getDateOfDeath()) : null;
        String display = PeopleService.fullDisplayName(
                req.getPrefix(), req.getFirstName(), req.getMiddleName(), req.getLastName(), req.getSuffix(),
                dob, dod);
        DTOs.PersonSummaryDto dto = new DTOs.PersonSummaryDto();
        dto.setPersonId(id);
        dto.setDisplayName(display);
        dto.setDateOfBirth(req.getDateOfBirth());
        dto.setDateOfDeath(req.getDateOfDeath());
        dto.setDeceased(req.getDateOfDeath() != null && !req.getDateOfDeath().isBlank());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/profile/{personId}")
    public ResponseEntity<DTOs.ProfileDto> getProfile(@PathVariable Long personId) {
        DTOs.ProfileDto dto = people.getProfile(personId);
        return dto == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(dto);
    }

    @PostMapping("/people/{parentId}/children")
    public ResponseEntity<?> addChild(@PathVariable Long parentId, @Valid @RequestBody DTOs.LinkChildRequest req) {
        // Reject direct child-linking for people who have a user account.
        // Those must go through the pending-request flow.
        if (people.hasAccount(parentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Cannot directly link children to user-backed profiles. Use the pending request flow instead.");
        }
        Long childId = people.linkChild(parentId, req);
        DTOs.PersonSummaryDto dto = new DTOs.PersonSummaryDto();
        dto.setPersonId(childId);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    /**
     * Admin-only: directly edit a people-only profile (no linked user account).
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/people/{personId}")
    public ResponseEntity<Void> adminEditPerson(@PathVariable Long personId, @Valid @RequestBody DTOs.EditPersonRequest req) {
        if (people.hasAccount(personId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build(); // must use profile-change flow for accounts
        }
        people.updatePerson(personId, req);
        return ResponseEntity.ok().build();
    }

    /**
     * Non-admin: queue edits to a people-only profile for admin review.
     * Each changed field is stored as a separate PROFILE_CHANGE_REQUESTS row.
     */
    @PostMapping("/people/{personId}/change-requests")
    public ResponseEntity<Void> submitPeopleChangeRequest(
            @PathVariable Long personId,
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody DTOs.EditPersonRequest req
    ) {
        if (principal == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Find the user id for the requester
        Long userId = dsl.select(USERS.ID).from(USERS)
                .where(USERS.USERNAME.eq(principal.getUsername()))
                .fetchOneInto(Long.class);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        // Queue each non-null field as a separate change request
        // We store the target personId in the OLD_VALUE field prefixed with "person:" so admin can identify
        // We use a namespaced field convention: "person_firstName", "person_dateOfDeath", etc.
        queueIfPresent(userId, personId, "person_firstName", req.getFirstName());
        queueIfPresent(userId, personId, "person_lastName", req.getLastName());
        queueIfPresent(userId, personId, "person_dateOfBirth", req.getDateOfBirth());
        queueIfPresent(userId, personId, "person_dateOfDeath", req.getDateOfDeath());
        if (req.getMotherId() != null) {
            String motherVal = req.getMotherId().toString();
            if (req.getMotherRelation() != null && !req.getMotherRelation().isBlank())
                motherVal += ":" + req.getMotherRelation();
            queueIfPresent(userId, personId, "person_motherId", motherVal);
        }
        if (req.getFatherId() != null) {
            String fatherVal = req.getFatherId().toString();
            if (req.getFatherRelation() != null && !req.getFatherRelation().isBlank())
                fatherVal += ":" + req.getFatherRelation();
            queueIfPresent(userId, personId, "person_fatherId", fatherVal);
        }

        return ResponseEntity.ok().build();
    }

    private void queueIfPresent(Long userId, Long personId, String field, String newValue) {
        if (newValue == null) return;

        // Delete any existing PENDING request for the same (user, field, person)
        dsl.deleteFrom(PROFILE_CHANGE_REQUESTS)
                .where(PROFILE_CHANGE_REQUESTS.USER_ID.eq(userId))
                .and(PROFILE_CHANGE_REQUESTS.FIELD.eq(field))
                .and(PROFILE_CHANGE_REQUESTS.OLD_VALUE.eq("person:" + personId))
                .and(PROFILE_CHANGE_REQUESTS.STATUS.eq("PENDING"))
                .execute();

        dsl.insertInto(PROFILE_CHANGE_REQUESTS)
                .columns(PROFILE_CHANGE_REQUESTS.USER_ID, PROFILE_CHANGE_REQUESTS.FIELD,
                        PROFILE_CHANGE_REQUESTS.OLD_VALUE, PROFILE_CHANGE_REQUESTS.NEW_VALUE,
                        PROFILE_CHANGE_REQUESTS.STATUS, PROFILE_CHANGE_REQUESTS.REQUESTED_AT)
                .values(userId, field, "person:" + personId, newValue, "PENDING", OffsetDateTime.now())
                .execute();
    }

    /**
     * Admin-only: mark a person as deceased (or un-mark).
     * Allows flagging someone as deceased even without a date of death.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/people/{personId}/deceased")
    public ResponseEntity<Void> setDeceased(
            @PathVariable Long personId,
            @RequestBody DeceasedRequest req
    ) {
        people.setDeceased(personId, req.deceased);
        return ResponseEntity.ok().build();
    }

    public static class DeceasedRequest {
        public boolean deceased;
    }
}
