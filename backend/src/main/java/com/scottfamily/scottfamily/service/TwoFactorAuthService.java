package com.scottfamily.scottfamily.service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * SMS-based two-factor authentication with backup code support.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TwoFactorAuthService {

    private final DSLContext dsl;
    private final SmsService smsService;
    private final PasswordEncoder passwordEncoder;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_LENGTH = 6;
    private static final int CODE_EXPIRY_MINUTES = 5;
    private static final int MAX_CODE_ATTEMPTS = 5;
    private static final int BACKUP_CODE_COUNT = 10;
    private static final int BACKUP_CODE_LENGTH = 8;

    // ── Table references (inline, not in jOOQ codegen) ─────────────────
    private static final org.jooq.Table<?> TFA =
            DSL.table(DSL.name("TWO_FACTOR_AUTH"));
    private static final org.jooq.Table<?> TFA_BACKUP =
            DSL.table(DSL.name("TWO_FACTOR_BACKUP_CODES"));

    private static final Field<Long>    TFA_ID              = DSL.field(DSL.name("ID"), Long.class);
    private static final Field<Long>    TFA_USER_ID         = DSL.field(DSL.name("USER_ID"), Long.class);
    private static final Field<Boolean> TFA_ENABLED         = DSL.field(DSL.name("ENABLED"), Boolean.class);
    private static final Field<String>  TFA_PHONE_NUMBER    = DSL.field(DSL.name("PHONE_NUMBER"), String.class);
    private static final Field<String>  TFA_CURRENT_CODE    = DSL.field(DSL.name("CURRENT_CODE"), String.class);
    private static final Field<OffsetDateTime> TFA_CODE_EXPIRES = DSL.field(DSL.name("CODE_EXPIRES_AT"), OffsetDateTime.class);
    private static final Field<Integer> TFA_CODE_ATTEMPTS   = DSL.field(DSL.name("CODE_ATTEMPTS"), Integer.class);
    private static final Field<OffsetDateTime> TFA_UPDATED  = DSL.field(DSL.name("UPDATED_AT"), OffsetDateTime.class);

    private static final Field<Long>    BC_ID        = DSL.field(DSL.name("ID"), Long.class);
    private static final Field<Long>    BC_USER_ID   = DSL.field(DSL.name("USER_ID"), Long.class);
    private static final Field<String>  BC_CODE_HASH = DSL.field(DSL.name("CODE_HASH"), String.class);
    private static final Field<OffsetDateTime> BC_USED_AT = DSL.field(DSL.name("USED_AT"), OffsetDateTime.class);

    // users.phone_number
    private static final Field<String> U_PHONE_NUMBER = DSL.field(DSL.name("phone_number"), String.class);

    // ── DTOs ───────────────────────────────────────────────────────────

    public record TwoFactorStatusDto(
            boolean enabled,
            String maskedPhone,
            int backupCodesRemaining
    ) {}

    public record TwoFactorSetupResult(
            boolean enabled,
            String maskedPhone,
            List<String> backupCodes
    ) {}

    public record TwoFactorChallengeDto(
            boolean twoFactorRequired,
            String maskedPhone
    ) {}

    // ── Query ──────────────────────────────────────────────────────────

    /**
     * Check if 2FA is enabled for a given user.
     */
    public boolean isEnabled(Long userId) {
        Boolean enabled = dsl.select(TFA_ENABLED)
                .from(TFA)
                .where(TFA_USER_ID.eq(userId))
                .fetchOne(TFA_ENABLED);
        return Boolean.TRUE.equals(enabled);
    }

    /**
     * Get the 2FA status for profile display.
     */
    public TwoFactorStatusDto getStatus(Long userId) {
        Record row = dsl.select(TFA_ENABLED, TFA_PHONE_NUMBER)
                .from(TFA)
                .where(TFA_USER_ID.eq(userId))
                .fetchOne();

        if (row == null) {
            return new TwoFactorStatusDto(false, null, 0);
        }

        boolean enabled = Boolean.TRUE.equals(row.get(TFA_ENABLED));
        String phone = row.get(TFA_PHONE_NUMBER);

        int remaining = dsl.selectCount()
                .from(TFA_BACKUP)
                .where(BC_USER_ID.eq(userId))
                .and(BC_USED_AT.isNull())
                .fetchOne(0, int.class);

        return new TwoFactorStatusDto(enabled, maskPhone(phone), remaining);
    }

    // ── Enable / Disable ───────────────────────────────────────────────

    /**
     * Enable 2FA for a user. Sends a verification code to their phone first.
     * The phone number used is the one on their users table, or an override.
     *
     * @return setup result with backup codes (shown once)
     */
    public TwoFactorSetupResult enable(Long userId, String phoneNumber, String password) {
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required to enable 2FA.");
        }
        String hash = dsl.select(USERS.PASSWORD_HASH)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(USERS.PASSWORD_HASH);
        if (hash == null || !passwordEncoder.matches(password, hash)) {
            throw new IllegalArgumentException("Invalid password.");
        }

        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new IllegalArgumentException("A phone number is required to enable 2FA.");
        }

        if (!smsService.isConfigured()) {
            throw new IllegalStateException("SMS service is not configured. Contact an administrator.");
        }

        String cleanPhone = phoneNumber.trim();

        // Save/update the phone number on users table
        dsl.update(USERS)
                .set(U_PHONE_NUMBER, cleanPhone)
                .where(USERS.ID.eq(userId))
                .execute();

        // Delete any old backup codes
        dsl.deleteFrom(TFA_BACKUP).where(BC_USER_ID.eq(userId)).execute();

        // Generate backup codes
        List<String> plainCodes = new ArrayList<>();
        for (int i = 0; i < BACKUP_CODE_COUNT; i++) {
            String code = generateAlphanumeric(BACKUP_CODE_LENGTH);
            plainCodes.add(code);
            dsl.insertInto(TFA_BACKUP)
                    .set(BC_USER_ID, userId)
                    .set(BC_CODE_HASH, passwordEncoder.encode(code))
                    .execute();
        }

        // Upsert TWO_FACTOR_AUTH row atomically to avoid TOCTOU race condition
        dsl.mergeInto(TFA)
                .using(DSL.selectOne())
                .on(TFA_USER_ID.eq(userId))
                .whenMatchedThenUpdate()
                        .set(TFA_ENABLED, true)
                        .set(TFA_PHONE_NUMBER, cleanPhone)
                        .set(TFA_CURRENT_CODE, (String) null)
                        .set(TFA_CODE_ATTEMPTS, 0)
                        .set(TFA_UPDATED, OffsetDateTime.now())
                .whenNotMatchedThenInsert(TFA_USER_ID, TFA_ENABLED, TFA_PHONE_NUMBER, TFA_UPDATED)
                        .values(userId, true, cleanPhone, OffsetDateTime.now())
                .execute();

        log.info("2FA enabled for user {}", userId);
        return new TwoFactorSetupResult(true, maskPhone(cleanPhone), plainCodes);
    }

    /**
     * Disable 2FA for a user (requires password confirmation).
     */
    public void disable(Long userId, String password) {
        // Verify password
        String hash = dsl.select(USERS.PASSWORD_HASH)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(USERS.PASSWORD_HASH);

        if (hash == null || !passwordEncoder.matches(password, hash)) {
            throw new IllegalArgumentException("Invalid password.");
        }

        dsl.deleteFrom(TFA_BACKUP).where(BC_USER_ID.eq(userId)).execute();
        dsl.deleteFrom(TFA).where(TFA_USER_ID.eq(userId)).execute();

        log.info("2FA disabled for user {}", userId);
    }

    // ── OTP send / verify (login flow) ─────────────────────────────────

    /**
     * Generate and send an OTP code to the user's 2FA phone.
     *
     * @return masked phone number for display
     */
    public String sendCode(Long userId) {
        Record row = dsl.select(TFA_PHONE_NUMBER, TFA_ENABLED)
                .from(TFA)
                .where(TFA_USER_ID.eq(userId))
                .fetchOne();

        if (row == null || !Boolean.TRUE.equals(row.get(TFA_ENABLED))) {
            throw new IllegalStateException("2FA is not enabled for this user.");
        }

        String phone = row.get(TFA_PHONE_NUMBER);
        String code = generateNumeric(CODE_LENGTH);
        String codeHash = passwordEncoder.encode(code);

        dsl.update(TFA)
                .set(TFA_CURRENT_CODE, codeHash)
                .set(TFA_CODE_EXPIRES, OffsetDateTime.now().plusMinutes(CODE_EXPIRY_MINUTES))
                .set(TFA_CODE_ATTEMPTS, 0)
                .set(TFA_UPDATED, OffsetDateTime.now())
                .where(TFA_USER_ID.eq(userId))
                .execute();

        smsService.send(phone, "Your verification code is: " + code
                + ". It expires in " + CODE_EXPIRY_MINUTES + " minutes.");

        log.debug("2FA code sent to user {}", userId);
        return maskPhone(phone);
    }

    /**
     * Verify an OTP code.
     *
     * @return true if the code is valid
     * @throws IllegalStateException if too many attempts or code expired
     */
    public boolean verifyCode(Long userId, String code) {
        Record row = dsl.select(TFA_CURRENT_CODE, TFA_CODE_EXPIRES, TFA_CODE_ATTEMPTS)
                .from(TFA)
                .where(TFA_USER_ID.eq(userId))
                .fetchOne();

        if (row == null) {
            throw new IllegalStateException("2FA is not configured.");
        }

        int attempts = row.get(TFA_CODE_ATTEMPTS) != null ? row.get(TFA_CODE_ATTEMPTS) : 0;
        if (attempts >= MAX_CODE_ATTEMPTS) {
            throw new IllegalStateException("Too many attempts. Please request a new code.");
        }

        OffsetDateTime expiresAt = row.get(TFA_CODE_EXPIRES);
        if (expiresAt == null || OffsetDateTime.now().isAfter(expiresAt)) {
            throw new IllegalStateException("Code has expired. Please request a new code.");
        }

        String storedHash = row.get(TFA_CURRENT_CODE);
        if (storedHash == null) {
            throw new IllegalStateException("No code was sent. Please request a code first.");
        }

        // Increment attempts
        dsl.update(TFA)
                .set(TFA_CODE_ATTEMPTS, attempts + 1)
                .where(TFA_USER_ID.eq(userId))
                .execute();

        if (passwordEncoder.matches(code, storedHash)) {
            // Invalidate the code after successful verification
            dsl.update(TFA)
                    .set(TFA_CURRENT_CODE, (String) null)
                    .set(TFA_CODE_EXPIRES, (OffsetDateTime) null)
                    .set(TFA_CODE_ATTEMPTS, 0)
                    .set(TFA_UPDATED, OffsetDateTime.now())
                    .where(TFA_USER_ID.eq(userId))
                    .execute();
            return true;
        }

        return false;
    }

    /**
     * Verify a backup code (single use).
     *
     * @return true if a valid unused backup code was found and consumed
     */
    public boolean verifyBackupCode(Long userId, String code) {
        // Fetch all unused backup codes for this user
        var records = dsl.select(BC_ID, BC_CODE_HASH)
                .from(TFA_BACKUP)
                .where(BC_USER_ID.eq(userId))
                .and(BC_USED_AT.isNull())
                .fetch();

        for (var rec : records) {
            if (passwordEncoder.matches(code, rec.get(BC_CODE_HASH))) {
                // Mark as used
                dsl.update(TFA_BACKUP)
                        .set(BC_USED_AT, OffsetDateTime.now())
                        .where(BC_ID.eq(rec.get(BC_ID)))
                        .execute();

                log.info("Backup code used for user {}", userId);
                return true;
            }
        }

        return false;
    }

    // ── Admin reset ────────────────────────────────────────────────────

    /**
     * Admin resets 2FA for a user (removes all 2FA data).
     */
    public void adminReset(Long targetUserId) {
        dsl.deleteFrom(TFA_BACKUP).where(BC_USER_ID.eq(targetUserId)).execute();
        dsl.deleteFrom(TFA).where(TFA_USER_ID.eq(targetUserId)).execute();
        log.info("Admin reset 2FA for user {}", targetUserId);
    }

    // ── Regenerate backup codes ────────────────────────────────────────

    /**
     * Generate a fresh set of backup codes (invalidates old ones).
     * Requires password confirmation.
     */
    public List<String> regenerateBackupCodes(Long userId, String password) {
        // Verify password
        String hash = dsl.select(USERS.PASSWORD_HASH)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne(USERS.PASSWORD_HASH);

        if (hash == null || !passwordEncoder.matches(password, hash)) {
            throw new IllegalArgumentException("Invalid password.");
        }

        // Delete old codes
        dsl.deleteFrom(TFA_BACKUP).where(BC_USER_ID.eq(userId)).execute();

        // Generate new ones
        List<String> plainCodes = new ArrayList<>();
        for (int i = 0; i < BACKUP_CODE_COUNT; i++) {
            String code = generateAlphanumeric(BACKUP_CODE_LENGTH);
            plainCodes.add(code);
            dsl.insertInto(TFA_BACKUP)
                    .set(BC_USER_ID, userId)
                    .set(BC_CODE_HASH, passwordEncoder.encode(code))
                    .execute();
        }

        return plainCodes;
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private String generateNumeric(int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    private String generateAlphanumeric(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (I,O,0,1)
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(RANDOM.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }
}
