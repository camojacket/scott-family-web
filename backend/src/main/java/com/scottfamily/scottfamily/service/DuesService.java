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
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

/**
 * Service for managing reunion dues payments.
 * Tracks who paid dues for each reunion year.
 */
@Service
public class DuesService {

    /** Hard-coded fallback amount — $25.00. Used when no pricing tier matches. */
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
    private static final Field<Long>           PERSON_ID_F     = DSL.field(DSL.name("person_id"),         Long.class);

    private final DSLContext dsl;
    private final UserHelper userHelper;
    private final DuesPricingService pricingService;

    public DuesService(DSLContext dsl, UserHelper userHelper, DuesPricingService pricingService) {
        this.dsl = dsl;
        this.userHelper = userHelper;
        this.pricingService = pricingService;
    }

    // ── DTOs ──

    public record DuesPaymentDto(
            Long id,
            Long userId,
            Long personId,
            Long paidByUserId,
            String displayName,
            String paidByName,
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
            Long personId,
            String displayName,
            String dateOfBirth,
            boolean paid,
            String paidAt,
            int amountCents,
            String paidByName
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
            List<DuesPaymentDto> guestPayments,
            List<DuesPaymentDto> onBehalfPayments,
            /** Non-null when someone else paid dues on behalf of this user. */
            DuesPaymentDto paidForYouPayment,
            /** Person IDs with COMPLETED or PENDING dues for this year (for autocomplete exclusion). */
            List<Long> paidPersonIds
    ) {}

    public record GuestInfo(String name, int age) {}

