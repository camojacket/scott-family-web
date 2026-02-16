package com.scottfamily.scottfamily.job;

import com.scottfamily.scottfamily.service.InquiryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job to auto‑delete contact‑us messages older than 60 days.
 * Replies cascade‑delete via the FK on INQUIRY_REPLIES.
 *
 * Runs once a day at 3:00 AM.
 */
@Component
public class InquiryCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(InquiryCleanupJob.class);

    private final InquiryService inquiryService;

    public InquiryCleanupJob(InquiryService inquiryService) {
        this.inquiryService = inquiryService;
    }

    @Scheduled(cron = "0 0 3 * * *") // 3:00 AM daily
    public void cleanupOldMessages() {
        try {
            int deleted = inquiryService.deleteOldMessages();
            if (deleted > 0) {
                log.info("InquiryCleanupJob: deleted {} messages older than 60 days", deleted);
            }
        } catch (Exception e) {
            log.error("InquiryCleanupJob: error cleaning up old messages", e);
        }
    }
}
