package com.scottfamily.scottfamily.service;

import lombok.RequiredArgsConstructor;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

import static com.yourproject.generated.scott_family_web.tables.ContactMessages.CONTACT_MESSAGES;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;

@Service
@RequiredArgsConstructor
public class InquiryService {

    private final DSLContext dsl;
    private final MailService mailService;
    private final UserHelper userHelper;

    // ─── INQUIRY_REPLIES table references (until jOOQ codegen runs) ───
    private static final Table<?> IR = DSL.table("INQUIRY_REPLIES");
    private static final Field<Long> IR_ID = DSL.field("INQUIRY_REPLIES.ID", Long.class);
    private static final Field<Long> IR_INQUIRY_ID = DSL.field("INQUIRY_REPLIES.INQUIRY_ID", Long.class);
    private static final Field<String> IR_SENDER_TYPE = DSL.field("INQUIRY_REPLIES.SENDER_TYPE", String.class);
    private static final Field<Long> IR_SENDER_USER_ID = DSL.field("INQUIRY_REPLIES.SENDER_USER_ID", Long.class);
    private static final Field<String> IR_BODY = DSL.field("INQUIRY_REPLIES.BODY", String.class);
    private static final Field<OffsetDateTime> IR_CREATED_AT = DSL.field("INQUIRY_REPLIES.CREATED_AT", OffsetDateTime.class);
    private static final Field<Boolean> IR_READ_FLAG = DSL.field("INQUIRY_REPLIES.READ_FLAG", Boolean.class);

    // CONTACT_MESSAGES new columns (until jOOQ codegen)
    private static final Field<Long> CM_USER_ID = DSL.field("CONTACT_MESSAGES.USER_ID", Long.class);
    private static final Field<String> CM_STATUS = DSL.field("CONTACT_MESSAGES.STATUS", String.class);

    // ──────────── Contact form submission ────────────

    /**
     * Persist a new contact‑us message. If the user is logged in, also store userId.
     */
    public long submitInquiry(String name, String email, String message, Long userId) {
        var rec = dsl.newRecord(CONTACT_MESSAGES);
        rec.setName(name);
        rec.setEmail(email);
        rec.setMessage(message);
        rec.setReadFlag(false);
        rec.setStatus("OPEN");
        if (userId != null) {
            rec.setUserId(userId);
        }
        rec.store();
        return rec.getId();
    }

    // ──────────── Admin: list inquiries ────────────

    public record InquirySummary(
            long id, String name, String email, String messagePreview,
            OffsetDateTime submittedAt, boolean read, String status, Long userId
    ) {}

    /**
     * Fetch inquiries for admin. Supports filtering by status (OPEN / RESPONDED),
     * searching by name or email, and sorting by date or name.
     */
    public List<InquirySummary> listInquiries(
            String status,       // OPEN | RESPONDED | null (all)
            String search,       // partial name/email
            String sortBy,       // "date" (default) | "name"
            String sortDir       // "asc" | "desc" (default)
    ) {
        Condition where = DSL.trueCondition();

        if (status != null && !status.isBlank()) {
            where = where.and(CM_STATUS.eq(status));
        }
        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.toLowerCase() + "%";
            where = where.and(
                DSL.lower(CONTACT_MESSAGES.NAME).like(pattern)
                   .or(DSL.lower(CONTACT_MESSAGES.EMAIL).like(pattern))
            );
        }

        SortField<?> order;
        boolean desc = !"asc".equalsIgnoreCase(sortDir);
        if ("name".equalsIgnoreCase(sortBy)) {
            order = desc ? CONTACT_MESSAGES.NAME.desc() : CONTACT_MESSAGES.NAME.asc();
        } else {
            order = desc ? CONTACT_MESSAGES.SUBMITTED_AT.desc() : CONTACT_MESSAGES.SUBMITTED_AT.asc();
        }

