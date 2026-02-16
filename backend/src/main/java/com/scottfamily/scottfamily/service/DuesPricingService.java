package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.util.List;

/**
 * Manages age-based dues pricing tiers.
 *
 * <p>Each tier has a label (e.g. "Adult"), an optional min/max age range,
 * and an amount in cents.  Tiers can be scoped to a specific reunion year
 * or be the global default (reunion_year IS NULL).</p>
 *
 * <p>When computing a person's dues amount the service finds the tier
 * whose age range matches the person's age on the reunion date and returns
 * the amount.  If no tier matches, the hard-coded fallback ($25) is used.</p>
 */
@Service
public class DuesPricingService {

    // ── Inline DSL refs ──
    private static final Table<?>              TBL        = DSL.table(DSL.name("dues_pricing_tiers"));
    private static final Field<Long>           ID         = DSL.field(DSL.name("id"),           Long.class);
    private static final Field<Integer>        YEAR       = DSL.field(DSL.name("reunion_year"), Integer.class);
    private static final Field<String>         LABEL      = DSL.field(DSL.name("label"),        String.class);
    private static final Field<Integer>        MIN_AGE    = DSL.field(DSL.name("min_age"),      Integer.class);
    private static final Field<Integer>        MAX_AGE    = DSL.field(DSL.name("max_age"),      Integer.class);
    private static final Field<Integer>        AMOUNT     = DSL.field(DSL.name("amount_cents"), Integer.class);
    private static final Field<Integer>        SORT_ORDER = DSL.field(DSL.name("sort_order"),   Integer.class);
    private static final Field<OffsetDateTime> CREATED_AT = DSL.field(DSL.name("created_at"),   OffsetDateTime.class);
    private static final Field<OffsetDateTime> UPDATED_AT = DSL.field(DSL.name("updated_at"),   OffsetDateTime.class);

    /** Hard-coded fallback if no tier matches. */
    public static final int FALLBACK_AMOUNT_CENTS = 2500;

    private final DSLContext dsl;

    public DuesPricingService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTO ──

    public record PricingTierDto(
            Long id,
            Integer reunionYear,
            String label,
            Integer minAge,
            Integer maxAge,
            int amountCents,
            int sortOrder
    ) {}

    // ── Read ──

    /**
     * Get tiers for a specific reunion year.
     * If no year-specific tiers exist, returns the global defaults (reunion_year IS NULL).
     */
    public List<PricingTierDto> getTiersForYear(int reunionYear) {
        // First try year-specific
        List<PricingTierDto> yearTiers = dsl.select(ID, YEAR, LABEL, MIN_AGE, MAX_AGE, AMOUNT, SORT_ORDER)
                .from(TBL)
                .where(YEAR.eq(reunionYear))
                .orderBy(SORT_ORDER.asc())
                .fetch(this::mapRecord);

        if (!yearTiers.isEmpty()) return yearTiers;

        // Fall back to global defaults
        return dsl.select(ID, YEAR, LABEL, MIN_AGE, MAX_AGE, AMOUNT, SORT_ORDER)
                .from(TBL)
                .where(YEAR.isNull())
                .orderBy(SORT_ORDER.asc())
                .fetch(this::mapRecord);
    }

    /** Get all global default tiers (reunion_year IS NULL). */
    public List<PricingTierDto> getDefaultTiers() {
        return dsl.select(ID, YEAR, LABEL, MIN_AGE, MAX_AGE, AMOUNT, SORT_ORDER)
                .from(TBL)
                .where(YEAR.isNull())
                .orderBy(SORT_ORDER.asc())
                .fetch(this::mapRecord);
    }

    /** Get year-specific tiers only (not defaults). */
    public List<PricingTierDto> getYearSpecificTiers(int reunionYear) {
        return dsl.select(ID, YEAR, LABEL, MIN_AGE, MAX_AGE, AMOUNT, SORT_ORDER)
                .from(TBL)
                .where(YEAR.eq(reunionYear))
                .orderBy(SORT_ORDER.asc())
                .fetch(this::mapRecord);
    }

    // ── Price resolution ──