    /** Entry for paying on behalf of a person (with profile) or a user (with account). */
    public record OnBehalfEntry(Long personId, Long userId) {}

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
        var records = dsl.select()
                .from(DUES)
                .where(REUNION_YEAR.eq(year))
                .orderBy(CREATED_AT.desc())
                .fetch();
        return mapRecords(records);
    }

    /** Admin: get paid/unpaid status for ALL users for a given year, plus guest/person payments. */
    public List<DuesStatusDto> getDuesStatus(int year) {
        List<DuesStatusDto> result = new ArrayList<>();

        // 1) All registered users (with LEFT JOIN to see if they paid)
        var userRows = dsl.select(
                        USERS.ID,
                        PEOPLE.FIRST_NAME,
                        PEOPLE.LAST_NAME,
                        PEOPLE.DATE_OF_BIRTH,
                        AMOUNT_CENTS,
                        PAID_AT
                )
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .leftJoin(DUES).on(
                        USER_ID.eq(USERS.ID)
                                .and(REUNION_YEAR.eq(year))
                                .and(STATUS.eq("COMPLETED"))
                )
                .where(USERS.USER_ROLE.ne("ROLE_PENDING"))
                .fetch();

        for (var u : userRows) {
            Long uid = u.get(USERS.ID);
            String first = u.get(PEOPLE.FIRST_NAME);
            String last = u.get(PEOPLE.LAST_NAME);
            String displayName = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
            if (displayName.isBlank()) displayName = "Unknown";

            String dob = u.get(PEOPLE.DATE_OF_BIRTH) != null
                    ? u.get(PEOPLE.DATE_OF_BIRTH).toString()
                    : null;

            boolean paid = u.get(AMOUNT_CENTS) != null;
            String paidAt = paid && u.get(PAID_AT) != null
                    ? u.get(PAID_AT).toString() : null;
            int amount = paid ? u.get(AMOUNT_CENTS) : 0;

            result.add(new DuesStatusDto(uid, null, displayName, dob, paid, paidAt, amount, null));
        }

        // 2) Guest and person-based payments (no user_id, or user_id not in the users list)
        var guestRows = dsl.select()
                .from(DUES)
                .where(REUNION_YEAR.eq(year)
                        .and(STATUS.eq("COMPLETED"))
                        .and(DSL.or(
                                USER_ID.isNull(),
                                PERSON_ID_F.isNotNull()
                        )))
                .orderBy(CREATED_AT.desc())
                .fetch();

        // Collect user IDs already shown to avoid duplicates
        var shownUserIds = result.stream()
                .map(DuesStatusDto::userId)
                .filter(id -> id != null)
                .collect(java.util.stream.Collectors.toSet());

        // Batch-resolve person names and paid-by display names
        Set<Long> guestPersonIds = new HashSet<>();
        Set<Long> guestPaidByIds = new HashSet<>();
        for (var r : guestRows) {
            Long personId = r.get(PERSON_ID_F);
            Long paidBy = r.get(PAID_BY);
            if (personId != null) guestPersonIds.add(personId);
            if (paidBy != null) guestPaidByIds.add(paidBy);
        }
        Map<Long, String> personNameMap = batchResolvePersonNames(guestPersonIds);
        Map<Long, String> paidByNameMap = userHelper.batchResolveDisplayNames(guestPaidByIds);

        for (var r : guestRows) {
            Long uid = r.get(USER_ID);
            // Skip if this is a self-payment for a user we already listed
            if (uid != null && shownUserIds.contains(uid) && r.get(PERSON_ID_F) == null) continue;

            Long personId = r.get(PERSON_ID_F);
            String guestName = r.get(GUEST_NAME_F);
            String displayName;
            if (guestName != null) {
                displayName = guestName;
            } else if (personId != null) {
                displayName = personNameMap.getOrDefault(personId, "Unknown");
            } else {
                displayName = "Unknown";
            }

            String paidByName = r.get(PAID_BY) != null
                    ? paidByNameMap.getOrDefault(r.get(PAID_BY), "Unknown")
                    : null;

            result.add(new DuesStatusDto(
                    uid, personId, displayName, null, true,
                    r.get(PAID_AT) != null ? r.get(PAID_AT).toString() : null,
                    r.get(AMOUNT_CENTS) != null ? r.get(AMOUNT_CENTS) : 0,
                    paidByName
            ));
        }

        return result;
    }

    /** Admin: summary for a given year. */
    public DuesSummaryDto getSummary(int year) {
        var status = getDuesStatus(year);
        int total = status.size();
        int paid = (int) status.stream().filter(DuesStatusDto::paid).count();
        int collected = status.stream().filter(DuesStatusDto::paid).mapToInt(DuesStatusDto::amountCents).sum();
        return new DuesSummaryDto(year, total, paid, total - paid, collected);
    }

    /** Dues page view for a logged-in user: their own status + all on-behalf payments. */
    public DuesPageDto getDuesPage(Long userId, int year) {
        DuesPaymentDto selfPayment = getByUserAndYear(userId, year);
        boolean selfPaid = selfPayment != null && "COMPLETED".equals(selfPayment.status());

        // Check if someone else paid on behalf of this user's person_id
        DuesPaymentDto paidForYouPayment = null;
        if (!selfPaid) {
            Long myPersonId = dsl.select(USERS.PERSON_ID).from(USERS)
                    .where(USERS.ID.eq(userId)).fetchOne(USERS.PERSON_ID);
            if (myPersonId != null) {
                Record forMe = dsl.select().from(DUES)
                        .where(PERSON_ID_F.eq(myPersonId)
                                .and(REUNION_YEAR.eq(year))
                                .and(STATUS.eq("COMPLETED"))
                                .and(PAID_BY.isNotNull())
                                .and(PAID_BY.ne(userId)))
                        .orderBy(PAID_AT.desc())
                        .fetchOne();
                if (forMe != null) {
                    paidForYouPayment = mapRecord(forMe);
                    selfPaid = true;
                }
            }
        }

        // Guest payments (guest_name set, no person_id) — include all statuses for visibility
        var guestRecords = dsl.select()
                .from(DUES)
                .where(PAID_BY.eq(userId)
                        .and(REUNION_YEAR.eq(year))
                        .and(GUEST_NAME_F.isNotNull())
                        .and(PERSON_ID_F.isNull())
                        .and(DSL.or(USER_ID.isNull(), USER_ID.eq(userId))))
                .orderBy(CREATED_AT.desc())
                .fetch();

        // On-behalf payments for people with profiles or other users — all statuses
        var onBehalfRecords = dsl.select()
                .from(DUES)
                .where(PAID_BY.eq(userId)
                        .and(REUNION_YEAR.eq(year))
                        .and(DSL.or(
                                PERSON_ID_F.isNotNull(),
                                USER_ID.isNotNull().and(USER_ID.ne(userId))
                        )))
                .orderBy(CREATED_AT.desc())
                .fetch();

        // Batch-resolve names for both sets together
        Set<Long> allPersonIds = new HashSet<>();
        Set<Long> allUserIds = new HashSet<>();
        for (var r : guestRecords) {
            if (r.get(PERSON_ID_F) != null) allPersonIds.add(r.get(PERSON_ID_F));
            if (r.get(USER_ID) != null) allUserIds.add(r.get(USER_ID));
            if (r.get(PAID_BY) != null) allUserIds.add(r.get(PAID_BY));
        }
        for (var r : onBehalfRecords) {
            if (r.get(PERSON_ID_F) != null) allPersonIds.add(r.get(PERSON_ID_F));
            if (r.get(USER_ID) != null) allUserIds.add(r.get(USER_ID));
            if (r.get(PAID_BY) != null) allUserIds.add(r.get(PAID_BY));
        }
        Map<Long, String> personNames = batchResolvePersonNames(allPersonIds);
        Map<Long, String> userNames = userHelper.batchResolveDisplayNames(allUserIds);

        List<DuesPaymentDto> guestPayments = guestRecords.map(r -> mapRecord(r, personNames, userNames));
        List<DuesPaymentDto> onBehalfPayments = onBehalfRecords.map(r -> mapRecord(r, personNames, userNames));

        // Person IDs that already have COMPLETED or PENDING dues (for autocomplete exclusion)
        List<Long> paidPersonIds = dsl.select(PERSON_ID_F)
                .from(DUES)
                .where(REUNION_YEAR.eq(year)
                        .and(PERSON_ID_F.isNotNull())
                        .and(DSL.or(STATUS.eq("COMPLETED"), STATUS.eq("PENDING"))))
                .fetch(PERSON_ID_F);

        int userDuesAmount = resolveAmountForUser(userId, year);
        return new DuesPageDto(year, userDuesAmount, selfPaid, selfPayment, guestPayments, onBehalfPayments, paidForYouPayment, paidPersonIds);
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

        int selfAmountCents = resolveAmountForUser(userId, year);

        if (existing != null) {
            dsl.update(DUES)
                    .set(AMOUNT_CENTS, selfAmountCents)
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
                    .set(AMOUNT_CENTS, selfAmountCents)
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
     * Create a batch of PENDING dues payments (self + guests + on-behalf entries for people/users).
     * Returns batch info including total and all payment records for Square checkout.
     */
    @Transactional
    public DuesBatchDto createBatch(Long paidByUserId, int year, boolean payForSelf,
                                     List<GuestInfo> guests, List<OnBehalfEntry> onBehalf) {
        boolean hasGuests = guests != null && !guests.isEmpty();
        boolean hasOnBehalf = onBehalf != null && !onBehalf.isEmpty();
        if (!payForSelf && !hasGuests && !hasOnBehalf) {
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

            int selfAmountCents = resolveAmountForUser(paidByUserId, year);

            if (existing != null) {
                dsl.update(DUES)
                        .set(AMOUNT_CENTS, selfAmountCents)
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
                        .set(AMOUNT_CENTS, selfAmountCents)
                        .set(STATUS, "PENDING")
                        .set(BATCH_ID_F, batchId)
                        .returningResult(ID)
                        .fetchOne();
                if (result != null) paymentIds.add(result.get(ID));
            }
        }

        if (guests != null) {
            for (GuestInfo guest : guests) {
                int guestAmountCents = resolveAmountForGuest(guest.age(), year);
                var result = dsl.insertInto(DUES)
                        .set(PAID_BY, paidByUserId)
                        .set(GUEST_NAME_F, guest.name())
                        .set(GUEST_AGE_F, guest.age())
                        .set(REUNION_YEAR, year)
                        .set(AMOUNT_CENTS, guestAmountCents)
                        .set(STATUS, "PENDING")
                        .set(BATCH_ID_F, batchId)
                        .returningResult(ID)
                        .fetchOne();
                if (result != null) paymentIds.add(result.get(ID));
            }
        }

        // On-behalf entries: pay for a person (with profile) or another user (with account)
        if (onBehalf != null) {
            for (OnBehalfEntry entry : onBehalf) {
                Long targetUserId = entry.userId();
                Long targetPersonId = entry.personId();

                // If paying for a user, check if they already paid
                if (targetUserId != null) {
                    int targetAmount = resolveAmountForUser(targetUserId, year);
                    Record existing = dsl.select(ID, STATUS)
                            .from(DUES)
                            .where(USER_ID.eq(targetUserId).and(REUNION_YEAR.eq(year)))
                            .fetchOne();

                    if (existing != null && "COMPLETED".equals(existing.get(STATUS))) {
                        continue; // skip — already paid
                    }

                    if (existing != null) {
                        dsl.update(DUES)
                                .set(AMOUNT_CENTS, targetAmount)
                                .set(STATUS, "PENDING")
                                .set(BATCH_ID_F, batchId)
                                .set(PAID_BY, paidByUserId)
                                .set(UPDATED_AT, OffsetDateTime.now())
                                .where(ID.eq(existing.get(ID)))
                                .execute();
                        paymentIds.add(existing.get(ID));
                    } else {
                        // Resolve person_id from user if not provided
                        if (targetPersonId == null) {
                            targetPersonId = dsl.select(USERS.PERSON_ID)
                                    .from(USERS)
                                    .where(USERS.ID.eq(targetUserId))
                                    .fetchOneInto(Long.class);
                        }
                        var result = dsl.insertInto(DUES)
                                .set(USER_ID, targetUserId)
                                .set(PERSON_ID_F, targetPersonId)
                                .set(PAID_BY, paidByUserId)
                                .set(REUNION_YEAR, year)
                                .set(AMOUNT_CENTS, targetAmount)
                                .set(STATUS, "PENDING")
                                .set(BATCH_ID_F, batchId)
                                .returningResult(ID)
                                .fetchOne();
                        if (result != null) paymentIds.add(result.get(ID));
                    }
                } else if (targetPersonId != null) {
                    // Person without account — check if already paid by person_id
                    int personAmount = resolveAmountForPerson(targetPersonId, year);
                    Record existing = dsl.select(ID, STATUS)
                            .from(DUES)
                            .where(PERSON_ID_F.eq(targetPersonId).and(REUNION_YEAR.eq(year)))
                            .fetchOne();

                    if (existing != null && "COMPLETED".equals(existing.get(STATUS))) {
                        continue; // skip — already paid
                    }

                    // Resolve display name for the person
                    String personName = resolvePersonName(targetPersonId);

                    if (existing != null) {
                        dsl.update(DUES)
                                .set(AMOUNT_CENTS, personAmount)
                                .set(STATUS, "PENDING")
                                .set(BATCH_ID_F, batchId)
                                .set(PAID_BY, paidByUserId)
                                .set(GUEST_NAME_F, personName)
                                .set(UPDATED_AT, OffsetDateTime.now())
                                .where(ID.eq(existing.get(ID)))
                                .execute();
                        paymentIds.add(existing.get(ID));
                    } else {
                        var result = dsl.insertInto(DUES)
                                .set(PERSON_ID_F, targetPersonId)
                                .set(PAID_BY, paidByUserId)
                                .set(GUEST_NAME_F, personName)
                                .set(REUNION_YEAR, year)
                                .set(AMOUNT_CENTS, personAmount)
                                .set(STATUS, "PENDING")
                                .set(BATCH_ID_F, batchId)
                                .returningResult(ID)
                                .fetchOne();
                        if (result != null) paymentIds.add(result.get(ID));
                    }
                }
            }
        }

        List<DuesPaymentDto> payments;
        if (paymentIds.isEmpty()) {
            payments = List.of();
        } else {
            var records = dsl.select().from(DUES)
                    .where(ID.in(paymentIds))
                    .orderBy(CREATED_AT.asc())
                    .fetch();
            payments = mapRecords(records);
        }

        int totalCents = payments.stream().mapToInt(DuesPaymentDto::amountCents).sum();
        return new DuesBatchDto(batchId, totalCents, payments.size(), payments);
    }

    /**
     * Confirm all payments in a batch after Square processes successfully.
     * Idempotent — if already COMPLETED, returns existing records.
     */
    @Transactional
    public List<DuesPaymentDto> confirmBatch(String batchId, String squarePaymentId, String squareReceiptUrl) {
        // Square payment succeeded — mark as COMPLETED.
        // Match both PENDING and FAILED because the stale-checkout cleanup job may have
        // auto-cancelled the record before Square's webhook arrived.
        int affected = dsl.update(DUES)
                .set(STATUS, "COMPLETED")
                .set(SQ_PAYMENT_ID, squarePaymentId)
                .set(SQ_RECEIPT_URL, squareReceiptUrl)
                .set(PAID_AT, OffsetDateTime.now())
                .set(UPDATED_AT, OffsetDateTime.now())
                .set(NOTES, DSL.inline((String) null))
                .where(BATCH_ID_F.eq(batchId).and(STATUS.in("PENDING", "FAILED")))
                .execute();

        var allRecords = dsl.select().from(DUES)
                .where(BATCH_ID_F.eq(batchId))
                .orderBy(CREATED_AT.asc())
                .fetch();
        var all = mapRecords(allRecords);

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
     * Cancel stale PENDING dues records that are older than the given number of hours.
     * Called by a scheduled job to clean up abandoned checkouts where Square never
     * fired a webhook (user closed browser, etc.).
     *
     * @return the number of records marked FAILED
     */
    @Transactional
    public int cancelStalePending(int maxAgeHours) {
        OffsetDateTime cutoff = OffsetDateTime.now().minusHours(maxAgeHours);
        return dsl.update(DUES)
                .set(STATUS, "FAILED")
                .set(NOTES, "Auto-cancelled: checkout abandoned")
                .set(UPDATED_AT, OffsetDateTime.now())
                .where(STATUS.eq("PENDING").and(CREATED_AT.lt(cutoff)))
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

    /** Resolve a person's display name from the people table. */
    private String resolvePersonName(Long personId) {
        if (personId == null) return "Unknown";
        var rec = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(PEOPLE)
                .where(PEOPLE.ID.eq(personId))
                .fetchOne();
        if (rec != null && rec.get(PEOPLE.FIRST_NAME) != null) {
            String first = rec.get(PEOPLE.FIRST_NAME);
            String last = rec.get(PEOPLE.LAST_NAME);
            return (first + " " + (last != null ? last : "")).trim();
        }
        return "Unknown";
    }

    /** Batch-resolve person names in a single query. */
    private Map<Long, String> batchResolvePersonNames(Collection<Long> personIds) {
        if (personIds == null || personIds.isEmpty()) return Map.of();
        Map<Long, String> result = new HashMap<>();
        dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(PEOPLE)
                .where(PEOPLE.ID.in(personIds))
                .forEach(rec -> {
                    String first = rec.get(PEOPLE.FIRST_NAME);
                    String last = rec.get(PEOPLE.LAST_NAME);
                    String name = first != null
                            ? (first + " " + (last != null ? last : "")).trim()
                            : "Unknown";
                    result.put(rec.get(PEOPLE.ID), name);
                });
        return result;
    }

    /**
     * Resolve the dues amount for a user by looking up their DOB from the people table.
     * Falls back to DUES_AMOUNT_CENTS if no DOB or no matching tier.
     */
    private int resolveAmountForUser(Long userId, int year) {
        if (userId == null) return DUES_AMOUNT_CENTS;
        LocalDate dob = dsl.select(PEOPLE.DATE_OF_BIRTH)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.ID.eq(userId))
                .fetchOne(PEOPLE.DATE_OF_BIRTH);
        if (dob == null) return DUES_AMOUNT_CENTS;
        int age = Period.between(dob, LocalDate.now()).getYears();
        return pricingService.resolveAmount(age, year);
    }

    /**
     * Resolve the dues amount for a person (by person ID) by looking up their DOB.
     */
    private int resolveAmountForPerson(Long personId, int year) {
        if (personId == null) return DUES_AMOUNT_CENTS;
        LocalDate dob = dsl.select(PEOPLE.DATE_OF_BIRTH)
                .from(PEOPLE)
                .where(PEOPLE.ID.eq(personId))
                .fetchOne(PEOPLE.DATE_OF_BIRTH);
        if (dob == null) return DUES_AMOUNT_CENTS;
        int age = Period.between(dob, LocalDate.now()).getYears();
        return pricingService.resolveAmount(age, year);
    }

    /**
     * Resolve the dues amount for a guest (by explicit age).
     */
    private int resolveAmountForGuest(int guestAge, int year) {
        return pricingService.resolveAmount(guestAge, year);
    }

    /**
     * Build pre-fetched name maps for a list of records (2 queries total).
     * Returns [personNameMap, userDisplayNameMap].
     */
    @SuppressWarnings("unchecked")
    private Map<Long, String>[] buildNameMaps(List<? extends Record> records) {
        Set<Long> personIds = new HashSet<>();
        Set<Long> userIds = new HashSet<>();
        for (var rec : records) {
            Long personId = rec.get(PERSON_ID_F);
            Long uid = rec.get(USER_ID);
            Long paidBy = rec.get(PAID_BY);
            if (personId != null) personIds.add(personId);
            if (uid != null) userIds.add(uid);
            if (paidBy != null) userIds.add(paidBy);
        }
        return new Map[] {
                batchResolvePersonNames(personIds),
                userHelper.batchResolveDisplayNames(userIds)
        };
    }

    /** Batch-map a list of records with only 2 look-up queries instead of 2×N. */
    private List<DuesPaymentDto> mapRecords(List<? extends Record> records) {
        if (records.isEmpty()) return List.of();
        var maps = buildNameMaps(records);
        return records.stream()
                .map(r -> mapRecord(r, maps[0], maps[1]))
                .toList();
    }

    /** Map a single record using pre-fetched name maps (zero extra queries). */
    private DuesPaymentDto mapRecord(Record rec, Map<Long, String> personNames, Map<Long, String> userNames) {
        Long uid = rec.get(USER_ID);
        Long personId = rec.get(PERSON_ID_F);
        Long paidBy = rec.get(PAID_BY);
        String guestName = rec.get(GUEST_NAME_F);
        Integer guestAge = rec.get(GUEST_AGE_F);

        String displayName;
        if (guestName != null) {
            displayName = guestName;
        } else if (personId != null) {
            displayName = personNames.getOrDefault(personId, "Unknown");
        } else if (uid != null) {
            displayName = userNames.getOrDefault(uid, "Unknown");
        } else {
            displayName = "Unknown";
        }

        String paidByName = paidBy != null ? userNames.getOrDefault(paidBy, "Unknown") : null;

        return new DuesPaymentDto(
                rec.get(ID),
                uid,
                personId,
                paidBy,
                displayName,
                paidByName,
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

    /** Single-record mapping (used for getById/getByUserAndYear where N=1). */
    private DuesPaymentDto mapRecord(Record rec) {
        Long uid = rec.get(USER_ID);
        Long personId = rec.get(PERSON_ID_F);
        Long paidBy = rec.get(PAID_BY);
        String guestName = rec.get(GUEST_NAME_F);
        Integer guestAge = rec.get(GUEST_AGE_F);

        String displayName;
        if (guestName != null) {
            displayName = guestName;
        } else if (personId != null) {
            displayName = resolvePersonName(personId);
        } else if (uid != null) {
            displayName = userHelper.resolveDisplayName(uid);
        } else {
            displayName = "Unknown";
        }

        String paidByName = paidBy != null ? userHelper.resolveDisplayName(paidBy) : null;

        return new DuesPaymentDto(
                rec.get(ID),
                uid,
                personId,
                paidBy,
                displayName,
                paidByName,
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
}
