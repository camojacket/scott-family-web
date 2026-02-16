package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;

/**
 * Shared helper for resolving user identity and display names.
 * Eliminates the duplicate resolveUserId / resolveDisplayName methods
 * that were copy-pasted across 10+ controllers/services.
 */
@Service
public class UserHelper {

    private final DSLContext dsl;

    public UserHelper(DSLContext dsl) {
        this.dsl = dsl;
    }

    /**
     * Resolve a Spring Security username to the internal user ID.
     * Returns null if the user doesn't exist.
     */
    public Long resolveUserId(String username) {
        var rec = dsl.select(USERS.ID)
                .from(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        return rec != null ? rec.value1() : null;
    }

    /**
     * Convenience overload that extracts the username from an Authentication.
     */
    public Long resolveUserId(Authentication auth) {
        return auth != null ? resolveUserId(auth.getName()) : null;
    }

    /**
     * Resolve a userId to a human-readable display name.
     * Joins users → people to get first+last name, falls back to username.
     */
    public String resolveDisplayName(Long userId) {
        if (userId == null) return "Unknown";

        var rec = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.ID.eq(userId))
                .fetchOne();

        if (rec != null && rec.get(PEOPLE.FIRST_NAME) != null) {
            String first = rec.get(PEOPLE.FIRST_NAME);
            String last = rec.get(PEOPLE.LAST_NAME);
            return (first + " " + (last != null ? last : "")).trim();
        }

        var usernameRec = dsl.select(USERS.USERNAME)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne();
        return usernameRec != null ? usernameRec.get(USERS.USERNAME) : "Unknown";
    }
}
