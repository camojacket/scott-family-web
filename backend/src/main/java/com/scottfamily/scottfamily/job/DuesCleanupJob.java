package com.scottfamily.scottfamily.job;

import com.scottfamily.scottfamily.service.DuesService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job to clean up stale PENDING dues payments.
 *
 * When a user starts a Square checkout but never completes it (closes the browser,
 * abandons the page, etc.), PENDING records remain indefinitely because Square never
 * fires a webhook for payments that were never attempted.
 *
 * This job marks PENDING records older than 2 hours as FAILED so that:
 *   - The user can re-attempt payment without conflicting with stale records.
 *   - The dues page shows the abandoned attempt as "Failed" instead of hiding it.
 *
 * Runs every 15 minutes.
 */
@Component
public class DuesCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(DuesCleanupJob.class);

    /** PENDING dues records older than this many hours are auto-cancelled. */
    private static final int STALE_PENDING_HOURS = 2;

    private final DuesService duesService;

    public DuesCleanupJob(DuesService duesService) {
        this.duesService = duesService;
    }

    @Scheduled(fixedRate = 15 * 60 * 1000) // every 15 minutes
    public void cleanupStalePendingDues() {
        try {
            int cancelled = duesService.cancelStalePending(STALE_PENDING_HOURS);
            if (cancelled > 0) {
                log.info("DuesCleanupJob: auto-cancelled {} stale PENDING dues records (older than {} hours)",
                        cancelled, STALE_PENDING_HOURS);
            }
        } catch (Exception e) {
            log.error("DuesCleanupJob: error cleaning up stale PENDING dues", e);
        }
    }
}
