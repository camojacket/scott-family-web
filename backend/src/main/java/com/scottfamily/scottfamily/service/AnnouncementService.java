package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnnouncementService {

    private static final Table<?> ANNOUNCEMENTS = DSL.table(DSL.name("announcements"));
    private static final Field<Long>          F_ID         = DSL.field(DSL.name("id"),          Long.class);
    private static final Field<String>        F_BANNER     = DSL.field(DSL.name("banner_text"), String.class);
    private static final Field<String>        F_BODY       = DSL.field(DSL.name("body"),        String.class);
    private static final Field<Boolean>       F_ACTIVE     = DSL.field(DSL.name("active"),      Boolean.class);
    private static final Field<LocalDateTime> F_CREATED_AT = DSL.field(DSL.name("created_at"),  LocalDateTime.class);
    private static final Field<LocalDateTime> F_UPDATED_AT = DSL.field(DSL.name("updated_at"),  LocalDateTime.class);

    private final DSLContext dsl;

    public AnnouncementService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTOs ──

    public record AnnouncementDto(
            Long id,
            String bannerText,
            String body,
            boolean active,
            String createdAt,
            String updatedAt
    ) {}

    public record CreateAnnouncementRequest(String bannerText, String body) {}
    public record UpdateAnnouncementRequest(String bannerText, String body, Boolean active) {}

    // ── Queries ──

    /** Active announcements — public */
    public List<AnnouncementDto> getActive() {
        return dsl.select(F_ID, F_BANNER, F_BODY, F_ACTIVE, F_CREATED_AT, F_UPDATED_AT)
                .from(ANNOUNCEMENTS)
                .where(F_ACTIVE.eq(true))
                .orderBy(F_CREATED_AT.desc())
                .fetch(this::toDto);
    }

    /** All announcements — admin */
    public List<AnnouncementDto> getAll() {
        return dsl.select(F_ID, F_BANNER, F_BODY, F_ACTIVE, F_CREATED_AT, F_UPDATED_AT)
                .from(ANNOUNCEMENTS)
                .orderBy(F_CREATED_AT.desc())
                .fetch(this::toDto);
    }

    /** Create announcement — admin */
    public AnnouncementDto create(CreateAnnouncementRequest req) {
        LocalDateTime now = LocalDateTime.now();
        Record r = dsl.insertInto(ANNOUNCEMENTS)
                .set(F_BANNER, req.bannerText())
                .set(F_BODY, req.body())
                .set(F_ACTIVE, true)
                .set(F_CREATED_AT, now)
                .set(F_UPDATED_AT, now)
                .returningResult(F_ID, F_BANNER, F_BODY, F_ACTIVE, F_CREATED_AT, F_UPDATED_AT)
                .fetchOne();
        return toDto(r);
    }

    /** Update announcement — admin */
    public AnnouncementDto update(Long id, UpdateAnnouncementRequest req) {
        var stmt = dsl.update(ANNOUNCEMENTS).set(F_UPDATED_AT, LocalDateTime.now());
        if (req.bannerText() != null) stmt = stmt.set(F_BANNER, req.bannerText());
        if (req.body() != null)       stmt = stmt.set(F_BODY, req.body());
        if (req.active() != null)     stmt = stmt.set(F_ACTIVE, req.active());
        stmt.where(F_ID.eq(id)).execute();

        return dsl.select(F_ID, F_BANNER, F_BODY, F_ACTIVE, F_CREATED_AT, F_UPDATED_AT)
                .from(ANNOUNCEMENTS)
                .where(F_ID.eq(id))
                .fetchOne(this::toDto);
    }

    /** Delete announcement — admin */
    public void delete(Long id) {
        dsl.deleteFrom(ANNOUNCEMENTS).where(F_ID.eq(id)).execute();
    }

    // ── Mapper ──

    private AnnouncementDto toDto(Record r) {
        return new AnnouncementDto(
                r.get(F_ID),
                r.get(F_BANNER),
                r.get(F_BODY),
                Boolean.TRUE.equals(r.get(F_ACTIVE)),
                r.get(F_CREATED_AT) != null ? r.get(F_CREATED_AT).toString() : null,
                r.get(F_UPDATED_AT) != null ? r.get(F_UPDATED_AT).toString() : null
        );
    }
}
