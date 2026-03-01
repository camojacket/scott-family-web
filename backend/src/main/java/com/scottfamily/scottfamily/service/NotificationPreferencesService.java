package com.scottfamily.scottfamily.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

import lombok.RequiredArgsConstructor;

/**
 * Manages per-user notification preferences (email & SMS opt-in/out).
 */
@Service
@RequiredArgsConstructor
public class NotificationPreferencesService {

    private final DSLContext dsl;

    @Value("${notification.prompt-cooldown-days:30}")
    private int promptCooldownDays;

    // ── Inline field refs (table not in jOOQ codegen) ──────────────────
    private static final org.jooq.Table<?> NOTIF_PREFS =
            DSL.table(DSL.name("NOTIFICATION_PREFERENCES"));

    private static final Field<Long>    NP_ID           = DSL.field(DSL.name("ID"),           Long.class);
    private static final Field<Long>    NP_USER_ID      = DSL.field(DSL.name("USER_ID"),      Long.class);
    private static final Field<Boolean> NP_EMAIL_OPT_IN = DSL.field(DSL.name("EMAIL_OPT_IN"), Boolean.class);
    private static final Field<Boolean> NP_SMS_OPT_IN   = DSL.field(DSL.name("SMS_OPT_IN"),   Boolean.class);
    private static final Field<OffsetDateTime> NP_PROMPT_DISMISSED_AT = DSL.field(DSL.name("PROMPT_DISMISSED_AT"), OffsetDateTime.class);
    private static final Field<OffsetDateTime> NP_PROMPT_LAST_SHOWN_AT = DSL.field(DSL.name("PROMPT_LAST_SHOWN_AT"), OffsetDateTime.class);
    private static final Field<OffsetDateTime> NP_UPDATED_AT = DSL.field(DSL.name("UPDATED_AT"), OffsetDateTime.class);

    // users.phone_number (added in V20)
    private static final Field<String> U_PHONE_NUMBER = DSL.field(DSL.name("phone_number"), String.class);

    // ── DTOs ───────────────────────────────────────────────────────────

    public record NotificationPrefsDto(
            boolean emailOptIn,
            boolean smsOptIn,
            String phoneNumber
    ) {}

    public record UpdatePrefsRequest(
            Boolean emailOptIn,
            Boolean smsOptIn,
            String phoneNumber
    ) {}

    public record PromptStatusDto(
            boolean showPrompt
    ) {}

    // ── Read ───────────────────────────────────────────────────────────

    /**
     * Get notification preferences for the current user.
     * If no row exists yet, returns defaults (email=true, sms=false).
     */
    public NotificationPrefsDto getPreferences(Long userId) {
        Record row = dsl.select(NP_EMAIL_OPT_IN, NP_SMS_OPT_IN)
                .from(NOTIF_PREFS)
                .where(NP_USER_ID.eq(userId))
                .fetchOne();

        String phone = dsl.select(U_PHONE_NUMBER)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(U_PHONE_NUMBER);

        if (row == null) {
            return new NotificationPrefsDto(true, false, phone);
        }
        return new NotificationPrefsDto(
                Boolean.TRUE.equals(row.get(NP_EMAIL_OPT_IN)),
                Boolean.TRUE.equals(row.get(NP_SMS_OPT_IN)),
                phone
        );
    }

    // ── Write ──────────────────────────────────────────────────────────

