package com.scottfamily.scottfamily.controller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scottfamily.scottfamily.service.DuesService;
import com.scottfamily.scottfamily.service.OrderService;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Square webhook endpoint for payment event reconciliation.
 *
 * Safety net: if the frontend crashes between Square processing the payment and
 * calling /confirm, the webhook reconciles by transitioning PENDING → PAID/COMPLETED.
 *
 * Square webhook guarantees:
 *   - At-least-once delivery (we must be idempotent)
 *   - Retries on non-2xx responses (we must always return 200 after signature passes)
 *   - Events may arrive out of order
 *
 * Webhook URL to register in Square Dashboard: https://your-domain/api/webhooks/square
 * Subscribe to: payment.created, payment.updated
 */
@RestController
@RequestMapping("/api/webhooks")
public class SquareWebhookController {

    private static final Logger log = LoggerFactory.getLogger(SquareWebhookController.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Value("${square.webhook.signature-key:}")
    private String webhookSignatureKey;

    @Value("${square.webhook.notification-url:}")
    private String webhookNotificationUrl;

    private final DuesService duesService;
    private final OrderService orderService;

    public SquareWebhookController(DuesService duesService, OrderService orderService) {
        this.duesService = duesService;
        this.orderService = orderService;
    }

    /**
     * Receives Square webhook events. This endpoint is unauthenticated (permitAll)
     * but verifies the Square HMAC-SHA256 signature header.
     *
     * We read raw bytes from the request to avoid Spring's HttpMessageConverter
     * modifying whitespace/encoding, which would break signature verification.
     */
    @PostMapping("/square")
    public ResponseEntity<?> handleSquareWebhook(
            HttpServletRequest request,
            @RequestHeader(value = "x-square-hmacsha256-signature", required = false) String signature
    ) {
        // Read raw body bytes to preserve exact content for signature verification
        byte[] rawBytes;
        try {
            rawBytes = request.getInputStream().readAllBytes();
        } catch (IOException e) {
            log.error("Square webhook: failed to read request body", e);
            return ResponseEntity.ok(Map.of("received", true));
        }
        String rawBody = new String(rawBytes, StandardCharsets.UTF_8);

        // Verify signature if webhook key is configured
        if (webhookSignatureKey != null && !webhookSignatureKey.isBlank()) {
            if (signature == null || !verifySignature(rawBody, signature)) {
                log.warn("Square webhook: invalid signature, rejecting");
                // Return 200 to prevent Square from infinitely retrying a permanent config error.
                // Log at WARN level so it's visible but doesn't flood error alerts.
                return ResponseEntity.ok(Map.of("error", "Invalid signature", "received", false));
            }
        } else {
            log.warn("Square webhook: signature key not configured, skipping verification (NOT for production!)");
        }

        try {
            JsonNode root = MAPPER.readTree(rawBody);

            String eventType = root.has("type") ? root.get("type").asText() : null;
            if (eventType == null) {
                log.warn("Square webhook: no event type in payload");
                return ResponseEntity.ok(Map.of("received", true));
            }

            log.info("Square webhook received: {}", eventType);

            switch (eventType) {
                case "payment.created", "payment.updated" -> handlePaymentEvent(root);
                default -> log.info("Square webhook: ignoring event type {}", eventType);
            }
        } catch (Exception e) {
            log.error("Square webhook processing error", e);
            // Always return 200 to prevent Square from retrying
        }

        return ResponseEntity.ok(Map.of("received", true));
    }

    /**
     * Handle payment.created and payment.updated events.
     * Square doesn't fire separate "payment.completed" or "payment.failed" events —
     * instead, the payment status field indicates the outcome:
     *   COMPLETED → reconcile as successful payment
     *   FAILED / CANCELED → mark records as failed
     *   PENDING / APPROVED → ignore (intermediate states)
     */
    private void handlePaymentEvent(JsonNode root) {
        try {
            JsonNode data = root.path("data").path("object").path("payment");
            String paymentId = data.has("id") ? data.get("id").asText() : null;
            String receiptUrl = data.has("receipt_url") ? data.get("receipt_url").asText() : null;
            String status = data.has("status") ? data.get("status").asText() : null;

            if (paymentId == null) {
                log.warn("Square webhook: no payment ID in event");
                return;
            }

            log.info("Square webhook: payment {} status={}", paymentId, status);

            if ("FAILED".equals(status) || "CANCELED".equals(status)) {
                handlePaymentFailed(root);
                return;
            }

            // Only reconcile if the payment is actually COMPLETED
            if (!"COMPLETED".equals(status)) {
                log.info("Square webhook: payment {} status is {}, skipping (not terminal)", paymentId, status);
                return;
            }

            log.info("Square webhook: reconciling successful payment {}", paymentId);

            // Checkout API (CreatePaymentLink) sets reference_id on the Order, not always on the Payment.
            // The paymentNote we set at link creation appears in the payment's "note" field.
            String referenceId = data.has("reference_id") ? data.get("reference_id").asText() : null;
            if (referenceId == null || referenceId.isBlank()) {
                // Fallback: check payment note (set via paymentNote in CreatePaymentLink)
                referenceId = data.has("note") ? data.get("note").asText() : null;
            }
            if (referenceId == null || referenceId.isBlank()) {
                log.warn("Square webhook: payment {} has no reference_id or note, cannot reconcile. "
                        + "Ensure the Square payment is created with reference_id or paymentNote set to "
                        + "'order:{{orderId}}', 'db:{{batchId}}', or 'dues:{{userId}}:{{year}}'",
                        paymentId);
                return;
            }

            reconcilePayment(referenceId, paymentId, receiptUrl);
        } catch (Exception e) {
            log.error("Square webhook: error handling payment event", e);
        }
    }

    private void handlePaymentFailed(JsonNode root) {
        try {
            JsonNode data = root.path("data").path("object").path("payment");
            String referenceId = data.has("reference_id") ? data.get("reference_id").asText() : null;
            if (referenceId == null || referenceId.isBlank()) {
                referenceId = data.has("note") ? data.get("note").asText() : null;
            }

            if (referenceId == null || referenceId.isBlank()) {
                log.warn("Square webhook payment failed: no reference_id or note, cannot reconcile");
                return;
            }

            if (referenceId.startsWith("db:")) {
                String batchId = referenceId.substring(3);
                duesService.markBatchFailed(batchId);
                log.info("Square webhook: marked dues batch {} as FAILED", batchId);
            } else if (referenceId.startsWith("dues-batch:")) {
                // Legacy format — kept for back-compat with in-flight payments
                String batchId = referenceId.substring(11);
                duesService.markBatchFailed(batchId);
                log.info("Square webhook: marked dues batch {} as FAILED", batchId);
            } else if (referenceId.startsWith("dues:")) {
                String[] parts = referenceId.substring(5).split(":");
                if (parts.length != 2) {
                    log.error("Square webhook: malformed dues reference_id: {}", referenceId);
                    return;
                }
                Long userId = Long.parseLong(parts[0]);
                int year = Integer.parseInt(parts[1]);
                duesService.markFailed(userId, year);
                log.info("Square webhook: marked dues FAILED for user {} year {}", userId, year);
            } else if (referenceId.startsWith("order:")) {
                Long orderId = Long.parseLong(referenceId.substring(6));
                // updateStatus handles PENDING → CANCELLED correctly (no stock to restore)
                orderService.updateStatus(orderId, "CANCELLED");
                log.info("Square webhook: cancelled order {} due to payment failure", orderId);
            } else {
                log.warn("Square webhook: unknown reference_id format: {}", referenceId);
            }
        } catch (NumberFormatException e) {
            log.error("Square webhook: failed to parse reference_id", e);
        } catch (Exception e) {
            log.error("Square webhook: error handling payment.failed", e);
        }
    }

    /**
     * Reconcile a payment by reference_id. Idempotent — if the record is already
     * COMPLETED/PAID, the service methods return the existing record without error.
     */
    private void reconcilePayment(String referenceId, String paymentId, String receiptUrl) {
        try {
            if (referenceId.startsWith("order:")) {
                Long orderId = Long.parseLong(referenceId.substring(6));
                var order = orderService.getOrder(orderId);
                if (order == null) {
                    log.warn("Square webhook: order {} not found for payment {}", orderId, paymentId);
                    return;
                }
                if ("PAID".equals(order.status()) || "FULFILLED".equals(order.status())) {
                    log.info("Square webhook: order {} already {}, skipping (duplicate webhook)", orderId, order.status());
                    return;
                }
                if (!"PENDING".equals(order.status())) {
                    log.warn("Square webhook: order {} is {} — cannot reconcile payment {}", orderId, order.status(), paymentId);
                    return;
                }
                orderService.markPaid(orderId, paymentId, receiptUrl);
                var updated = orderService.getOrder(orderId);
                if (updated != null && "REQUIRES_REFUND".equals(updated.status())) {
                    log.error("Square webhook: order {} paid but stock insufficient — REQUIRES_REFUND. "
                            + "Admin must process refund via Square Dashboard.", orderId);
                } else {
                    log.info("Square webhook: reconciled order {} as PAID", orderId);
                }

            } else if (referenceId.startsWith("db:")) {
                String batchId = referenceId.substring(3);
                try {
                    duesService.confirmBatch(batchId, paymentId, receiptUrl);
                    log.info("Square webhook: reconciled dues batch {}", batchId);
                } catch (IllegalStateException e) {
                    log.info("Square webhook: dues batch {} already handled: {}", batchId, e.getMessage());
                }

            } else if (referenceId.startsWith("dues-batch:")) {
                // Legacy format — kept for back-compat with in-flight payments
                String batchId = referenceId.substring(11);
                try {
                    duesService.confirmBatch(batchId, paymentId, receiptUrl);
                    log.info("Square webhook: reconciled dues batch {}", batchId);
                } catch (IllegalStateException e) {
                    log.info("Square webhook: dues batch {} already handled: {}", batchId, e.getMessage());
                }

            } else if (referenceId.startsWith("dues:")) {
                String[] parts = referenceId.substring(5).split(":");
                if (parts.length != 2) {
                    log.error("Square webhook: malformed dues reference_id: {}", referenceId);
                    return;
                }
                Long userId = Long.parseLong(parts[0]);
                int year = Integer.parseInt(parts[1]);
                var dues = duesService.getByUserAndYear(userId, year);
                if (dues == null) {
                    log.warn("Square webhook: no dues record for user {} year {} (payment {})", userId, year, paymentId);
                    return;
                }
                if ("COMPLETED".equals(dues.status())) {
                    log.info("Square webhook: dues for user {} year {} already COMPLETED, skipping (duplicate webhook)", userId, year);
                    return;
                }
                if (!"PENDING".equals(dues.status())) {
                    log.warn("Square webhook: dues for user {} year {} is {} — cannot reconcile", userId, year, dues.status());
                    return;
                }
                duesService.markCompleted(userId, year, paymentId, receiptUrl);
                log.info("Square webhook: reconciled dues for user {} year {}", userId, year);

            } else {
                log.warn("Square webhook: unknown reference_id format: {}", referenceId);
            }
        } catch (IllegalStateException e) {
            // markPaid/markCompleted threw because status already transitioned — this is fine (concurrent /confirm + webhook)
            log.info("Square webhook: concurrent transition for {}, already handled: {}", referenceId, e.getMessage());
        } catch (NumberFormatException e) {
            log.error("Square webhook: failed to parse reference_id: {}", referenceId, e);
        }
    }

    /**
     * Verify the Square webhook signature using HMAC-SHA256 with timing-constant comparison.
     * See: https://developer.squareup.com/docs/webhooks/step3validate
     */
    private boolean verifySignature(String body, String expectedSignature) {
        try {
            String payload = webhookNotificationUrl + body;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSignatureKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String computed = Base64.getEncoder().encodeToString(hash);
            // Timing-constant comparison to prevent timing attacks
            return MessageDigest.isEqual(
                    computed.getBytes(StandardCharsets.UTF_8),
                    expectedSignature.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("Square webhook: signature verification failed", e);
            return false;
        }
    }
}
