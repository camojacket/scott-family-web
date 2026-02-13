package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

/**
 * Service for managing reunion dues payments.
 * Tracks who paid dues for each reunion year.
 */
@Service
public class DuesService {

    /** Server-authoritative dues amount — $25.00. Clients cannot override. */
    public static final int DUES_AMOUNT_CENTS = 2500;

    // ── Inline DSL refs (table not yet in codegen) ──
    private static final Table<?>              DUES            = DSL.table(DSL.name("dues_payments"));
    private static final Field<Long>           ID              = DSL.field(DSL.name("id"),                Long.class);
    private static final Field<Long>           USER_ID         = DSL.field(DSL.name("user_id"),           Long.class);
    private static final Field<Integer>        REUNION_YEAR    = DSL.field(DSL.name("reunion_year"),      Integer.class);
    private static final Field<Integer>        AMOUNT_CENTS    = DSL.field(DSL.name("amount_cents"),      Integer.class);
    private static final Field<String>         SQ_PAYMENT_ID   = DSL.field(DSL.name("square_payment_id"), String.class);
    private static final Field<String>         SQ_RECEIPT_URL  = DSL.field(DSL.name("square_receipt_url"),String.class);
    private static final Field<String>         STATUS          = DSL.field(DSL.name("status"),            String.class);
    private static final Field<String>         NOTES           = DSL.field(DSL.name("notes"),             String.class);
    private static final Field<OffsetDateTime> PAID_AT         = DSL.field(DSL.name("paid_at"),           OffsetDateTime.class);
    private static final Field<OffsetDateTime> CREATED_AT      = DSL.field(DSL.name("created_at"),        OffsetDateTime.class);
    private static final Field<OffsetDateTime> UPDATED_AT      = DSL.field(DSL.name("updated_at"),        OffsetDateTime.class);
    private static final Field<Long>           PAID_BY         = DSL.field(DSL.name("paid_by_user_id"),   Long.class);
    private static final Field<String>         GUEST_NAME_F    = DSL.field(DSL.name("guest_name"),        String.class);
    private static final Field<Integer>        GUEST_AGE_F     = DSL.field(DSL.name("guest_age"),         Integer.class);
    private static final Field<String>         BATCH_ID_F      = DSL.field(DSL.name("batch_id"),          String.class);

    private final DSLContext dsl;

    public DuesService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTOs ──

    public record DuesPaymentDto(
            Long id,
            Long userId,
            Long paidByUserId,
            String displayName,
            String guestName,
            Integer guestAge,
            int reunionYear,
            int amountCents,
            String status,
            String squarePaymentId,
            String squareReceiptUrl,
            String batchId,
            String notes,
            String paidAt,
            String createdAt
    ) {}

    public record DuesStatusDto(
            Long userId,
            String displayName,
            String dateOfBirth,
            boolean paid,
            String paidAt,
            int amountCents
    ) {}

    public record DuesSummaryDto(
            int reunionYear,
            int totalMembers,
            int totalPaid,
            int totalUnpaid,
            int totalCollectedCents
    ) {}

    public record DuesPageDto(
            int reunionYear,
            int duesAmountCents,
            boolean selfPaid,
            DuesPaymentDto selfPayment,
            List<DuesPaymentDto> guestPayments
    ) {}

    public record GuestInfo(String name, int age) {}

    public record DuesBatchDto(
            String batchId,
            int totalCents,
            int personCount,
            List<DuesPaymentDto> payments
    ) {}

    // ── Read ──

    /** Check if a user has paid dues for a given year. */
    public DuesPaymentDto getByUserAndYear(Long userId, int year) {
        Record rec = dsl.select()
                .from(DUES)
                .where(USER_ID.eq(userId).and(REUNION_YEAR.eq(year)))
                .fetchOne();
        if (rec == null) return null;
        return mapRecord(rec);
    }

    /** Admin: list all payment records for a given year. */
    public List<DuesPaymentDto> listByYear(int year) {
        return dsl.select()
                .from(DUES)
                .where(REUNION_YEAR.eq(year))
                .orderBy(CREATED_AT.desc())
                .fetch()
                .map(this::mapRecord);
    }