    /**
     * Upsert notification preferences for a user.
     * Fields not present in the request (null) fall back to the existing stored value.
     */
    public NotificationPrefsDto updatePreferences(Long userId, UpdatePrefsRequest req) {
        // Update phone number on users table if provided
        if (req.phoneNumber() != null) {
            dsl.update(USERS)
                    .set(U_PHONE_NUMBER, req.phoneNumber().isBlank() ? null : req.phoneNumber().trim())
                    .where(USERS.ID.eq(userId))
                    .execute();
        }

        // Read existing opt-in values so a phone-only update doesn't reset them to hardcoded defaults
        Record existing = dsl.select(NP_EMAIL_OPT_IN, NP_SMS_OPT_IN)
                .from(NOTIF_PREFS)
                .where(NP_USER_ID.eq(userId))
                .fetchOne();
        boolean existingEmail = existing != null && Boolean.TRUE.equals(existing.get(NP_EMAIL_OPT_IN));
        boolean existingSms   = existing != null && Boolean.TRUE.equals(existing.get(NP_SMS_OPT_IN));

        boolean emailOpt = req.emailOptIn() != null ? req.emailOptIn() : existingEmail;
        boolean smsOpt   = req.smsOptIn()   != null ? req.smsOptIn()   : existingSms;

        // Atomic upsert to avoid TOCTOU race condition
        dsl.mergeInto(NOTIF_PREFS)
                .using(DSL.selectOne())
                .on(NP_USER_ID.eq(userId))
                .whenMatchedThenUpdate()
                        .set(NP_EMAIL_OPT_IN, emailOpt)
                        .set(NP_SMS_OPT_IN, smsOpt)
                        .set(NP_UPDATED_AT, OffsetDateTime.now())
                .whenNotMatchedThenInsert(NP_USER_ID, NP_EMAIL_OPT_IN, NP_SMS_OPT_IN, NP_UPDATED_AT)
                        .values(userId, emailOpt, smsOpt, OffsetDateTime.now())
                .execute();

        String phone = dsl.select(U_PHONE_NUMBER)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(U_PHONE_NUMBER);

        return new NotificationPrefsDto(emailOpt, smsOpt, phone);
    }

    // ── Prompt logic ───────────────────────────────────────────────────

    /**
     * Determines whether the opt-in prompt should be shown to a user.
     * Show prompt if:
     *   - No preferences row exists yet (never configured), OR
     *   - User has NOT opted in to either email or SMS, AND has NOT dismissed the prompt
     */
    public PromptStatusDto shouldShowPrompt(Long userId) {
        Record row = dsl.select(NP_EMAIL_OPT_IN, NP_SMS_OPT_IN, NP_PROMPT_DISMISSED_AT, NP_PROMPT_LAST_SHOWN_AT)
                .from(NOTIF_PREFS)
                .where(NP_USER_ID.eq(userId))
                .fetchOne();

        // No row yet — user has never configured preferences, show the prompt
        if (row == null) {
            return new PromptStatusDto(true);
        }

        // If they dismissed the prompt permanently, don't show it
        if (row.get(NP_PROMPT_DISMISSED_AT) != null) {
            return new PromptStatusDto(false);
        }

        // If they already opted in to at least one channel, don't show it
        boolean emailOpt = Boolean.TRUE.equals(row.get(NP_EMAIL_OPT_IN));
        boolean smsOpt   = Boolean.TRUE.equals(row.get(NP_SMS_OPT_IN));
        if (emailOpt || smsOpt) {
            return new PromptStatusDto(false);
        }

        // Check cooldown — only show again if enough days have passed since last shown
        OffsetDateTime lastShown = row.get(NP_PROMPT_LAST_SHOWN_AT);
        if (lastShown != null) {
            OffsetDateTime cooldownEnd = lastShown.plusDays(promptCooldownDays);
            if (OffsetDateTime.now().isBefore(cooldownEnd)) {
                return new PromptStatusDto(false);
            }
        }

        // Not opted in, not dismissed, cooldown expired (or never shown) — show prompt
        return new PromptStatusDto(true);
    }

    /**
     * Records that the opt-in prompt was shown to the user (for cooldown tracking).
     */
    public void markPromptShown(Long userId) {
        dsl.mergeInto(NOTIF_PREFS)
                .using(DSL.selectOne())
                .on(NP_USER_ID.eq(userId))
                .whenMatchedThenUpdate()
                        .set(NP_PROMPT_LAST_SHOWN_AT, OffsetDateTime.now())
                .whenNotMatchedThenInsert(NP_USER_ID, NP_EMAIL_OPT_IN, NP_SMS_OPT_IN, NP_PROMPT_LAST_SHOWN_AT, NP_UPDATED_AT)
                        .values(userId, false, false, OffsetDateTime.now(), OffsetDateTime.now())
                .execute();
    }

