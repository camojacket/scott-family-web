package com.scottfamily.scottfamily.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

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
     * Single query: joins users → people, falls back to username via COALESCE.
     */
    public String resolveDisplayName(Long userId) {
        if (userId == null) return "Unknown";

        var rec = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, USERS.USERNAME)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.ID.eq(userId))
                .fetchOne();

        if (rec == null) return "Unknown";

        if (rec.get(PEOPLE.FIRST_NAME) != null) {
            String first = rec.get(PEOPLE.FIRST_NAME);
            String last = rec.get(PEOPLE.LAST_NAME);
            return (first + " " + (last != null ? last : "")).trim();
        }

        String username = rec.get(USERS.USERNAME);
        return username != null ? username : "Unknown";
    }

    /**
     * Batch-resolve multiple user IDs to display names in a single query.
     */
    public Map<Long, String> batchResolveDisplayNames(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();

        Map<Long, String> result = new HashMap<>();
        dsl.select(USERS.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, USERS.USERNAME)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.ID.in(userIds))
                .forEach(rec -> {
                    Long uid = rec.get(USERS.ID);
                    if (rec.get(PEOPLE.FIRST_NAME) != null) {
                        String first = rec.get(PEOPLE.FIRST_NAME);
                        String last = rec.get(PEOPLE.LAST_NAME);
                        result.put(uid, (first + " " + (last != null ? last : "")).trim());
                    } else {
                        String username = rec.get(USERS.USERNAME);
                        result.put(uid, username != null ? username : "Unknown");
                    }
                });
        return result;
    }
}
