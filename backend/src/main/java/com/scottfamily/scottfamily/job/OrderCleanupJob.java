package com.scottfamily.scottfamily.job;

import com.scottfamily.scottfamily.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job to clean up expired PENDING orders.
 *
 * PENDING orders that exceed OrderService.PENDING_EXPIRY_MINUTES are cancelled.
 * Since stock is NOT decremented until payment confirmation (PENDING → PAID),
 * no stock restoration is needed for expired orders.
 *
 * Runs every 5 minutes.
 */
@Component
public class OrderCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OrderCleanupJob.class);

    private final OrderService orderService;

    public OrderCleanupJob(OrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(fixedRate = 5 * 60 * 1000) // every 5 minutes
    public void cleanupExpiredOrders() {
        try {
            int cancelled = orderService.cancelExpiredOrders();
            if (cancelled > 0) {
                log.info("OrderCleanupJob: cancelled {} expired PENDING orders", cancelled);
            }
        } catch (Exception e) {
            log.error("OrderCleanupJob: error cleaning up expired orders", e);
        }
    }
}