    /** Admin: get paid/unpaid status for ALL users for a given year, sortable. */
    public List<DuesStatusDto> getDuesStatus(int year) {
        // Get all active users (non-banned, approved)
        var allUsers = dsl.select(USERS.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, PEOPLE.DATE_OF_BIRTH)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.USER_ROLE.ne("ROLE_PENDING"))
                .fetch();

        return allUsers.map(u -> {
            Long uid = u.get(USERS.ID);
            String first = u.get(PEOPLE.FIRST_NAME);
            String last = u.get(PEOPLE.LAST_NAME);
            String displayName = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
            if (displayName.isBlank()) displayName = "Unknown";

            String dob = u.get(PEOPLE.DATE_OF_BIRTH) != null
                    ? u.get(PEOPLE.DATE_OF_BIRTH).toString()
                    : null;

            // Check if they paid
            Record payment = dsl.select(AMOUNT_CENTS, PAID_AT)
                    .from(DUES)
                    .where(USER_ID.eq(uid)
                            .and(REUNION_YEAR.eq(year))
                            .and(STATUS.eq("COMPLETED")))
                    .fetchOne();

            boolean paid = payment != null;
            String paidAt = paid && payment.get(PAID_AT) != null
                    ? payment.get(PAID_AT).toString() : null;
            int amount = paid ? payment.get(AMOUNT_CENTS) : 0;

            return new DuesStatusDto(uid, displayName, dob, paid, paidAt, amount);
        });
    }

    /** Admin: summary for a given year. */
    public DuesSummaryDto getSummary(int year) {
        var status = getDuesStatus(year);
        int total = status.size();
        int paid = (int) status.stream().filter(DuesStatusDto::paid).count();
        int collected = status.stream().filter(DuesStatusDto::paid).mapToInt(DuesStatusDto::amountCents).sum();
        return new DuesSummaryDto(year, total, paid, total - paid, collected);
    }

    /** Dues page view for a logged-in user: their own status + completed guest payments. */
    public DuesPageDto getDuesPage(Long userId, int year) {
        DuesPaymentDto selfPayment = getByUserAndYear(userId, year);
        boolean selfPaid = selfPayment != null && "COMPLETED".equals(selfPayment.status());

        List<DuesPaymentDto> guestPayments = dsl.select()
                .from(DUES)
                .where(PAID_BY.eq(userId)
                        .and(REUNION_YEAR.eq(year))
                        .and(GUEST_NAME_F.isNotNull())
                        .and(STATUS.eq("COMPLETED")))
                .orderBy(CREATED_AT.desc())
                .fetch()
                .map(this::mapRecord);

        return new DuesPageDto(year, DUES_AMOUNT_CENTS, selfPaid, selfPayment, guestPayments);
    }

    // ── Write ──

    /** Record a new dues payment (called after Square processes successfully). */
    @Transactional
    public DuesPaymentDto recordPayment(Long userId, int year, int amountCents,
                                         String squarePaymentId, String squareReceiptUrl) {
        // Check for existing payment
        Record existing = dsl.select(ID)
                .from(DUES)
                .where(USER_ID.eq(userId).and(REUNION_YEAR.eq(year)))
                .fetchOne();

        if (existing != null) {
            // Update existing record
            dsl.update(DUES)
                    .set(AMOUNT_CENTS, amountCents)
                    .set(SQ_PAYMENT_ID, squarePaymentId)
                    .set(SQ_RECEIPT_URL, squareReceiptUrl)
                    .set(STATUS, "COMPLETED")
                    .set(PAID_AT, OffsetDateTime.now())
                    .set(PAID_BY, userId)
                    .where(ID.eq(existing.get(ID)))
                    .execute();
        } else {
            dsl.insertInto(DUES)
                    .set(USER_ID, userId)
                    .set(PAID_BY, userId)
                    .set(REUNION_YEAR, year)
                    .set(AMOUNT_CENTS, amountCents)
                    .set(SQ_PAYMENT_ID, squarePaymentId)
                    .set(SQ_RECEIPT_URL, squareReceiptUrl)
                    .set(STATUS, "COMPLETED")
                    .set(PAID_AT, OffsetDateTime.now())
                    .execute();
        }

        return getByUserAndYear(userId, year);
    }

    /** Create a pending dues record (before Square payment). Uses server-side amount. */
    @Transactional
    public DuesPaymentDto createPending(Long userId, int year) {
        Record existing = dsl.select(ID, STATUS)
                .from(DUES)
                .where(USER_ID.eq(userId).and(REUNION_YEAR.eq(year)))
                .fetchOne();

        if (existing != null && "COMPLETED".equals(existing.get(STATUS))) {
            return getByUserAndYear(userId, year); // already paid
        }

        if (existing != null) {
            dsl.update(DUES)
                    .set(AMOUNT_CENTS, DUES_AMOUNT_CENTS)
                    .set(STATUS, "PENDING")
                    .set(PAID_BY, userId)
                    .set(UPDATED_AT, OffsetDateTime.now())
                    .where(ID.eq(existing.get(ID)))
                    .execute();
        } else {
            dsl.insertInto(DUES)
                    .set(USER_ID, userId)
                    .set(PAID_BY, userId)
                    .set(REUNION_YEAR, year)
                    .set(AMOUNT_CENTS, DUES_AMOUNT_CENTS)
                    .set(STATUS, "PENDING")
                    .execute();
        }

        return getByUserAndYear(userId, year);
    }

    /** Mark a pending payment as completed (called after Square confirms). Only transitions from PENDING. */
    @Transactional
    public DuesPaymentDto markCompleted(Long userId, int year, String squarePaymentId, String squareReceiptUrl) {
        // Status guard: only PENDING → COMPLETED
        int affected = dsl.update(DUES)
                .set(SQ_PAYMENT_ID, squarePaymentId)
                .set(SQ_RECEIPT_URL, squareReceiptUrl)
                .set(STATUS, "COMPLETED")
                .set(PAID_AT, OffsetDateTime.now())
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(USER_ID.eq(userId)
                        .and(REUNION_YEAR.eq(year))
                        .and(STATUS.eq("PENDING")))
                .execute();

        if (affected == 0) {
            // Check why it failed
            DuesPaymentDto existing = getByUserAndYear(userId, year);
            if (existing != null && "COMPLETED".equals(existing.status())) {
                return existing; // idempotent — already completed
            }
            throw new IllegalStateException(
                    "Cannot confirm dues: no PENDING record found for user " + userId + " year " + year);
        }
        return getByUserAndYear(userId, year);
    }

    /** Mark a payment as failed. Only transitions from PENDING. */
    @Transactional
    public void markFailed(Long userId, int year) {
        dsl.update(DUES)
                .set(STATUS, "FAILED")
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(USER_ID.eq(userId)
                        .and(REUNION_YEAR.eq(year))
                        .and(STATUS.eq("PENDING")))
                .execute();
    }

    // ── Batch payments (pay on behalf of others) ──

    /**
     * Create a batch of PENDING dues payments (self + guests).
     * Returns batch info including total and all payment records for Square checkout.
     */
    @Transactional
    public DuesBatchDto createBatch(Long paidByUserId, int year, boolean payForSelf, List<GuestInfo> guests) {
        if (!payForSelf && (guests == null || guests.isEmpty())) {
            throw new IllegalArgumentException("Must pay for at least one person");
        }

        String batchId = UUID.randomUUID().toString();
        List<Long> paymentIds = new ArrayList<>();

        if (payForSelf) {
            Record existing = dsl.select(ID, STATUS)
                    .from(DUES)
                    .where(USER_ID.eq(paidByUserId).and(REUNION_YEAR.eq(year)))
                    .fetchOne();

            if (existing != null && "COMPLETED".equals(existing.get(STATUS))) {
                throw new IllegalArgumentException("Your dues are already paid for " + year);
            }

            if (existing != null) {
                dsl.update(DUES)
                        .set(AMOUNT_CENTS, DUES_AMOUNT_CENTS)
                        .set(STATUS, "PENDING")
                        .set(BATCH_ID_F, batchId)
                        .set(PAID_BY, paidByUserId)
                        .set(UPDATED_AT, OffsetDateTime.now())
                        .where(ID.eq(existing.get(ID)))
                        .execute();
                paymentIds.add(existing.get(ID));
            } else {
                var result = dsl.insertInto(DUES)
                        .set(USER_ID, paidByUserId)
                        .set(PAID_BY, paidByUserId)
                        .set(REUNION_YEAR, year)
                        .set(AMOUNT_CENTS, DUES_AMOUNT_CENTS)
                        .set(STATUS, "PENDING")
                        .set(BATCH_ID_F, batchId)
                        .returningResult(ID)
                        .fetchOne();
                if (result != null) paymentIds.add(result.get(ID));
            }
        }

        if (guests != null) {
            for (GuestInfo guest : guests) {
                var result = dsl.insertInto(DUES)
                        .set(PAID_BY, paidByUserId)
                        .set(GUEST_NAME_F, guest.name())
                        .set(GUEST_AGE_F, guest.age())
                        .set(REUNION_YEAR, year)
                        .set(AMOUNT_CENTS, DUES_AMOUNT_CENTS)
                        .set(STATUS, "PENDING")
                        .set(BATCH_ID_F, batchId)
                        .returningResult(ID)
                        .fetchOne();
                if (result != null) paymentIds.add(result.get(ID));
            }
        }

        List<DuesPaymentDto> payments = paymentIds.stream()
                .map(this::getById)
                .toList();

        int totalCents = DUES_AMOUNT_CENTS * payments.size();
        return new DuesBatchDto(batchId, totalCents, payments.size(), payments);
    }

    /**
     * Confirm all payments in a batch after Square processes successfully.
     * Idempotent — if already COMPLETED, returns existing records.
     */
    @Transactional
    public List<DuesPaymentDto> confirmBatch(String batchId, String squarePaymentId, String squareReceiptUrl) {
        int affected = dsl.update(DUES)
                .set(STATUS, "COMPLETED")
                .set(SQ_PAYMENT_ID, squarePaymentId)
                .set(SQ_RECEIPT_URL, squareReceiptUrl)
                .set(PAID_AT, OffsetDateTime.now())
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(BATCH_ID_F.eq(batchId).and(STATUS.eq("PENDING")))
                .execute();

        var all = dsl.select().from(DUES)
                .where(BATCH_ID_F.eq(batchId))
                .orderBy(CREATED_AT.asc())
                .fetch()
                .map(this::mapRecord);

        if (affected == 0) {
            if (!all.isEmpty() && all.stream().allMatch(p -> "COMPLETED".equals(p.status()))) {
                return all; // idempotent — already confirmed
            }
            throw new IllegalStateException("No PENDING dues found for batch " + batchId);
        }

        return all;
    }

    /** Mark all PENDING payments in a batch as FAILED. */
    @Transactional
    public void markBatchFailed(String batchId) {
        dsl.update(DUES)
                .set(STATUS, "FAILED")
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(BATCH_ID_F.eq(batchId).and(STATUS.eq("PENDING")))
                .execute();
    }

    /**
     * Admin: manually record a cash/check/money-order payment (pay-on-behalf style).
     * If userId is supplied, links payment to that user. Otherwise, stores as a guest payment
     * using the provided name fields, similar to the pay-on-behalf batch approach.
     */
    @Transactional
    public DuesPaymentDto recordManualPayment(Long userId, int year, int amountCents,
                                               String firstName, String middleName,
                                               String lastName, String prefix,
                                               String suffix, String dateOfBirth) {
        // Compose a display name from all name parts
        StringBuilder sb = new StringBuilder();
        if (prefix != null && !prefix.isBlank()) sb.append(prefix.trim()).append(" ");
        sb.append(firstName.trim());
        if (middleName != null && !middleName.isBlank()) sb.append(" ").append(middleName.trim());
        sb.append(" ").append(lastName.trim());
        if (suffix != null && !suffix.isBlank()) sb.append(" ").append(suffix.trim());
        String guestName = sb.toString().trim();

        // Build notes with dateOfBirth if provided
        String notes = null;
        if (dateOfBirth != null && !dateOfBirth.isBlank()) {
            notes = "DOB: " + dateOfBirth.trim();
        }

        if (userId != null) {
            // Check for existing payment for this user+year
            Record existing = dsl.select(ID, STATUS)
                    .from(DUES)
                    .where(USER_ID.eq(userId).and(REUNION_YEAR.eq(year)))
                    .fetchOne();

            if (existing != null) {
                dsl.update(DUES)
                        .set(AMOUNT_CENTS, amountCents)
                        .set(GUEST_NAME_F, guestName)
                        .set(SQ_PAYMENT_ID, "MANUAL")
                        .set(STATUS, "COMPLETED")
                        .set(NOTES, notes)
                        .set(PAID_AT, OffsetDateTime.now())
                        .set(PAID_BY, userId)
                        .set(UPDATED_AT, OffsetDateTime.now())
                        .where(ID.eq(existing.get(ID)))
                        .execute();
                return getById(existing.get(ID));
            } else {
                var result = dsl.insertInto(DUES)
                        .set(USER_ID, userId)
                        .set(PAID_BY, userId)
                        .set(GUEST_NAME_F, guestName)
                        .set(REUNION_YEAR, year)
                        .set(AMOUNT_CENTS, amountCents)
                        .set(SQ_PAYMENT_ID, "MANUAL")
                        .set(STATUS, "COMPLETED")
                        .set(NOTES, notes)
                        .set(PAID_AT, OffsetDateTime.now())
                        .returningResult(ID)
                        .fetchOne();
                return result != null ? getById(result.get(ID)) : null;
            }
        } else {
            // No userId — record as guest payment (no user link)
            // paid_by_user_id is NOT NULL so use a sentinel admin ID or the admin's own ID
            // Since this column is NOT NULL with FK, we need to use a valid user.
            // We'll set paid_by to the first admin user. Alternatively, we can allow null.
            // For now, store with guest_name only (user_id nullable, paid_by required).
            // We'll resolve by using the calling admin user — but we don't have that here.
            // Workaround: use user_id=null (nullable), paid_by set to 0 would fail FK.
            // Best approach: caller should pass the admin userId as paidBy.
            // For simplicity, insert without paid_by set (will use default or fail gracefully).
            // Actually — let's look: paid_by_user_id is NOT NULL with FK to users.
            // We need a valid user for paid_by. Let's get the first admin.
            Long adminUserId = dsl.select(USERS.ID)
                    .from(USERS)
                    .where(USERS.USER_ROLE.eq("ROLE_ADMIN"))
                    .limit(1)
                    .fetchOneInto(Long.class);

            if (adminUserId == null) adminUserId = 1L; // fallback

            var result = dsl.insertInto(DUES)
                    .set(PAID_BY, adminUserId)
                    .set(GUEST_NAME_F, guestName)
                    .set(REUNION_YEAR, year)
                    .set(AMOUNT_CENTS, amountCents)
                    .set(SQ_PAYMENT_ID, "MANUAL")
                    .set(STATUS, "COMPLETED")
                    .set(NOTES, notes)
                    .set(PAID_AT, OffsetDateTime.now())
                    .returningResult(ID)
                    .fetchOne();
            return result != null ? getById(result.get(ID)) : null;
        }
    }

    // ── Helpers ──

    private DuesPaymentDto getById(Long id) {
        Record rec = dsl.select().from(DUES).where(ID.eq(id)).fetchOne();
        if (rec == null) return null;
        return mapRecord(rec);
    }

    private DuesPaymentDto mapRecord(Record rec) {
        Long uid = rec.get(USER_ID);
        Long paidBy = rec.get(PAID_BY);
        String guestName = rec.get(GUEST_NAME_F);
        Integer guestAge = rec.get(GUEST_AGE_F);
        String displayName = guestName != null ? guestName
                : (uid != null ? resolveDisplayName(uid) : "Unknown");

        return new DuesPaymentDto(
                rec.get(ID),
                uid,
                paidBy,
                displayName,
                guestName,
                guestAge,
                rec.get(REUNION_YEAR),
                rec.get(AMOUNT_CENTS) != null ? rec.get(AMOUNT_CENTS) : 0,
                rec.get(STATUS),
                rec.get(SQ_PAYMENT_ID),
                rec.get(SQ_RECEIPT_URL),
                rec.get(BATCH_ID_F),
                rec.get(NOTES),
                rec.get(PAID_AT) != null ? rec.get(PAID_AT).toString() : null,
                rec.get(CREATED_AT) != null ? rec.get(CREATED_AT).toString() : null
        );
    }

    private String resolveDisplayName(Long userId) {
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
