// src/main/java/com/scottfamily/scottfamily/dto/DTOs.java
package com.scottfamily.scottfamily.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class DTOs {

    /** Build a display name from structured name components. */
    public static String buildDisplayName(String prefix, String firstName, String middleName,
                                          String lastName, String suffix) {
        return Stream.of(prefix, firstName, middleName, lastName, suffix)
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(" "));
    }

    @Getter @Setter
    public static class LinkChildRequest {
        private Long childId; // optional; if absent, create new child from newChild*
        @NotBlank(message = "Relation type is required")
        private String relation; // BIOLOGICAL_FATHER | BIOLOGICAL_MOTHER | ADOPTIVE_PARENT | STEP_PARENT | FOSTER_FATHER | FOSTER_MOTHER | GUARDIAN | OTHER

        // Only used if childId is null
        private String firstName;
        private String lastName;
        private String dateOfBirth;
        private String dateOfDeath;
    }

    @Getter @Setter
    public static class CreatePersonRequest {
        @NotBlank(message = "First name is required")
        @Size(max = 100, message = "First name must be 100 characters or fewer")
        private String firstName;
        @NotBlank(message = "Last name is required")
        @Size(max = 100, message = "Last name must be 100 characters or fewer")
        private String lastName;
        private String middleName;   // optional
        private String prefix;       // optional (e.g. Mr., Mrs., Dr.)
        private String suffix;       // optional (e.g. Jr., Sr., III)
        private String dateOfBirth;  // optional ISO
        private String dateOfDeath;  // optional ISO
        private Long motherId;       // optional
        private Long fatherId;       // optional
        private String motherRelation; // optional: BIOLOGICAL_MOTHER | ADOPTIVE_MOTHER | STEP_MOTHER | FOSTER_MOTHER | GUARDIAN
        private String fatherRelation; // optional: BIOLOGICAL_FATHER | ADOPTIVE_FATHER | STEP_FATHER | FOSTER_FATHER | GUARDIAN
        private String bio;          // optional
        private String profilePictureUrl; // optional
        private String bannerImageUrl;    // optional
        private String location;     // optional
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PersonSummaryDto {
        private Long personId;
        private String displayName;
        private String dateOfBirth;  // ISO yyyy-MM-dd
        private String dateOfDeath;  // ISO yyyy-MM-dd
        private String location;
        private Boolean deceased;
        private Boolean archived;
        private String profilePictureUrl;
        private String username;
    }
    public static final class PersonRequestSubmit {
        public String action;            // "ADD" | "UPDATE" | "LINK_CHILD"
        public Long targetPersonId;      // required for UPDATE and LINK_CHILD (child person)
        public String firstName;
        public String lastName;
        public java.time.LocalDate dateOfBirth;
        public Long motherId;
        public Long fatherId;
        public String notes;
        public Long parentPersonId;      // when set, link new/target person as child of this parent
        public String relation;          // BIOLOGICAL_MOTHER | BIOLOGICAL_FATHER | etc.
    }

    public static final class PersonRequestItem {
        public Long id;
        public Long userId;
        public String requesterDisplayName;
        public String action;
        public Long targetPersonId;
        public String firstName;
        public String lastName;
        public java.time.LocalDate dateOfBirth;
        public Long motherId;
        public Long fatherId;
        public String status;            // PENDING/APPROVED/REJECTED
        public java.time.OffsetDateTime requestedAt;
        public Long parentPersonId;
        public String relation;
        public String parentDisplayName; // filled in by query
    }

    // --- Profile change request (user -> admin) ---
    public static final class Change {
        public String field;   // displayName | motherId | fatherId
        public String newValue;
    }

    public static final class ProfileChangeSubmitRequest {
        public List<Change> changes;
    }

    /**
     * Request body for editing a people-only profile (no user account).
     * Admin: applied directly.  User: queued for admin review.
     */
    @Getter @Setter
    public static class EditPersonRequest {
        private String firstName;
        private String lastName;
        private String middleName;
        private String prefix;
        private String suffix;
        private String dateOfBirth;  // ISO
        private String dateOfDeath;  // ISO
        private Long motherId;
        private Long fatherId;
        private String motherRelation; // BIOLOGICAL_MOTHER | ADOPTIVE_MOTHER | STEP_MOTHER | FOSTER_MOTHER | GUARDIAN
        private String fatherRelation; // BIOLOGICAL_FATHER | ADOPTIVE_FATHER | STEP_FATHER | FOSTER_FATHER | GUARDIAN
        private String bio;
        private String profilePictureUrl;
        private String bannerImageUrl;
        private String location;
    }

    // --- Admin list item for pending profile changes ---
    public static final class PendingProfileChangeItem {
        public Long id;
        public Long userId;
        public String username;
        public String displayName;
        public String field;
        public String oldValue;
        public String newValue;
        public OffsetDateTime requestedAt;
    }

    public record CommentDto(
            Long id,
            Long postId,
            String author,
            String content,
            String createdAt
    ) {}

    /** Info about one spouse relationship: the spouse node + which children belong to this couple. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SpouseInfoDto(
            FamilyNodeDto spouse,    // null when spouseRefId is used instead
            List<Long> childIds,     // IDs of children from this relationship
            Long spouseRefId         // cross-link: spouse already rendered elsewhere in tree
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FamilyNodeDto(
            Long id,
            String name,
            String dateOfBirth,
            String dateOfDeath,
            List<FamilyNodeDto> children,
            String avatarUrl,
            Long userId,
            List<SpouseInfoDto> spouses,  // ordered list of spouses (empty list = none)
            Boolean deceased,
            String parentRelation   // e.g. BIOLOGICAL_FATHER, FOSTER_MOTHER, STEP_FATHER, …
    ) {}

    public record PaymentRequest(String sourceId, long amount, String currency, String email) {}

    public record LoginRequest(
            @NotBlank(message = "Username is required") String username,
            @NotBlank(message = "Password is required") String password
    ) {}

    // ...keep your other DTOs as-is (omitted for brevity)

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PersonRelDto {
        private Long personId;
        private String displayName;
        private String relation; // BIOLOGICAL_FATHER | BIOLOGICAL_MOTHER | CHILD | etc.
    }

    /**
     * Unified profile view used by BOTH:
     * - /api/profile/{userId}  (account-backed)
     * - /api/profile/by-person/{personId}  (ancestor-only)
     *
     * Rules:
     * - If there is no account: id/username/email/userRole/joinedAt are null and hasAccount = false.
     * - All other fields are present for both cases.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL) @Builder
    public record ProfileDto(
            // linkage
            Long personId,                 // always set (user.person_id or the person id itself)
            Boolean hasAccount,            // true if a users row exists

            // account-facing (nullable for ancestor-only)
            Long id,                       // userId (nullable if no account)
            String username,
            String email,
            String userRole,
            LocalDateTime joinedAt,

            // shared profile fields (render on both pages)
            String displayName,
            String prefix,
            String firstName,
            String middleName,
            String lastName,
            String suffix,
            String bio,
            String profilePictureUrl,
            String bannerImageUrl,
            Long motherId,
            Long fatherId,
            LocalDate dateOfBirth,
            LocalDate dateOfDeath,
            Boolean deceased,
            String location,

            // lineage lists (optional but same shape for both)
            List<PersonRelDto> parents,
            List<PersonRelDto> children,
            List<PersonRelDto> siblings,
            List<PersonRelDto> spouses
    ) {}

    public record SignupRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
            String username,
            @NotBlank(message = "Password is required")
            @Size(min = 8, message = "Password must be at least 8 characters")
            String password,
            @NotBlank(message = "First name is required")
            @Size(max = 100)
            String firstName,
            @NotBlank(message = "Last name is required")
            @Size(max = 100)
            String lastName,
            String middleName,
            String prefix,
            String suffix,
            String email,
            String bio,
            String profilePictureUrl,
            String bannerImageUrl,
            Long motherId,
            Long fatherId,
            String motherRelation,   // BIOLOGICAL_MOTHER | ADOPTIVE_MOTHER | STEP_MOTHER | FOSTER_MOTHER | GUARDIAN
            String fatherRelation,   // BIOLOGICAL_FATHER | ADOPTIVE_FATHER | STEP_FATHER | FOSTER_FATHER | GUARDIAN
            @NotNull(message = "Date of birth is required")
            LocalDate dateOfBirth,
            String location,

            // (optional): used when user typed a new parent in the Autocomplete
            String motherName,
            LocalDate motherDateOfBirth,
            String fatherName,
            LocalDate fatherDateOfBirth,

            // (optional): claim an existing person profile during signup
            Long claimPersonId
    ) {}

    /** Returned by the signup endpoint so the frontend knows whether the account was auto-approved. */
    public record SignupResponse(
            boolean approved,
            String message
    ) {}


    public record PendingUserDto(
            Long id,
            String username,
            String displayName,
            String email,
            String requestedAt,
            Long archivedClaimPersonId,
            String archivedClaimDisplayName
    ) {}

    // --- User's own pending profile changes + pending person requests ---
    public static final class MyPendingChangesResponse {
        public List<MyPendingChange> profileChanges;
        public List<MyPendingPerson> pendingPeople;
    }

    public static final class MyPendingChange {
        public String field;       // mother_id, father_id, display_name, add_child
        public String newValue;    // raw value (personId, name, childId:relation)
        public String label;       // human-readable label, e.g. person display name
    }

    public static final class MyPendingPerson {
        public Long requestId;
        public String firstName;
        public String lastName;
        public String dateOfBirth;
    }
}