    /**
     * Permanently dismiss the opt-in prompt for a user.
     */
    public void dismissPrompt(Long userId) {
        dsl.mergeInto(NOTIF_PREFS)
                .using(DSL.selectOne())
                .on(NP_USER_ID.eq(userId))
                .whenMatchedThenUpdate()
                        .set(NP_PROMPT_DISMISSED_AT, OffsetDateTime.now())
                .whenNotMatchedThenInsert(NP_USER_ID, NP_EMAIL_OPT_IN, NP_SMS_OPT_IN, NP_PROMPT_DISMISSED_AT, NP_UPDATED_AT)
                        .values(userId, false, false, OffsetDateTime.now(), OffsetDateTime.now())
                .execute();
    }

    /**
     * Quick opt-in from the banner: enables email, and SMS if a phone number is on file.
     * Also dismisses the prompt so it won't re-appear.
     */
    public NotificationPrefsDto quickOptIn(Long userId) {
        // Check if user has a phone number on file
        String phone = dsl.select(U_PHONE_NUMBER)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(U_PHONE_NUMBER);

        boolean enableSms = phone != null && !phone.isBlank();

        dsl.mergeInto(NOTIF_PREFS)
                .using(DSL.selectOne())
                .on(NP_USER_ID.eq(userId))
                .whenMatchedThenUpdate()
                        .set(NP_EMAIL_OPT_IN, true)
                        .set(NP_SMS_OPT_IN, enableSms)
                        .set(NP_PROMPT_DISMISSED_AT, OffsetDateTime.now())
                        .set(NP_UPDATED_AT, OffsetDateTime.now())
                .whenNotMatchedThenInsert(NP_USER_ID, NP_EMAIL_OPT_IN, NP_SMS_OPT_IN, NP_PROMPT_DISMISSED_AT, NP_UPDATED_AT)
                        .values(userId, true, enableSms, OffsetDateTime.now(), OffsetDateTime.now())
                .execute();

        return new NotificationPrefsDto(true, enableSms, phone);
    }

    // ── Subscriber queries (used by NotificationSendService) ──────────

    /**
     * Returns emails of all users opted-in to email notifications.
     */
    public List<String> getEmailSubscribers() {
        return dsl.select(USERS.EMAIL)
                .from(USERS)
                .innerJoin(NOTIF_PREFS).on(NP_USER_ID.eq(USERS.ID))
                .where(NP_EMAIL_OPT_IN.isTrue())
                .and(USERS.EMAIL.isNotNull())
                .and(USERS.EMAIL.ne(""))
                .and(USERS.APPROVED_AT.isNotNull())
                .fetch(USERS.EMAIL);
    }

    /**
     * Returns phone numbers of all users opted-in to SMS notifications.
     */
    public List<String> getSmsSubscribers() {
        return dsl.select(U_PHONE_NUMBER)
                .from(USERS)
                .innerJoin(NOTIF_PREFS).on(NP_USER_ID.eq(USERS.ID))
                .where(NP_SMS_OPT_IN.isTrue())
                .and(U_PHONE_NUMBER.isNotNull())
                .and(U_PHONE_NUMBER.ne(""))
                .and(USERS.APPROVED_AT.isNotNull())
                .fetch(U_PHONE_NUMBER);
    }

    /**
     * Returns subscriber counts for admin dashboard.
     */
    public Map<String, Integer> getSubscriberCounts() {
        int emailCount = dsl.selectCount()
                .from(USERS)
                .innerJoin(NOTIF_PREFS).on(NP_USER_ID.eq(USERS.ID))
                .where(NP_EMAIL_OPT_IN.isTrue())
                .and(USERS.EMAIL.isNotNull())
                .and(USERS.EMAIL.ne(""))
                .and(USERS.APPROVED_AT.isNotNull())
                .fetchOne(0, int.class);

        int smsCount = dsl.selectCount()
                .from(USERS)
                .innerJoin(NOTIF_PREFS).on(NP_USER_ID.eq(USERS.ID))
                .where(NP_SMS_OPT_IN.isTrue())
                .and(U_PHONE_NUMBER.isNotNull())
                .and(U_PHONE_NUMBER.ne(""))
                .and(USERS.APPROVED_AT.isNotNull())
                .fetchOne(0, int.class);

        return Map.of("email", emailCount, "sms", smsCount);
    }
}
