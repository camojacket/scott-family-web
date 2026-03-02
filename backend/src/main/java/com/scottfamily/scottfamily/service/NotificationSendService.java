package com.scottfamily.scottfamily.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.impl.DSL;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Handles sending bulk email and SMS notifications to opted-in subscribers.
 *
 * Email delivery is non-blocking because MailService methods are @Async.
 * SMS delivery is parallelized via CompletableFuture on the async executor.
 */
@Service
@Slf4j
public class NotificationSendService {

    private final MailService mailService;
    private final NotificationPreferencesService preferencesService;
    private final DSLContext dsl;
    private final SmsService smsService;
    private final Executor asyncExecutor;

    public NotificationSendService(MailService mailService,
                                   NotificationPreferencesService preferencesService,
                                   DSLContext dsl,
                                   SmsService smsService,
                                   @Qualifier("asyncExecutor") Executor asyncExecutor) {
        this.mailService = mailService;
        this.preferencesService = preferencesService;
        this.dsl = dsl;
        this.smsService = smsService;
        this.asyncExecutor = asyncExecutor;
    }

    // ── Notification log table refs ────────────────────────────────────
    private static final org.jooq.Table<?> NOTIF_LOG =
            DSL.table(DSL.name("NOTIFICATION_LOG"));
    private static final Field<Long>    NL_ID              = DSL.field(DSL.name("ID"), Long.class);
    private static final Field<Long>    NL_SENT_BY         = DSL.field(DSL.name("SENT_BY_USER_ID"), Long.class);
    private static final Field<String>  NL_SUBJECT         = DSL.field(DSL.name("SUBJECT"), String.class);
    private static final Field<String>  NL_BODY            = DSL.field(DSL.name("BODY"), String.class);
    private static final Field<String>  NL_CHANNEL         = DSL.field(DSL.name("CHANNEL"), String.class);
    private static final Field<Integer> NL_RECIPIENT_COUNT = DSL.field(DSL.name("RECIPIENT_COUNT"), Integer.class);
    private static final Field<OffsetDateTime> NL_SENT_AT  = DSL.field(DSL.name("SENT_AT"), OffsetDateTime.class);

    // ── DTOs ───────────────────────────────────────────────────────────

    public record SendNotificationRequest(
            String subject,
            String body,
            boolean sendEmail,
            boolean sendSms
    ) {}

    public record SendNotificationResponse(
            int emailsSent,
            int smsSent,
            String message
    ) {}

    public record NotificationLogEntry(
            Long id,
            String subject,
            String body,
            String channel,
            int recipientCount,
            String sentAt
    ) {}

    // ── Send bulk notifications ────────────────────────────────────────

    /**
     * Sends notifications to all opted-in subscribers.
     * Email sends are non-blocking (@Async in MailService).
     * SMS sends are parallelized on the async executor.
     */
    public SendNotificationResponse sendBulkNotification(Long adminUserId, SendNotificationRequest req) {
        if (req.subject() == null || req.subject().isBlank()) {
            throw new IllegalArgumentException("Subject is required");
        }
        if (req.body() == null || req.body().isBlank()) {
            throw new IllegalArgumentException("Message body is required");
        }
        if (!req.sendEmail() && !req.sendSms()) {
            throw new IllegalArgumentException("At least one channel (email or SMS) must be selected");
        }

        int emailsSent = 0;
        int smsSent = 0;

        // ── Email (each .sendEmail() dispatches to async thread pool) ──
        if (req.sendEmail()) {
            List<String> emails = preferencesService.getEmailSubscribers();
            for (String email : emails) {
                try {
                    mailService.sendEmail(email, req.subject(), req.body());
                    emailsSent++;
                } catch (Exception e) {
                    log.warn("Failed to dispatch email to {}: {}", email, e.getMessage());
                }
            }
            logNotification(adminUserId, req.subject(), req.body(), "EMAIL", emailsSent);
        }

        // ── SMS (parallelized on async executor) ──
        if (req.sendSms()) {
            if (smsService.isConfigured()) {
                List<String> phones = preferencesService.getSmsSubscribers();
                AtomicInteger smsCount = new AtomicInteger(0);

                CompletableFuture<?>[] futures = phones.stream()
                        .map(phone -> CompletableFuture.runAsync(() -> {
                            try {
                                smsService.send(phone, req.body());
                                smsCount.incrementAndGet();
                            } catch (Exception e) {
                                log.warn("Failed to send SMS to {}: {}", phone, e.getMessage());
                            }
                        }, asyncExecutor))
                        .toArray(CompletableFuture[]::new);

                // Wait for all SMS futures (bounded by executor queue capacity)
                try {
                    CompletableFuture.allOf(futures).join();
                } catch (Exception e) {
                    log.warn("Some SMS sends did not complete: {}", e.getMessage());
                }
                smsSent = smsCount.get();
                logNotification(adminUserId, req.subject(), req.body(), "SMS", smsSent);
            } else {
                log.warn("Twilio is not configured — SMS notifications skipped");
            }
        }

        String message = buildResultMessage(emailsSent, smsSent, req.sendEmail(), req.sendSms());
        return new SendNotificationResponse(emailsSent, smsSent, message);
    }

    // ── Notification log ───────────────────────────────────────────────

    /**
     * Returns the last 50 notification log entries for admin review.
     */
    public List<NotificationLogEntry> getNotificationLog() {
        return dsl.select(NL_ID, NL_SUBJECT, NL_BODY, NL_CHANNEL, NL_RECIPIENT_COUNT, NL_SENT_AT)
                .from(NOTIF_LOG)
                .orderBy(NL_SENT_AT.desc())
                .limit(50)
                .fetch(r -> new NotificationLogEntry(
                        r.get(NL_ID),
                        r.get(NL_SUBJECT),
                        r.get(NL_BODY),
                        r.get(NL_CHANNEL),
                        r.get(NL_RECIPIENT_COUNT),
                        r.get(NL_SENT_AT) != null ? r.get(NL_SENT_AT).toString() : null
                ));
    }

    // ── Private helpers ────────────────────────────────────────────────

    private void logNotification(Long adminUserId, String subject, String body, String channel, int count) {
        dsl.insertInto(NOTIF_LOG)
                .set(NL_SENT_BY, adminUserId)
                .set(NL_SUBJECT, subject)
                .set(NL_BODY, body)
                .set(NL_CHANNEL, channel)
                .set(NL_RECIPIENT_COUNT, count)
                .set(NL_SENT_AT, OffsetDateTime.now())
                .execute();
    }

    private String buildResultMessage(int emailsSent, int smsSent, boolean triedEmail, boolean triedSms) {
        StringBuilder sb = new StringBuilder();
        if (triedEmail) {
            sb.append(emailsSent).append(" email(s) sent");
        }
        if (triedSms) {
            if (sb.length() > 0) sb.append(", ");
            if (!smsService.isConfigured()) {
                sb.append("SMS skipped (Twilio not configured)");
            } else {
                sb.append(smsSent).append(" SMS sent");
            }
        }
        return sb.toString();
    }
}