    /**
     * Determine the dues amount for a person of a given age in the given reunion year.
     * Finds the first tier whose age range matches.
     */
    public int resolveAmount(int age, int reunionYear) {
        List<PricingTierDto> tiers = getTiersForYear(reunionYear);
        for (PricingTierDto tier : tiers) {
            if (ageInRange(age, tier.minAge(), tier.maxAge())) {
                return tier.amountCents();
            }
        }
        return FALLBACK_AMOUNT_CENTS;
    }

    /**
     * Determine dues amount from a date of birth string (yyyy-MM-dd).
     * Age is computed as of the current date.
     */
    public int resolveAmountByDob(String dateOfBirth, int reunionYear) {
        if (dateOfBirth == null || dateOfBirth.isBlank()) {
            return FALLBACK_AMOUNT_CENTS;
        }
        try {
            LocalDate dob = LocalDate.parse(dateOfBirth);
            int age = Period.between(dob, LocalDate.now()).getYears();
            return resolveAmount(age, reunionYear);
        } catch (Exception e) {
            return FALLBACK_AMOUNT_CENTS;
        }
    }

    // ── Write ──

    /** Save (insert or update) a single tier. */
    @Transactional
    public PricingTierDto saveTier(PricingTierDto tier) {
        if (tier.id() != null && tier.id() > 0) {
            dsl.update(TBL)
                    .set(YEAR,       tier.reunionYear())
                    .set(LABEL,      tier.label())
                    .set(MIN_AGE,    tier.minAge())
                    .set(MAX_AGE,    tier.maxAge())
                    .set(AMOUNT,     tier.amountCents())
                    .set(SORT_ORDER, tier.sortOrder())
                    .set(UPDATED_AT, OffsetDateTime.now())
                    .where(ID.eq(tier.id()))
                    .execute();
            return tier;
        } else {
            var result = dsl.insertInto(TBL)
                    .set(YEAR,       tier.reunionYear())
                    .set(LABEL,      tier.label())
                    .set(MIN_AGE,    tier.minAge())
                    .set(MAX_AGE,    tier.maxAge())
                    .set(AMOUNT,     tier.amountCents())
                    .set(SORT_ORDER, tier.sortOrder())
                    .returningResult(ID)
                    .fetchOne();
            Long newId = result != null ? result.get(ID) : null;
            return new PricingTierDto(newId, tier.reunionYear(), tier.label(),
                    tier.minAge(), tier.maxAge(), tier.amountCents(), tier.sortOrder());
        }
    }

    /**
     * Replace all tiers for a given reunion year (or defaults if year is null).
     * Deletes existing tiers and inserts the new list.
     */
    @Transactional
    public List<PricingTierDto> replaceTiers(Integer reunionYear, List<PricingTierDto> tiers) {
        if (reunionYear != null) {
            dsl.deleteFrom(TBL).where(YEAR.eq(reunionYear)).execute();
        } else {
            dsl.deleteFrom(TBL).where(YEAR.isNull()).execute();
        }

        for (int i = 0; i < tiers.size(); i++) {
            PricingTierDto t = tiers.get(i);
            dsl.insertInto(TBL)
                    .set(YEAR,       reunionYear)
                    .set(LABEL,      t.label())
                    .set(MIN_AGE,    t.minAge())
                    .set(MAX_AGE,    t.maxAge())
                    .set(AMOUNT,     t.amountCents())
                    .set(SORT_ORDER, i)
                    .execute();
        }

        return reunionYear != null ? getYearSpecificTiers(reunionYear) : getDefaultTiers();
    }

    /** Delete a single tier. */
    @Transactional
    public void deleteTier(Long id) {
        dsl.deleteFrom(TBL).where(ID.eq(id)).execute();
    }

    // ── Helpers ──

    private boolean ageInRange(int age, Integer min, Integer max) {
        if (min != null && age < min) return false;
        if (max != null && age > max) return false;
        return true;
    }

    private PricingTierDto mapRecord(Record rec) {
        return new PricingTierDto(
                rec.get(ID),
                rec.get(YEAR),
                rec.get(LABEL),
                rec.get(MIN_AGE),
                rec.get(MAX_AGE),
                rec.get(AMOUNT) != null ? rec.get(AMOUNT) : FALLBACK_AMOUNT_CENTS,
                rec.get(SORT_ORDER) != null ? rec.get(SORT_ORDER) : 0
        );
    }
}
