package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Manages the configurable "Reunion Due Period" — the date window during which
 * dues payments apply to a particular reunion year.
 *
 * <p>Admins set a start date, end date, and reunion year. When a user visits
 * the dues page the active period is used to determine which reunion year
 * their payment counts toward. If today is outside any configured period
 * we fall back to the current calendar year.</p>
 */
@Service
public class DuePeriodService {

    // ── Inline DSL refs (table may not yet exist in codegen) ──
    private static final Table<?> TBL = DSL.table(DSL.name("reunion_due_periods"));
    private static final Field<Long>           ID          = DSL.field(DSL.name("id"),           Long.class);
    private static final Field<Integer>        YEAR        = DSL.field(DSL.name("reunion_year"), Integer.class);
    private static final Field<LocalDate>      START_DATE  = DSL.field(DSL.name("start_date"),   LocalDate.class);
    private static final Field<LocalDate>      END_DATE    = DSL.field(DSL.name("end_date"),     LocalDate.class);
    private static final Field<OffsetDateTime> CREATED_AT  = DSL.field(DSL.name("created_at"),   OffsetDateTime.class);
    private static final Field<OffsetDateTime> UPDATED_AT  = DSL.field(DSL.name("updated_at"),   OffsetDateTime.class);

    private final DSLContext dsl;

    public DuePeriodService(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** Create the table if it doesn't exist yet. */
    @PostConstruct
    void ensureTable() {
        dsl.createTableIfNotExists(TBL)
                .column(ID, SQLDataType.BIGINT.identity(true))
                .column(YEAR, SQLDataType.INTEGER.nullable(false))
                .column(START_DATE, SQLDataType.LOCALDATE.nullable(false))
                .column(END_DATE, SQLDataType.LOCALDATE.nullable(false))
                .column(CREATED_AT, SQLDataType.OFFSETDATETIME.defaultValue(DSL.currentOffsetDateTime()))
                .column(UPDATED_AT, SQLDataType.OFFSETDATETIME.defaultValue(DSL.currentOffsetDateTime()))
                .constraints(DSL.primaryKey(ID))
                .execute();
    }

    // ── DTOs ──

    public record DuePeriodDto(
            Long id,
            int reunionYear,
            String startDate,
            String endDate
    ) {}

    // ── Read ──

    /**
     * Return the period that is currently active (today falls between
     * start_date and end_date inclusive). If none is active, returns null.
     */
    public DuePeriodDto getActivePeriod() {
        LocalDate today = LocalDate.now();
        Record rec = dsl.select(ID, YEAR, START_DATE, END_DATE)
                .from(TBL)
                .where(START_DATE.le(today).and(END_DATE.ge(today)))
                .orderBy(END_DATE.desc())
                .limit(1)
                .fetchOne();
        return rec != null ? mapRecord(rec) : null;
    }

    /** Return the most recently configured period (regardless of date). */
    public DuePeriodDto getLatestPeriod() {
        Record rec = dsl.select(ID, YEAR, START_DATE, END_DATE)
                .from(TBL)
                .orderBy(UPDATED_AT.desc())
                .limit(1)
                .fetchOne();
        return rec != null ? mapRecord(rec) : null;
    }

    /**
     * Determine the reunion year that should be used for dues.
     * If an active period exists, use its reunion year.
     * Otherwise, fall back to the current calendar year.
     */
    public int resolveReunionYear() {
        DuePeriodDto active = getActivePeriod();
        return active != null ? active.reunionYear() : java.time.Year.now().getValue();
    }

    // ── Write ──

    /** Save (insert or update) the due period. Only one row is kept. */
    @Transactional
    public DuePeriodDto save(int reunionYear, LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("End date must be on or after start date");
        }

        Record existing = dsl.select(ID).from(TBL).limit(1).fetchOne();

        if (existing != null) {
            dsl.update(TBL)
                    .set(YEAR, reunionYear)
                    .set(START_DATE, startDate)
                    .set(END_DATE, endDate)
                    .set(UPDATED_AT, OffsetDateTime.now())
                    .where(ID.eq(existing.get(ID)))
                    .execute();
        } else {
            dsl.insertInto(TBL)
                    .set(YEAR, reunionYear)
                    .set(START_DATE, startDate)
                    .set(END_DATE, endDate)
                    .execute();
        }

        return getLatestPeriod();
    }

    // ── Helpers ──

    private DuePeriodDto mapRecord(Record rec) {
        return new DuePeriodDto(
                rec.get(ID),
                rec.get(YEAR),
                rec.get(START_DATE).toString(),
                rec.get(END_DATE).toString()
        );
    }
}
