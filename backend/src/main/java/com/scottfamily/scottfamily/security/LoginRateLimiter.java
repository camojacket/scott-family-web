package com.scottfamily.scottfamily.security;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory, IP-based login rate limiter.
 *
 * <p>Strategy: progressive back-off per IP address.
 * <ul>
 *   <li>1-5 failures: no delay (normal typos)
 *   <li>6-10 failures: 30-second cooldown
 *   <li>11-20 failures: 2-minute cooldown
 *   <li>21+ failures: 5-minute cooldown
 * </ul>
 *
 * <p>Why IP-based instead of account-based:
 * Account lockout punishes the victim — an attacker could intentionally lock out
 * any user by spamming their username. IP-based limiting throttles the attacker's
 * machine while leaving the legitimate user (on a different IP) unaffected.
 *
 * <p>Counters reset on successful login and auto-expire after 15 minutes of
 * inactivity to avoid unbounded memory growth.
 */
public final class LoginRateLimiter {

    private LoginRateLimiter() {}

    public record RateLimitResult(boolean allowed, long retryAfterSeconds) {}

    private static final ConcurrentHashMap<String, AttemptRecord> ATTEMPTS = new ConcurrentHashMap<>();

    // Thresholds
    private static final int TIER_1_THRESHOLD = 5;
    private static final int TIER_2_THRESHOLD = 10;
    private static final int TIER_3_THRESHOLD = 20;

    // Cooldown durations in seconds
    private static final long TIER_1_COOLDOWN = 30;
    private static final long TIER_2_COOLDOWN = 120;
    private static final long TIER_3_COOLDOWN = 300;

    // Auto-expire entries after this many seconds of inactivity
    private static final long EXPIRY_SECONDS = 900; // 15 minutes

    /**
     * Check whether the given IP is allowed to attempt login.
     *
     * @return result indicating if the attempt is allowed, and if not, how many seconds to wait
     */
    public static RateLimitResult check(String ip) {
        cleanup();
        AttemptRecord record = ATTEMPTS.get(ip);
        if (record == null) {
            return new RateLimitResult(true, 0);
        }

        long cooldown = cooldownForFailures(record.failures);
        if (cooldown == 0) {
            return new RateLimitResult(true, 0);
        }

        long elapsed = Instant.now().getEpochSecond() - record.lastFailureEpoch;
        if (elapsed >= cooldown) {
            return new RateLimitResult(true, 0);
        }

        return new RateLimitResult(false, cooldown - elapsed);
    }

    /** Record a failed login attempt for the given IP. */
    public static void recordFailure(String ip) {
        long now = Instant.now().getEpochSecond();
        ATTEMPTS.compute(ip, (key, existing) -> {
            if (existing == null) {
                return new AttemptRecord(1, now);
            }
            return new AttemptRecord(existing.failures + 1, now);
        });
    }

    /** Clear the failure counter on successful login. */
    public static void recordSuccess(String ip) {
        ATTEMPTS.remove(ip);
    }

    private static long cooldownForFailures(int failures) {
        if (failures <= TIER_1_THRESHOLD) return 0;
        if (failures <= TIER_2_THRESHOLD) return TIER_1_COOLDOWN;
        if (failures <= TIER_3_THRESHOLD) return TIER_2_COOLDOWN;
        return TIER_3_COOLDOWN;
    }

    /** Remove stale entries to prevent unbounded memory growth. */
    private static void cleanup() {
        long cutoff = Instant.now().getEpochSecond() - EXPIRY_SECONDS;
        ATTEMPTS.entrySet().removeIf(e -> e.getValue().lastFailureEpoch < cutoff);
    }

    private static final class AttemptRecord {
        final int failures;
        final long lastFailureEpoch;

        AttemptRecord(int failures, long lastFailureEpoch) {
            this.failures = failures;
            this.lastFailureEpoch = lastFailureEpoch;
        }
    }
}
