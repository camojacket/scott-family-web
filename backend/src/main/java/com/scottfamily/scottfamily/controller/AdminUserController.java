package com.scottfamily.scottfamily.controller;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.tables.BlogPosts.BLOG_POSTS;
import static com.yourproject.generated.scott_family_web.tables.CommentDislikes.COMMENT_DISLIKES;
import static com.yourproject.generated.scott_family_web.tables.CommentLikes.COMMENT_LIKES;
import static com.yourproject.generated.scott_family_web.tables.Comments.COMMENTS;
import static com.yourproject.generated.scott_family_web.tables.Dislikes.DISLIKES;
import static com.yourproject.generated.scott_family_web.tables.GalleryImages.GALLERY_IMAGES;
import static com.yourproject.generated.scott_family_web.tables.Likes.LIKES;
import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static com.yourproject.generated.scott_family_web.tables.PersonRequests.PERSON_REQUESTS;
import static com.yourproject.generated.scott_family_web.tables.PersonSibling.PERSON_SIBLING;
import static com.yourproject.generated.scott_family_web.tables.PersonSpouse.PERSON_SPOUSE;
import static com.yourproject.generated.scott_family_web.tables.ProfileChangeRequests.PROFILE_CHANGE_REQUESTS;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;

/**
 * Admin-only endpoints for managing users: listing, deleting (with full cascade cleanup),
 * banning and unbanning.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final DSLContext dsl;

    // Inline field refs for columns not yet in generated jOOQ code
    private static final Field<OffsetDateTime> U_BANNED_UNTIL = DSL.field(DSL.name("banned_until"), OffsetDateTime.class);
    private static final Field<String>         U_BAN_REASON   = DSL.field(DSL.name("ban_reason"),   String.class);

    // PEOPLE extended columns
    private static final Field<String> P_PREFIX      = DSL.field(DSL.name("prefix"),      String.class);
    private static final Field<String> P_MIDDLE_NAME = DSL.field(DSL.name("middle_name"), String.class);
    private static final Field<String> P_SUFFIX      = DSL.field(DSL.name("suffix"),      String.class);

    public AdminUserController(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ─── DTOs ───────────────────────────────────────────────

    public record AdminUserItem(
            Long id,
            String username,
            String email,
            String displayName,
            String userRole,
            String createdAt,
            String approvedAt,
            OffsetDateTime bannedUntil,
            String banReason,
            Long personId
    ) {}

    public record BanRequest(
            /** null = permanent */
            OffsetDateTime bannedUntil,
            String reason
    ) {}

    public record AdminPersonItem(
            Long personId,
            String displayName,
            String dateOfBirth,
            String dateOfDeath,
            String location
    ) {}

    // ─── List all users ─────────────────────────────────────

    @GetMapping
    public List<AdminUserItem> listUsers() {
        return dsl.select(
                        USERS.ID, USERS.USERNAME, USERS.EMAIL, USERS.USER_ROLE,
                        USERS.CREATED_AT, USERS.APPROVED_AT, USERS.PERSON_ID,
                        PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        U_BANNED_UNTIL, U_BAN_REASON
                )
                .from(USERS)
                .leftJoin(PEOPLE).on(PEOPLE.ID.eq(USERS.PERSON_ID))
                .orderBy(USERS.USERNAME.asc())
                .fetch(r -> {
                    String display = buildDisplayName(
                            r.get(P_PREFIX),
                            r.get(PEOPLE.FIRST_NAME),
                            r.get(P_MIDDLE_NAME),
                            r.get(PEOPLE.LAST_NAME),
                            r.get(P_SUFFIX)
                    );
                    return new AdminUserItem(
                            r.get(USERS.ID),
                            r.get(USERS.USERNAME),
                            r.get(USERS.EMAIL),
                            display,
                            r.get(USERS.USER_ROLE),
                            r.get(USERS.CREATED_AT) != null ? r.get(USERS.CREATED_AT).toString() : null,
                            r.get(USERS.APPROVED_AT) != null ? r.get(USERS.APPROVED_AT).toString() : null,
                            r.get(U_BANNED_UNTIL),
                            r.get(U_BAN_REASON),
                            r.get(USERS.PERSON_ID)
                    );
                });
    }

    // ─── List orphan profiles (people without a user account) ───

    private static final Field<String>          P_LOCATION      = DSL.field(DSL.name("location"),       String.class);
    private static final Field<java.time.LocalDate> P_DATE_OF_DEATH = DSL.field(DSL.name("date_of_death"), java.time.LocalDate.class);

    @GetMapping("/profiles")
    public List<AdminPersonItem> listOrphanProfiles() {
        return dsl.select(
                        PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, P_DATE_OF_DEATH, P_LOCATION
                )
                .from(PEOPLE)
                .whereNotExists(
                        dsl.selectOne().from(USERS).where(USERS.PERSON_ID.eq(PEOPLE.ID))
                )
                .orderBy(PEOPLE.LAST_NAME.asc().nullsLast(), PEOPLE.FIRST_NAME.asc().nullsLast())
                .fetch(r -> new AdminPersonItem(
                        r.get(PEOPLE.ID),
                        buildDisplayName(
                                r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME),
                                r.get(P_MIDDLE_NAME), r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX)
                        ),
                        r.get(PEOPLE.DATE_OF_BIRTH) != null ? r.get(PEOPLE.DATE_OF_BIRTH).toString() : null,
                        r.get(P_DATE_OF_DEATH) != null ? r.get(P_DATE_OF_DEATH).toString() : null,
                        r.get(P_LOCATION)
                ));
    }

    // ─── Delete user (full cascade cleanup) ─────────────────

    @DeleteMapping("/{userId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable Long userId) {
        // Verify user exists
        boolean exists = dsl.fetchExists(USERS, USERS.ID.eq(userId));
        if (!exists) {
            return ResponseEntity.notFound().build();
        }

        // Prevent deleting yourself (admin self-protection)
        // (caller is authenticated as admin — but we don't block here since
        //  this is meant for test cleanup; add check if needed)

        Long personId = dsl.select(USERS.PERSON_ID)
                .from(USERS).where(USERS.ID.eq(userId))
                .fetchOne(USERS.PERSON_ID);

        // 1. Blog post dependents — delete reactions/comments on this user's posts
        var postIds = dsl.select(BLOG_POSTS.ID)
                .from(BLOG_POSTS).where(BLOG_POSTS.AUTHOR_ID.eq(userId));

        var commentIds = dsl.select(COMMENTS.ID)
                .from(COMMENTS).where(COMMENTS.POST_ID.in(postIds));

        dsl.deleteFrom(COMMENT_LIKES).where(COMMENT_LIKES.COMMENT_ID.in(commentIds)).execute();
        dsl.deleteFrom(COMMENT_DISLIKES).where(COMMENT_DISLIKES.COMMENT_ID.in(commentIds)).execute();
        dsl.deleteFrom(COMMENTS).where(COMMENTS.POST_ID.in(postIds)).execute();
        dsl.deleteFrom(LIKES).where(LIKES.POST_ID.in(postIds)).execute();
        dsl.deleteFrom(DISLIKES).where(DISLIKES.POST_ID.in(postIds)).execute();
        dsl.deleteFrom(BLOG_POSTS).where(BLOG_POSTS.AUTHOR_ID.eq(userId)).execute();

        // 2. Reactions/comments the user made on OTHER posts
        dsl.deleteFrom(COMMENT_LIKES).where(COMMENT_LIKES.USER_ID.eq(userId)).execute();
        dsl.deleteFrom(COMMENT_DISLIKES).where(COMMENT_DISLIKES.USER_ID.eq(userId)).execute();
        dsl.deleteFrom(COMMENTS).where(COMMENTS.AUTHOR_ID.eq(userId)).execute();
        dsl.deleteFrom(LIKES).where(LIKES.USER_ID.eq(userId)).execute();
        dsl.deleteFrom(DISLIKES).where(DISLIKES.USER_ID.eq(userId)).execute();

        // 3. Gallery images uploaded by this user
        dsl.deleteFrom(GALLERY_IMAGES).where(GALLERY_IMAGES.UPLOADED_BY.eq(userId)).execute();

        // 4. Person / profile requests (as requester or reviewer)
        dsl.update(PERSON_REQUESTS)
                .setNull(PERSON_REQUESTS.REVIEWED_BY)
                .where(PERSON_REQUESTS.REVIEWED_BY.eq(userId))
                .execute();
        dsl.deleteFrom(PERSON_REQUESTS)
                .where(PERSON_REQUESTS.USER_ID.eq(userId))
                .execute();

        // PROFILE_CHANGE_REQUESTS reviewed_by
        dsl.update(PROFILE_CHANGE_REQUESTS)
                .setNull(PROFILE_CHANGE_REQUESTS.REVIEWED_BY)
                .where(PROFILE_CHANGE_REQUESTS.REVIEWED_BY.eq(userId))
                .execute();
        // PASSWORD_RESET_TOKENS & PROFILE_CHANGE_REQUESTS cascade on user delete

        // 5. Delete the user row
        dsl.deleteFrom(USERS).where(USERS.ID.eq(userId)).execute();

        // 6. Clean up the person row if it exists and is now orphaned
        if (personId != null) {
            deletePersonCascade(personId);
        }

        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    /**
     * Delete a person row and all its relationship links. Nullifies
     * references from other people rows (mother_id, father_id).
     */
    private void deletePersonCascade(Long personId) {
        // Unlink any other user tied to this person (shouldn't happen, but be safe)
        dsl.update(USERS).setNull(USERS.PERSON_ID).where(USERS.PERSON_ID.eq(personId)).execute();

        // Relationship tables
        dsl.deleteFrom(PERSON_PARENT)
                .where(PERSON_PARENT.CHILD_PERSON_ID.eq(personId)
                        .or(PERSON_PARENT.PARENT_PERSON_ID.eq(personId)))
                .execute();
        dsl.deleteFrom(PERSON_SIBLING)
                .where(PERSON_SIBLING.PERSON_A_ID.eq(personId)
                        .or(PERSON_SIBLING.PERSON_B_ID.eq(personId)))
                .execute();
        dsl.deleteFrom(PERSON_SPOUSE)
                .where(PERSON_SPOUSE.PERSON_ID.eq(personId)
                        .or(PERSON_SPOUSE.SPOUSE_PERSON_ID.eq(personId)))
                .execute();

        // Person request references
        dsl.update(PERSON_REQUESTS)
                .setNull(PERSON_REQUESTS.TARGET_PERSON_ID)
                .where(PERSON_REQUESTS.TARGET_PERSON_ID.eq(personId))
                .execute();
        dsl.update(PERSON_REQUESTS)
                .setNull(PERSON_REQUESTS.MOTHER_ID)
                .where(PERSON_REQUESTS.MOTHER_ID.eq(personId))
                .execute();
        dsl.update(PERSON_REQUESTS)
                .setNull(PERSON_REQUESTS.FATHER_ID)
                .where(PERSON_REQUESTS.FATHER_ID.eq(personId))
                .execute();

        // Unlink parent references in other people rows
        dsl.update(PEOPLE).setNull(PEOPLE.MOTHER_ID).where(PEOPLE.MOTHER_ID.eq(personId)).execute();
        dsl.update(PEOPLE).setNull(PEOPLE.FATHER_ID).where(PEOPLE.FATHER_ID.eq(personId)).execute();

        // Finally delete the person
        dsl.deleteFrom(PEOPLE).where(PEOPLE.ID.eq(personId)).execute();
    }

    // ─── Delete person (profile without user account) ───────

    @DeleteMapping("/person/{personId}")
    @Transactional
    public ResponseEntity<Map<String, String>> deletePerson(@PathVariable Long personId) {
        boolean exists = dsl.fetchExists(PEOPLE, PEOPLE.ID.eq(personId));
        if (!exists) return ResponseEntity.notFound().build();

        // Check if this person is linked to a user account
        boolean linkedToUser = dsl.fetchExists(USERS, USERS.PERSON_ID.eq(personId));
        if (linkedToUser) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "This profile is linked to a user account. Delete the user instead."
            ));
        }

        deletePersonCascade(personId);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    // ─── Ban user ───────────────────────────────────────────

    @PostMapping("/{userId}/ban")
    public ResponseEntity<Map<String, String>> banUser(
            @PathVariable Long userId,
            @RequestBody BanRequest req
    ) {
        boolean exists = dsl.fetchExists(USERS, USERS.ID.eq(userId));
        if (!exists) return ResponseEntity.notFound().build();

        OffsetDateTime until = req.bannedUntil();
        if (until == null) {
            // Permanent ban — set far future date
            until = OffsetDateTime.of(9999, 12, 31, 23, 59, 59, 0, ZoneOffset.UTC);
        }

        dsl.update(USERS)
                .set(U_BANNED_UNTIL, until)
                .set(U_BAN_REASON, req.reason())
                .where(USERS.ID.eq(userId))
                .execute();

        return ResponseEntity.ok(Map.of("status", "banned"));
    }

    // ─── Change role ────────────────────────────────────────

    public record RoleRequest(String role) {}

    @PostMapping("/{userId}/role")
    public ResponseEntity<Map<String, String>> changeRole(
            @PathVariable Long userId,
            @RequestBody RoleRequest req
    ) {
        String newRole = req.role();
        if (!"ROLE_ADMIN".equals(newRole) && !"ROLE_USER".equals(newRole)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role. Must be ROLE_ADMIN or ROLE_USER."));
        }

        boolean exists = dsl.fetchExists(USERS, USERS.ID.eq(userId));
        if (!exists) return ResponseEntity.notFound().build();

        dsl.update(USERS)
                .set(USERS.USER_ROLE, newRole)
                .where(USERS.ID.eq(userId))
                .execute();

        return ResponseEntity.ok(Map.of("status", "role_updated", "role", newRole));
    }

    // ─── Unban user ─────────────────────────────────────────

    @PostMapping("/{userId}/unban")
    public ResponseEntity<Map<String, String>> unbanUser(@PathVariable Long userId) {
        boolean exists = dsl.fetchExists(USERS, USERS.ID.eq(userId));
        if (!exists) return ResponseEntity.notFound().build();

        dsl.update(USERS)
                .setNull(U_BANNED_UNTIL)
                .setNull(U_BAN_REASON)
                .where(USERS.ID.eq(userId))
                .execute();

        return ResponseEntity.ok(Map.of("status", "unbanned"));
    }

    // ─── Helpers ────────────────────────────────────────────

    private static String buildDisplayName(String prefix, String firstName, String middleName,
                                           String lastName, String suffix) {
        StringBuilder sb = new StringBuilder();
        if (prefix != null && !prefix.isBlank()) sb.append(prefix).append(' ');
        if (firstName != null && !firstName.isBlank()) sb.append(firstName).append(' ');
        if (middleName != null && !middleName.isBlank()) sb.append(middleName).append(' ');
        if (lastName != null && !lastName.isBlank()) sb.append(lastName).append(' ');
        if (suffix != null && !suffix.isBlank()) sb.append(suffix);
        return sb.toString().trim();
    }
}
