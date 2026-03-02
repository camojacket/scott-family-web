package com.scottfamily.scottfamily.job;

import com.scottfamily.scottfamily.service.DonationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job to clean up stale PENDING donations.
 *
 * When a donor starts a Square checkout but never completes it (closes browser,
 * abandons the page, etc.), PENDING records remain indefinitely. This job marks
 * them as FAILED after 2 hours so the donation page reflects reality.
 *
 * Runs every 15 minutes.
 */
@Component
public class DonationCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(DonationCleanupJob.class);

    /** PENDING donations older than this many hours are auto-cancelled. */
    private static final int STALE_PENDING_HOURS = 2;

    private final DonationService donationService;

    public DonationCleanupJob(DonationService donationService) {
        this.donationService = donationService;
    }

    @Scheduled(fixedRate = 15 * 60 * 1000) // every 15 minutes
    public void cleanupStalePendingDonations() {
        try {
            int cancelled = donationService.cancelStalePending(STALE_PENDING_HOURS);
            if (cancelled > 0) {
                log.info("DonationCleanupJob: auto-cancelled {} stale PENDING donation(s) (older than {} hours)",
                        cancelled, STALE_PENDING_HOURS);
            }
        } catch (Exception e) {
            log.error("DonationCleanupJob: error cleaning up stale PENDING donations", e);
        }
    }
}
