package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service for managing voluntary donations (not tied to reunion dues).
 * Supports both authenticated member donations and anonymous/guest donations.
 *
 * Lifecycle: PENDING → COMPLETED (via Square webhook) or PENDING → FAILED (timeout/cancel).
 */
@Service
public class DonationService {

    private static final Logger log = LoggerFactory.getLogger(DonationService.class);

    /** Minimum donation amount: $1.00 (Square minimum). */
    public static final int MIN_AMOUNT_CENTS = 100;

    /** Maximum donation amount: $10,000. */
    public static final int MAX_AMOUNT_CENTS = 1_000_000;

    // ── Inline DSL refs (table not yet in codegen) ──
    private static final Table<?>              DONATIONS       = DSL.table(DSL.name("donations"));
    private static final Field<Long>           ID              = DSL.field(DSL.name("id"),                Long.class);
    private static final Field<Long>           USER_ID         = DSL.field(DSL.name("user_id"),           Long.class);
    private static final Field<String>         GUEST_NAME      = DSL.field(DSL.name("guest_name"),        String.class);
    private static final Field<String>         GUEST_EMAIL     = DSL.field(DSL.name("guest_email"),       String.class);
    private static final Field<Integer>        AMOUNT_CENTS    = DSL.field(DSL.name("amount_cents"),      Integer.class);
    private static final Field<String>         NOTE            = DSL.field(DSL.name("note"),              String.class);
    private static final Field<String>         STATUS          = DSL.field(DSL.name("status"),            String.class);
    private static final Field<String>         SQ_PAYMENT_ID   = DSL.field(DSL.name("square_payment_id"), String.class);
    private static final Field<String>         SQ_RECEIPT_URL  = DSL.field(DSL.name("square_receipt_url"),String.class);
    private static final Field<Integer>        REUNION_YEAR    = DSL.field(DSL.name("reunion_year"),      Integer.class);
    private static final Field<OffsetDateTime> PAID_AT         = DSL.field(DSL.name("paid_at"),           OffsetDateTime.class);
    private static final Field<OffsetDateTime> CREATED_AT      = DSL.field(DSL.name("created_at"),        OffsetDateTime.class);
    private static final Field<OffsetDateTime> UPDATED_AT      = DSL.field(DSL.name("updated_at"),        OffsetDateTime.class);

    private final DSLContext dsl;
    private final UserHelper userHelper;

    public DonationService(DSLContext dsl, UserHelper userHelper) {
        this.dsl = dsl;
        this.userHelper = userHelper;
    }

    // ── DTOs ──

    public record DonationDto(
            Long id,
            Long userId,
            String displayName,
            String guestName,
            String guestEmail,
            int amountCents,
            String note,
            String status,
            String squarePaymentId,
            String squareReceiptUrl,
            Integer reunionYear,
            String paidAt,
            String createdAt
    ) {}

    public record DonationSummaryDto(
            int totalDonations,
            int totalAmountCents,
            int pendingCount,
            int completedCount
    ) {}

    public record CreateDonationRequest(
            int amountCents,
            String note,
            Integer reunionYear
    ) {}

    public record CreateGuestDonationRequest(
            String name,
            String email,
            int amountCents,
            String note
    ) {}

    // ── Read ──

    /** Get a single donation by ID. */
    public DonationDto getById(Long donationId) {
        Record rec = dsl.select().from(DONATIONS).where(ID.eq(donationId)).fetchOne();
        if (rec == null) return null;
        return mapRecord(rec);
    }

    /** Find a donation by its Square payment ID (for webhook/refund reconciliation). */
    public DonationDto findBySquarePaymentId(String squarePaymentId) {
        Record rec = dsl.select().from(DONATIONS)
                .where(SQ_PAYMENT_ID.eq(squarePaymentId))
                .fetchOne();
        if (rec == null) return null;
        return mapRecord(rec);
    }

