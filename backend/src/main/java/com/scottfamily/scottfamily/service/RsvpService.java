package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

/**
 * Service for managing reunion RSVPs.
 * Uses inline DSL references for the new reunion_rsvps table
 * (jOOQ codegen may not include it yet).
 */
@Service
public class RsvpService {

    // ── Inline DSL refs (table not yet in codegen) ──
    private static final Table<?>            RSVPS        = DSL.table(DSL.name("reunion_rsvps"));
    private static final Field<Long>         ID           = DSL.field(DSL.name("id"),           Long.class);
    private static final Field<Long>         USER_ID      = DSL.field(DSL.name("user_id"),      Long.class);
    private static final Field<Boolean>      ATTENDING    = DSL.field(DSL.name("attending"),     Boolean.class);
    private static final Field<Integer>      EXTRA_GUESTS = DSL.field(DSL.name("extra_guests"),  Integer.class);
    private static final Field<String>       NOTES        = DSL.field(DSL.name("notes"),         String.class);
    private static final Field<OffsetDateTime> UPDATED_AT = DSL.field(DSL.name("updated_at"),    OffsetDateTime.class);

    private final DSLContext dsl;

    public RsvpService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTOs ──

    public record RsvpDto(
            Long userId,
            String displayName,
            boolean attending,
            int extraGuests,
            String notes,
            String updatedAt
    ) {}

    public record RsvpSummary(
            int totalAttending,
            int totalNotAttending,
            int totalExtraGuests,
            int totalHeadcount
    ) {}

    // ── Read ──

    /** Get the current user's RSVP, or null if they haven't responded. */
    public RsvpDto getByUserId(Long userId) {
        Record rec = dsl.select(ATTENDING, EXTRA_GUESTS, NOTES, UPDATED_AT)
                .from(RSVPS)
                .where(USER_ID.eq(userId))
                .fetchOne();

        if (rec == null) return null;

        String displayName = resolveDisplayName(userId);

        return new RsvpDto(
                userId,
                displayName,
                Boolean.TRUE.equals(rec.get(ATTENDING)),
                rec.get(EXTRA_GUESTS) != null ? rec.get(EXTRA_GUESTS) : 0,
                rec.get(NOTES),
                rec.get(UPDATED_AT) != null ? rec.get(UPDATED_AT).toString() : null
        );
    }

    /** Admin: list all RSVPs. */
    public List<RsvpDto> listAll() {
        return dsl.select(USER_ID, ATTENDING, EXTRA_GUESTS, NOTES, UPDATED_AT)
                .from(RSVPS)
                .orderBy(UPDATED_AT.desc())
                .fetch()
                .map(rec -> {
                    Long uid = rec.get(USER_ID);
                    return new RsvpDto(
                            uid,
                            resolveDisplayName(uid),
                            Boolean.TRUE.equals(rec.get(ATTENDING)),
                            rec.get(EXTRA_GUESTS) != null ? rec.get(EXTRA_GUESTS) : 0,
                            rec.get(NOTES),
                            rec.get(UPDATED_AT) != null ? rec.get(UPDATED_AT).toString() : null
                    );
                });
    }

    /** Summary stats for the admin dashboard. */
    public RsvpSummary getSummary() {
        var recs = dsl.select(ATTENDING, EXTRA_GUESTS)
                .from(RSVPS)
                .fetch();

        int attending = 0, notAttending = 0, extraGuests = 0;
        for (var r : recs) {
            if (Boolean.TRUE.equals(r.get(ATTENDING))) {
                attending++;
                extraGuests += r.get(EXTRA_GUESTS) != null ? r.get(EXTRA_GUESTS) : 0;
            } else {
                notAttending++;
            }
        }

        return new RsvpSummary(attending, notAttending, extraGuests, attending + extraGuests);
    }

    // ── Write ──

    /** Upsert the current user's RSVP. */
    public RsvpDto upsert(Long userId, boolean attending, int extraGuests, String notes) {
        int updated = dsl.update(RSVPS)
                .set(ATTENDING, attending)
                .set(EXTRA_GUESTS, attending ? extraGuests : 0)
                .set(NOTES, notes)
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(USER_ID.eq(userId))
                .execute();

        if (updated == 0) {
            dsl.insertInto(RSVPS)
                    .set(USER_ID, userId)
                    .set(ATTENDING, attending)
                    .set(EXTRA_GUESTS, attending ? extraGuests : 0)
                    .set(NOTES, notes)
                    .set(UPDATED_AT, OffsetDateTime.now())
                    .execute();
        }

        return getByUserId(userId);
    }

    /** Admin: reset all RSVPs (typically after reunion is over). */
    public int resetAll() {
        return dsl.deleteFrom(RSVPS).execute();
    }

    // ── Helpers ──

    private String resolveDisplayName(Long userId) {
        // Join users → people to get name
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

        // Fallback to username
        var usernameRec = dsl.select(USERS.USERNAME)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne();
        return usernameRec != null ? usernameRec.get(USERS.USERNAME) : "Unknown";
    }
}