        return dsl.select(
                        CONTACT_MESSAGES.ID,
                        CONTACT_MESSAGES.NAME,
                        CONTACT_MESSAGES.EMAIL,
                        CONTACT_MESSAGES.MESSAGE,
                        CONTACT_MESSAGES.SUBMITTED_AT,
                        CONTACT_MESSAGES.READ_FLAG,
                        CM_STATUS,
                        CM_USER_ID
                )
                .from(CONTACT_MESSAGES)
                .where(where)
                .orderBy(order)
                .fetch(r -> {
                    String msg = r.get(CONTACT_MESSAGES.MESSAGE);
                    String preview = msg.length() > 100 ? msg.substring(0, 100) + "…" : msg;
                    return new InquirySummary(
                            r.get(CONTACT_MESSAGES.ID),
                            r.get(CONTACT_MESSAGES.NAME),
                            r.get(CONTACT_MESSAGES.EMAIL),
                            preview,
                            r.get(CONTACT_MESSAGES.SUBMITTED_AT),
                            Boolean.TRUE.equals(r.get(CONTACT_MESSAGES.READ_FLAG)),
                            r.get(CM_STATUS),
                            r.get(CM_USER_ID)
                    );
                });
    }

    // ──────────── Admin: get single inquiry + thread ────────────

    public record InquiryDetail(
            long id, String name, String email, String message,
            OffsetDateTime submittedAt, boolean read, String status, Long userId,
            List<ReplyItem> replies
    ) {}

    public record ReplyItem(
            long id, String senderType, long senderUserId, String senderDisplayName,
            String body, OffsetDateTime createdAt, boolean read
    ) {}

    public InquiryDetail getInquiry(long id) {
        var r = dsl.select(
                        CONTACT_MESSAGES.ID,
                        CONTACT_MESSAGES.NAME,
                        CONTACT_MESSAGES.EMAIL,
                        CONTACT_MESSAGES.MESSAGE,
                        CONTACT_MESSAGES.SUBMITTED_AT,
                        CONTACT_MESSAGES.READ_FLAG,
                        CM_STATUS,
                        CM_USER_ID
                )
                .from(CONTACT_MESSAGES)
                .where(CONTACT_MESSAGES.ID.eq(id))
                .fetchOne();
        if (r == null) return null;

        // Mark as read
        dsl.update(CONTACT_MESSAGES)
           .set(CONTACT_MESSAGES.READ_FLAG, true)
           .where(CONTACT_MESSAGES.ID.eq(id))
           .execute();

        List<ReplyItem> replies = dsl.select(
                        IR_ID,
                        IR_SENDER_TYPE,
                        IR_SENDER_USER_ID,
                        IR_BODY,
                        IR_CREATED_AT,
                        IR_READ_FLAG
                )
                .from(IR)
                .where(IR_INQUIRY_ID.eq(id))
                .orderBy(IR_CREATED_AT.asc())
                .fetch(rr -> new ReplyItem(
                        rr.get(IR_ID),
                        rr.get(IR_SENDER_TYPE),
                        rr.get(IR_SENDER_USER_ID),
                        userHelper.resolveDisplayName(rr.get(IR_SENDER_USER_ID)),
                        rr.get(IR_BODY),
                        rr.get(IR_CREATED_AT),
                        Boolean.TRUE.equals(rr.get(IR_READ_FLAG))
                ));

        return new InquiryDetail(
                r.get(CONTACT_MESSAGES.ID),
                r.get(CONTACT_MESSAGES.NAME),
                r.get(CONTACT_MESSAGES.EMAIL),
                r.get(CONTACT_MESSAGES.MESSAGE),
                r.get(CONTACT_MESSAGES.SUBMITTED_AT),
                Boolean.TRUE.equals(r.get(CONTACT_MESSAGES.READ_FLAG)),
                r.get(CM_STATUS),
                r.get(CM_USER_ID),
                replies
        );
    }

    // ──────────── Admin: reply to inquiry ────────────

    public void adminReply(long inquiryId, long adminUserId, String htmlBody) {
        // Persist the reply
        dsl.insertInto(IR)
           .set(IR_INQUIRY_ID, inquiryId)
           .set(IR_SENDER_TYPE, "ADMIN")
           .set(IR_SENDER_USER_ID, adminUserId)
           .set(IR_BODY, htmlBody)
           .set(IR_READ_FLAG, false)
           .execute();

        // Update inquiry status to RESPONDED
        dsl.update(CONTACT_MESSAGES)
           .set(CM_STATUS, "RESPONDED")
           .where(CONTACT_MESSAGES.ID.eq(inquiryId))
           .execute();

        // Send email notification
        var inquiry = dsl.select(CONTACT_MESSAGES.EMAIL, CONTACT_MESSAGES.NAME)
                .from(CONTACT_MESSAGES)
                .where(CONTACT_MESSAGES.ID.eq(inquiryId))
                .fetchOne();
        if (inquiry != null) {
            String email = inquiry.get(CONTACT_MESSAGES.EMAIL);
            // Strip HTML for email body
            String plainBody = htmlBody.replaceAll("<[^>]*>", "").replaceAll("&nbsp;", " ").trim();
            mailService.sendEmail(email,
                    "Re: Your inquiry to the Scott Family Reunion",
                    "Hello " + inquiry.get(CONTACT_MESSAGES.NAME) + ",\n\n" +
                    plainBody + "\n\n— Scott Family Reunion Team");
        }
    }

    // ──────────── User: reply to admin response ────────────

    public void userReply(long inquiryId, long userId, String body) {
        // Verify this inquiry belongs to the user
        var inquiry = dsl.select(CM_USER_ID)
                .from(CONTACT_MESSAGES)
                .where(CONTACT_MESSAGES.ID.eq(inquiryId))
                .fetchOne();
        if (inquiry == null) throw new IllegalArgumentException("Inquiry not found");
        Long ownerUserId = inquiry.get(CM_USER_ID);
        if (ownerUserId == null || !ownerUserId.equals(userId)) {
            throw new SecurityException("You can only reply to your own inquiries");
        }

        dsl.insertInto(IR)
           .set(IR_INQUIRY_ID, inquiryId)
           .set(IR_SENDER_TYPE, "USER")
           .set(IR_SENDER_USER_ID, userId)
           .set(IR_BODY, body)
           .set(IR_READ_FLAG, false)
           .execute();

        // Move status back to OPEN so admin sees it
        dsl.update(CONTACT_MESSAGES)
           .set(CM_STATUS, "OPEN")
           .where(CONTACT_MESSAGES.ID.eq(inquiryId))
           .execute();
    }

    // ──────────── User: get notifications (unread admin replies) ────────────

    public record NotificationItem(
            long replyId, long inquiryId, String adminDisplayName,
            String bodyPreview, OffsetDateTime createdAt, boolean read
    ) {}

    public List<NotificationItem> getUserNotifications(long userId) {
        // Find all inquiries belonging to this user, then their admin replies
        return dsl.select(
                        IR_ID,
                        IR_INQUIRY_ID,
                        IR_SENDER_USER_ID,
                        IR_BODY,
                        IR_CREATED_AT,
                        IR_READ_FLAG
                )
                .from(IR)
                .join(CONTACT_MESSAGES).on(CONTACT_MESSAGES.ID.eq(IR_INQUIRY_ID))
                .where(
                    CM_USER_ID.eq(userId)
                    .and(IR_SENDER_TYPE.eq("ADMIN"))
                )
                .orderBy(IR_CREATED_AT.desc())
                .limit(50)
                .fetch(r -> {
                    String body = r.get(IR_BODY)
                                   .replaceAll("<[^>]*>", "")
                                   .replaceAll("&nbsp;", " ")
                                   .trim();
                    String preview = body.length() > 80 ? body.substring(0, 80) + "…" : body;
                    return new NotificationItem(
                            r.get(IR_ID),
                            r.get(IR_INQUIRY_ID),
                            userHelper.resolveDisplayName(r.get(IR_SENDER_USER_ID)),
                            preview,
                            r.get(IR_CREATED_AT),
                            Boolean.TRUE.equals(r.get(IR_READ_FLAG))
                    );
                });
    }

    public int getUnreadCount(long userId) {
        return dsl.selectCount()
                .from(IR)
                .join(CONTACT_MESSAGES).on(CONTACT_MESSAGES.ID.eq(IR_INQUIRY_ID))
                .where(
                    CM_USER_ID.eq(userId)
                    .and(IR_SENDER_TYPE.eq("ADMIN"))
                    .and(IR_READ_FLAG.eq(false))
                )
                .fetchOne(0, int.class);
    }

    public void markReplyRead(long replyId, long userId) {
        // Only mark if it belongs to the user's inquiry
        dsl.update(IR)
           .set(IR_READ_FLAG, true)
           .where(IR_ID.eq(replyId)
                  .and(IR_INQUIRY_ID.in(
                      dsl.select(CONTACT_MESSAGES.ID)
                         .from(CONTACT_MESSAGES)
                         .where(CM_USER_ID.eq(userId))
                  )))
           .execute();
    }

    /**
     * Mark ALL unread admin replies for a given inquiry as read.
     * Called when the user opens a conversation thread so the badge
     * clears for every reply in that thread, not just the one clicked.
     */
    public void markAllRepliesReadForInquiry(long inquiryId, long userId) {
        dsl.update(IR)
           .set(IR_READ_FLAG, true)
           .where(IR_INQUIRY_ID.eq(inquiryId)
                  .and(IR_SENDER_TYPE.eq("ADMIN"))
                  .and(IR_READ_FLAG.eq(false))
                  .and(IR_INQUIRY_ID.in(
                      dsl.select(CONTACT_MESSAGES.ID)
                         .from(CONTACT_MESSAGES)
                         .where(CM_USER_ID.eq(userId))
                  )))
           .execute();
    }

    // ──────────── User: get own inquiry thread ────────────

    public InquiryDetail getUserInquiry(long inquiryId, long userId) {
        var detail = getInquiry(inquiryId);
        if (detail == null) return null;
        if (detail.userId() == null || !detail.userId().equals(userId)) return null;
        return detail;
    }

    // ──────────── Cleanup: delete messages > 60 days ────────────

    public int deleteOldMessages() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(60);

        // Delete inquiries (replies cascade via FK)
        return dsl.deleteFrom(CONTACT_MESSAGES)
                .where(CONTACT_MESSAGES.SUBMITTED_AT.lt(cutoff))
                .execute();
    }
}