    /** Get all donations for a specific user (authenticated donors). */
    public List<DonationDto> getByUser(Long userId) {
        var records = dsl.select().from(DONATIONS)
                .where(USER_ID.eq(userId))
                .orderBy(CREATED_AT.desc())
                .fetch();
        return mapRecords(records);
    }

    /** Admin: list all donations, optionally filtered by status. */
    public List<DonationDto> listAll(String statusFilter, int offset, int limit) {
        var condition = statusFilter != null && !statusFilter.isBlank()
                ? STATUS.eq(statusFilter)
                : DSL.noCondition();
        var records = dsl.select().from(DONATIONS)
                .where(condition)
                .orderBy(CREATED_AT.desc())
                .offset(offset)
                .limit(limit)
                .fetch();
        return mapRecords(records);
    }

    /** Admin: summary stats. */
    public DonationSummaryDto getSummary() {
        var records = dsl.select(STATUS, DSL.count(), DSL.sum(AMOUNT_CENTS))
                .from(DONATIONS)
                .groupBy(STATUS)
                .fetch();

        int total = 0, totalAmount = 0, pending = 0, completed = 0;
        for (var r : records) {
            String s = r.get(STATUS);
            int cnt = r.get(DSL.count());
            Integer amt = r.get(DSL.sum(AMOUNT_CENTS), Integer.class);
            total += cnt;
            if (amt != null) totalAmount += amt;
            if ("PENDING".equals(s)) pending = cnt;
            if ("COMPLETED".equals(s)) completed = cnt;
        }
        return new DonationSummaryDto(total, totalAmount, pending, completed);
    }

    // ── Write ──

    /**
     * Create a PENDING donation for an authenticated user.
     * Returns the donation ID for use in the Square checkout reference.
     */
    @Transactional
    public DonationDto createPending(Long userId, CreateDonationRequest req) {
        validateAmount(req.amountCents());

        var result = dsl.insertInto(DONATIONS)
                .set(USER_ID, userId)
                .set(AMOUNT_CENTS, req.amountCents())
                .set(NOTE, trimOrNull(req.note()))
                .set(REUNION_YEAR, req.reunionYear())
                .set(STATUS, "PENDING")
                .returningResult(ID)
                .fetchOne();

        Long donationId = result != null ? result.get(ID) : null;
        if (donationId == null) throw new RuntimeException("Failed to create donation");

        return getById(donationId);
    }

    /**
     * Create a PENDING donation for a guest (unauthenticated) donor.
     * Stores guest name and email for receipt purposes.
     */
    @Transactional
    public DonationDto createGuestPending(CreateGuestDonationRequest req) {
        validateAmount(req.amountCents());

        if (req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Name is required for guest donations");
        }

        var result = dsl.insertInto(DONATIONS)
                .set(GUEST_NAME, req.name().trim())
                .set(GUEST_EMAIL, trimOrNull(req.email()))
                .set(AMOUNT_CENTS, req.amountCents())
                .set(NOTE, trimOrNull(req.note()))
                .set(STATUS, "PENDING")
                .returningResult(ID)
                .fetchOne();

        Long donationId = result != null ? result.get(ID) : null;
        if (donationId == null) throw new RuntimeException("Failed to create guest donation");

        return getById(donationId);
    }

    /**
     * Confirm a donation after Square payment succeeds.
     * Only transitions PENDING → COMPLETED. Idempotent.
     */
    @Transactional
    public DonationDto confirmDonation(Long donationId, String squarePaymentId, String squareReceiptUrl) {
        int affected = dsl.update(DONATIONS)
                .set(STATUS, "COMPLETED")
                .set(SQ_PAYMENT_ID, squarePaymentId)
                .set(SQ_RECEIPT_URL, squareReceiptUrl)
                .set(PAID_AT, OffsetDateTime.now())
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(ID.eq(donationId).and(STATUS.in("PENDING", "FAILED")))
                .execute();

        if (affected == 0) {
            DonationDto existing = getById(donationId);
            if (existing != null && "COMPLETED".equals(existing.status())) {
                return existing; // idempotent
            }
            throw new IllegalStateException("No PENDING donation found with ID " + donationId);
        }

        return getById(donationId);
    }

