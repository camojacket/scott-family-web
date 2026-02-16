package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.OrderService;
import com.scottfamily.scottfamily.service.OrderService.*;
import com.scottfamily.scottfamily.service.StoreService;
import com.scottfamily.scottfamily.service.StoreService.*;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;

import java.io.IOException;

import java.util.List;
import java.util.Map;

/**
 * REST API for the store (shirts/merch) and orders.
 *
 *   ── Public (authenticated) ──
 *   GET    /api/store/products              — list active products
 *   GET    /api/store/products/{id}         — get single product
 *   POST   /api/store/orders                — create order from cart
 *   POST   /api/store/orders/{id}/confirm   — confirm payment
 *   POST   /api/store/orders/{id}/cancel    — cancel own order (if PAID, not yet fulfilled)
 *   GET    /api/store/orders/mine           — get my orders
 *
 *   ── Admin ──
 *   GET    /api/store/admin/products        — list all products (inc. inactive)
 *   POST   /api/store/admin/products        — create product
 *   PUT    /api/store/admin/products/{id}   — update product
 *   DELETE /api/store/admin/products/{id}   — delete product
 *   POST   /api/store/admin/products/{id}/variants  — add variant
 *   PUT    /api/store/admin/variants/{id}   — update variant
 *   DELETE /api/store/admin/variants/{id}   — delete variant
 *   GET    /api/store/admin/orders          — list all orders
 *   PUT    /api/store/admin/orders/{id}/status — update order status
 *   POST   /api/store/admin/orders/{id}/refund — initiate Square refund
 */
@RestController
@RequestMapping("/api/store")
public class StoreController {

    private final StoreService storeService;
    private final OrderService orderService;
    private final CdnUploadService cdnUploadService;
    private final UserHelper userHelper;

    public StoreController(StoreService storeService, OrderService orderService,
                           CdnUploadService cdnUploadService, UserHelper userHelper) {
        this.storeService = storeService;
        this.orderService = orderService;
        this.cdnUploadService = cdnUploadService;
        this.userHelper = userHelper;
    }

    // ═══════════════════════════════════════════════════════════
    //  Public product endpoints
    // ═══════════════════════════════════════════════════════════

