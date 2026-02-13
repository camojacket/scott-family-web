package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.OrderService;
import com.scottfamily.scottfamily.service.OrderService.*;
import com.scottfamily.scottfamily.service.StoreService;
import com.scottfamily.scottfamily.service.StoreService.*;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

/**
 * REST API for the store (shirts/merch) and orders.
 *
 *   ── Public (authenticated) ──
 *   GET    /api/store/products              — list active products
 *   GET    /api/store/products/{id}         — get single product
 *   POST   /api/store/orders                — create order from cart
 *   POST   /api/store/orders/{id}/confirm   — confirm payment
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
 */
@RestController
@RequestMapping("/api/store")
public class StoreController {

    private final StoreService storeService;
    private final OrderService orderService;
    private final CdnUploadService cdnUploadService;
    private final DSLContext dsl;

    public StoreController(StoreService storeService, OrderService orderService,
                           CdnUploadService cdnUploadService, DSLContext dsl) {
        this.storeService = storeService;
        this.orderService = orderService;
        this.cdnUploadService = cdnUploadService;
        this.dsl = dsl;
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
            @RequestBody CreateOrderRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
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
            @RequestBody ConfirmOrderRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
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
        Long userId = resolveUserId(auth.getName());
        if (userId == null) return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        return ResponseEntity.ok(orderService.getOrdersByUser(userId));
    }

    // ═══════════════════════════════════════════════════════════
    //  Admin: product management
    // ═══════════════════════════════════════════════════════════

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/products")
    public List<ProductDto> adminListProducts() {
        return storeService.listAllProducts();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/products")
    public ResponseEntity<?> adminCreateProduct(@RequestBody CreateProductRequest request) {
        ProductDto p = storeService.createProduct(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(p);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/products/{id}")
    public ResponseEntity<?> adminUpdateProduct(
            @PathVariable Long id,
            @RequestBody UpdateProductRequest request
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
            @RequestBody CreateVariantRequest request
    ) {
        VariantDto v = storeService.createVariant(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(v);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/variants/{id}")
    public ResponseEntity<?> adminUpdateVariant(
            @PathVariable Long id,
            @RequestBody UpdateVariantRequest request
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
    public List<OrderDto> adminListOrders(@RequestParam(required = false) String status) {
        if (status != null && !status.isBlank()) {
            return orderService.listOrdersByStatus(status);
        }
        return orderService.listAllOrders();
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

    // ── Helpers ──

    private Long resolveUserId(String username) {
        var rec = dsl.select(USERS.ID)
                .from(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        return rec != null ? rec.value1() : null;
    }

    // ── Request DTOs ──

    public static class ConfirmOrderRequest {
        public String squarePaymentId;
        public String squareReceiptUrl;
    }

    public static class StatusUpdateRequest {
        public String status;
    }
}