    /** Mark a PENDING donation as FAILED. */
    @Transactional
    public void markFailed(Long donationId) {
        dsl.update(DONATIONS)
                .set(STATUS, "FAILED")
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(ID.eq(donationId).and(STATUS.eq("PENDING")))
                .execute();
    }

    /** Mark a donation as REFUNDED (admin action). */
    @Transactional
    public void markRefunded(Long donationId, String notes) {
        dsl.update(DONATIONS)
                .set(STATUS, "REFUNDED")
                .set(NOTE, notes)
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(ID.eq(donationId).and(STATUS.eq("COMPLETED")))
                .execute();
    }

    /**
     * Cancel stale PENDING donations older than the given number of hours.
     * Called by scheduled cleanup job.
     *
     * @return the number of records marked FAILED
     */
    @Transactional
    public int cancelStalePending(int maxAgeHours) {
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(maxAgeHours);
        return dsl.update(DONATIONS)
                .set(STATUS, "FAILED")
                .set(NOTE, "Auto-cancelled: checkout abandoned")
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(STATUS.eq("PENDING").and(CREATED_AT.lt(cutoff)))
                .execute();
    }

    // ── Helpers ──

    private void validateAmount(int amountCents) {
        if (amountCents < MIN_AMOUNT_CENTS) {
            throw new IllegalArgumentException("Minimum donation is $1.00");
        }
        if (amountCents > MAX_AMOUNT_CENTS) {
            throw new IllegalArgumentException("Maximum donation is $10,000.00");
        }
    }

    private String trimOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        return s.trim();
    }

    private List<DonationDto> mapRecords(List<? extends Record> records) {
        if (records.isEmpty()) return List.of();

        // Batch-resolve user display names
        Set<Long> userIds = records.stream()
                .map(r -> r.get(USER_ID))
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, String> userNames = userHelper.batchResolveDisplayNames(userIds);

        return records.stream()
                .map(r -> mapRecord(r, userNames))
                .toList();
    }

    private DonationDto mapRecord(Record rec) {
        Long uid = rec.get(USER_ID);
        String displayName;
        if (uid != null) {
            displayName = userHelper.resolveDisplayName(uid);
        } else if (rec.get(GUEST_NAME) != null) {
            displayName = rec.get(GUEST_NAME);
        } else {
            displayName = "Anonymous";
        }

        return buildDto(rec, displayName);
    }

    private DonationDto mapRecord(Record rec, Map<Long, String> userNames) {
        Long uid = rec.get(USER_ID);
        String displayName;
        if (uid != null) {
            displayName = userNames.getOrDefault(uid, "Unknown");
        } else if (rec.get(GUEST_NAME) != null) {
            displayName = rec.get(GUEST_NAME);
        } else {
            displayName = "Anonymous";
        }

        return buildDto(rec, displayName);
    }

    private DonationDto buildDto(Record rec, String displayName) {
        return new DonationDto(
                rec.get(ID),
                rec.get(USER_ID),
                displayName,
                rec.get(GUEST_NAME),
                rec.get(GUEST_EMAIL),
                rec.get(AMOUNT_CENTS) != null ? rec.get(AMOUNT_CENTS) : 0,
                rec.get(NOTE),
                rec.get(STATUS),
                rec.get(SQ_PAYMENT_ID),
                rec.get(SQ_RECEIPT_URL),
                rec.get(REUNION_YEAR),
                rec.get(PAID_AT) != null ? rec.get(PAID_AT).toString() : null,
                rec.get(CREATED_AT) != null ? rec.get(CREATED_AT).toString() : null
        );
    }
}