    @GetMapping("/products")
    public List<ProductDto> listProducts() {
        return storeService.listActiveProducts();
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<?> getProduct(@PathVariable Long id) {
        ProductDto p = storeService.getProduct(id);
        if (p == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(p);
    }

    // ═══════════════════════════════════════════════════════════
    //  Order endpoints (authenticated users)
    // ═══════════════════════════════════════════════════════════

    @PostMapping("/orders")
    public ResponseEntity<?> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        try {
            OrderDto order = orderService.createOrder(userId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(order);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/{id}/confirm")
    public ResponseEntity<?> confirmOrder(
            @PathVariable Long id,
            @Valid @RequestBody ConfirmOrderRequest request,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        OrderDto order = orderService.getOrder(id);
        if (order == null) return ResponseEntity.notFound().build();
        if (!order.userId().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your order"));
        }

        try {
            OrderDto updated = orderService.markPaid(id, request.squarePaymentId, request.squareReceiptUrl);
            if ("REQUIRES_REFUND".equals(updated.status())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Payment was accepted but one or more items are now out of stock. A refund will be processed.",
                        "order", updated
                ));
            }
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/orders/mine")
    public ResponseEntity<?> getMyOrders(Authentication auth) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        return ResponseEntity.ok(orderService.getOrdersByUser(userId));
    }

    /**
     * User cancels their own order. Only allowed for PAID orders (not yet fulfilled).
     * Stock is restored automatically by updateStatus.
     */
    @PostMapping("/orders/{id}/cancel")
    public ResponseEntity<?> cancelMyOrder(@PathVariable Long id, Authentication auth) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));

        OrderDto order = orderService.getOrder(id);
        if (order == null) return ResponseEntity.notFound().build();
        if (!order.userId().equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Not your order"));
        }

        if (!"PAID".equals(order.status())) {
            String msg = switch (order.status()) {
                case "PENDING"   -> "Order payment has not been completed yet.";
                case "FULFILLED" -> "Order has already been fulfilled. Please contact us for a refund.";
                case "CANCELLED" -> "Order is already cancelled.";
                case "REFUNDED"  -> "Order has already been refunded.";
                default          -> "Order cannot be cancelled in its current state.";
            };
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", msg));
        }

        try {
            OrderDto updated = orderService.updateStatus(id, "CANCELLED");
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  Admin: product management
    // ═══════════════════════════════════════════════════════════

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/products")
    public List<ProductDto> adminListProducts(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "200") int limit) {
        return storeService.listAllProducts(offset, Math.min(limit, 200));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/products")
    public ResponseEntity<?> adminCreateProduct(@Valid @RequestBody CreateProductRequest request) {
        ProductDto p = storeService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(p);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/products/{id}")
    public ResponseEntity<?> adminUpdateProduct(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductRequest request
    ) {
        ProductDto p = storeService.updateProduct(id, request);
        if (p == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(p);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/admin/products/{id}")
    public ResponseEntity<?> adminDeleteProduct(@PathVariable Long id) {
        try {
            storeService.deleteProduct(id);
            return ResponseEntity.ok(Map.of("deleted", id));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/products/{id}/variants")
    public ResponseEntity<?> adminAddVariant(
            @PathVariable Long id,
            @Valid @RequestBody CreateVariantRequest request
    ) {
        VariantDto v = storeService.createVariant(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(v);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/variants/{id}")
    public ResponseEntity<?> adminUpdateVariant(
            @PathVariable Long id,
            @Valid @RequestBody UpdateVariantRequest request
    ) {
        VariantDto v = storeService.updateVariant(id, request);
        if (v == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(v);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/admin/variants/{id}")
    public ResponseEntity<?> adminDeleteVariant(@PathVariable Long id) {
        storeService.deleteVariant(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/admin/products/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> adminUploadProductImage(@RequestPart("file") MultipartFile file) {
        try {
            var result = cdnUploadService.uploadUserImage(null, CdnUploadService.AssetKind.PRODUCT, file);
            return ResponseEntity.ok(Map.of(
                    "cdnUrl", result.getCdnUrl(),
                    "key", result.getKey(),
                    "contentType", result.getContentType(),
                    "bytes", result.getBytes()
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  Admin: order management
    // ═══════════════════════════════════════════════════════════

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/orders")
    public List<OrderDto> adminListOrders(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "200") int limit) {
        int capped = Math.min(limit, 200);
        if (status != null && !status.isBlank()) {
            return orderService.listOrdersByStatus(status, offset, capped);
        }
        return orderService.listAllOrders(offset, capped);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/orders/{id}/status")
    public ResponseEntity<?> adminUpdateOrderStatus(
            @PathVariable Long id,
            @RequestBody StatusUpdateRequest request
    ) {
        try {
            OrderDto order = orderService.updateStatus(id, request.status);
            if (order == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(order);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Admin-initiated refund. The actual Square refund is done by the frontend
     * calling /api/square/refund, then this endpoint records it on our side.
     * Transitions the order to REFUNDED and restores stock.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/orders/{id}/refund")
    public ResponseEntity<?> adminRefundOrder(
            @PathVariable Long id,
            @RequestBody(required = false) RefundNoteRequest refundNote
    ) {
        OrderDto order = orderService.getOrder(id);
        if (order == null) return ResponseEntity.notFound().build();

        // Allow refund from PAID, FULFILLED, or REQUIRES_REFUND
        String status = order.status();
        if (!"PAID".equals(status) && !"FULFILLED".equals(status) && !"REQUIRES_REFUND".equals(status)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Cannot refund order in " + status + " state"));
        }

        try {
            // Transition: PAID/FULFILLED → CANCELLED first (to restore stock), then → mark as REFUNDED
            // OR: REQUIRES_REFUND → REFUNDED directly
            if ("REQUIRES_REFUND".equals(status)) {
                OrderDto updated = orderService.updateStatus(id, "REFUNDED");
                return ResponseEntity.ok(updated);
            }

            // For PAID/FULFILLED, cancel first to restore stock, then a direct update to REFUNDED
            orderService.updateStatus(id, "CANCELLED");
            // Now set to REFUNDED (CANCELLED is terminal in state machine, so we do a direct update)
            orderService.forceStatus(id, "REFUNDED",
                    refundNote != null && refundNote.note != null ? refundNote.note : "Refunded by admin");
            return ResponseEntity.ok(orderService.getOrder(id));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Request DTOs ──

    public static class ConfirmOrderRequest {
        public String squarePaymentId;
        public String squareReceiptUrl;
    }

    public static class StatusUpdateRequest {
        public String status;
    }

    public static class RefundNoteRequest {
        public String note;
    }
}
