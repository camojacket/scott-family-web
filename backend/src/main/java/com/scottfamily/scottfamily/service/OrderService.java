package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

/**
 * Service for managing shirt/merch orders.
 *
 * Order lifecycle:
 *   PENDING (stock NOT decremented) → PAID (stock decremented atomically) → FULFILLED
 *                                   → CANCELLED (no stock to restore)
 *   PENDING orders expire after 30 minutes — cleaned up by OrderCleanupJob.
 */
@Service
public class OrderService {

    /** PENDING orders expire after this many minutes. */
    public static final int PENDING_EXPIRY_MINUTES = 30;

    // ── Orders table ──
    private static final Table<?>              ORDERS          = DSL.table(DSL.name("orders"));
    private static final Field<Long>           O_ID            = DSL.field(DSL.name("orders", "id"),                Long.class);
    private static final Field<Long>           O_USER_ID       = DSL.field(DSL.name("orders", "user_id"),           Long.class);
    private static final Field<String>         O_IDEMP_KEY     = DSL.field(DSL.name("orders", "idempotency_key"),   String.class);
    private static final Field<String>         O_STATUS        = DSL.field(DSL.name("orders", "status"),            String.class);
    private static final Field<Integer>        O_TOTAL         = DSL.field(DSL.name("orders", "total_cents"),       Integer.class);
    private static final Field<String>         O_SQ_PAY_ID     = DSL.field(DSL.name("orders", "square_payment_id"), String.class);
    private static final Field<String>         O_SQ_RECEIPT    = DSL.field(DSL.name("orders", "square_receipt_url"),String.class);
    private static final Field<String>         O_NOTES         = DSL.field(DSL.name("orders", "notes"),             String.class);
    private static final Field<OffsetDateTime> O_CREATED       = DSL.field(DSL.name("orders", "created_at"),        OffsetDateTime.class);
    private static final Field<OffsetDateTime> O_UPDATED       = DSL.field(DSL.name("orders", "updated_at"),        OffsetDateTime.class);
    private static final Field<OffsetDateTime> O_EXPIRES       = DSL.field(DSL.name("orders", "expires_at"),        OffsetDateTime.class);

    // ── Order items table ──
    private static final Table<?>              ITEMS           = DSL.table(DSL.name("order_items"));
    private static final Field<Long>           I_ID            = DSL.field(DSL.name("order_items", "id"),               Long.class);
    private static final Field<Long>           I_ORDER_ID      = DSL.field(DSL.name("order_items", "order_id"),         Long.class);
    private static final Field<Long>           I_VARIANT_ID    = DSL.field(DSL.name("order_items", "variant_id"),       Long.class);
    private static final Field<Integer>        I_QTY           = DSL.field(DSL.name("order_items", "quantity"),          Integer.class);
    private static final Field<Integer>        I_UNIT_PRICE    = DSL.field(DSL.name("order_items", "unit_price_cents"), Integer.class);
    private static final Field<String>         I_PROD_NAME     = DSL.field(DSL.name("order_items", "product_name"),     String.class);
    private static final Field<String>         I_SIZE          = DSL.field(DSL.name("order_items", "size"),              String.class);
    private static final Field<String>         I_COLOR         = DSL.field(DSL.name("order_items", "color"),             String.class);

    private final DSLContext dsl;
    private final StoreService storeService;

    public OrderService(DSLContext dsl, StoreService storeService) {
        this.dsl = dsl;
        this.storeService = storeService;
    }

    // ── DTOs ──

    public record OrderDto(
            Long id,
            Long userId,
            String displayName,
            String status,
            int totalCents,
            String squarePaymentId,
            String squareReceiptUrl,
            String notes,
            String createdAt,
            String updatedAt,
            List<OrderItemDto> items
    ) {}

    public record OrderItemDto(
            Long id,
            Long variantId,
            int quantity,
            int unitPriceCents,
            String productName,
            String size,
            String color
    ) {}

    public record CartItem(
            Long variantId,
            int quantity
    ) {}

    public record CreateOrderRequest(
            List<CartItem> items,
            String notes,
            String idempotencyKey
    ) {}

    // ── Read ──

    public List<OrderDto> getOrdersByUser(Long userId) {
        return dsl.select(O_ID, O_USER_ID, O_STATUS, O_TOTAL, O_SQ_PAY_ID, O_SQ_RECEIPT, O_NOTES, O_CREATED, O_UPDATED)
                .from(ORDERS)
                .where(O_USER_ID.eq(userId))
                .orderBy(O_CREATED.desc())
                .fetch()
                .map(this::mapOrder);
    }

    public OrderDto getOrder(Long orderId) {
        var rec = dsl.select(O_ID, O_USER_ID, O_STATUS, O_TOTAL, O_SQ_PAY_ID, O_SQ_RECEIPT, O_NOTES, O_CREATED, O_UPDATED)
                .from(ORDERS)
                .where(O_ID.eq(orderId))
                .fetchOne();
        if (rec == null) return null;
        return mapOrder(rec);
    }

    public List<OrderDto> listAllOrders() {
        return dsl.select(O_ID, O_USER_ID, O_STATUS, O_TOTAL, O_SQ_PAY_ID, O_SQ_RECEIPT, O_NOTES, O_CREATED, O_UPDATED)
                .from(ORDERS)
                .orderBy(O_CREATED.desc())
                .fetch()
                .map(this::mapOrder);
    }

    public List<OrderDto> listOrdersByStatus(String status) {
        return dsl.select(O_ID, O_USER_ID, O_STATUS, O_TOTAL, O_SQ_PAY_ID, O_SQ_RECEIPT, O_NOTES, O_CREATED, O_UPDATED)
                .from(ORDERS)
                .where(O_STATUS.eq(status))
                .orderBy(O_CREATED.desc())
                .fetch()
                .map(this::mapOrder);
    }

    // ── Write ──

    /**
     * Create a new order from cart items.
     * Validates stock availability but does NOT decrement stock yet.
     * Stock is decremented atomically when the order is confirmed (markPaid).
     * Supports idempotency: if the same idempotencyKey already maps to a PENDING order, returns it.
     */
    @Transactional
    public OrderDto createOrder(Long userId, CreateOrderRequest req) {
        // Idempotency check: if same key already exists, return the existing order
        if (req.idempotencyKey() != null && !req.idempotencyKey().isBlank()) {
            var existing = dsl.select(O_ID, O_STATUS)
                    .from(ORDERS)
                    .where(O_IDEMP_KEY.eq(req.idempotencyKey()))
                    .fetchOne();
            if (existing != null) {
                return getOrder(existing.get(O_ID));
            }
        }

        int totalCents = 0;

        // Validate all items and calculate total (stock is checked but NOT decremented)
        for (var item : req.items()) {
            var vRec = dsl.select(
                    DSL.field(DSL.name("product_variants", "id"), Long.class),
                    DSL.field(DSL.name("product_variants", "size"), String.class),
                    DSL.field(DSL.name("product_variants", "color"), String.class),
                    DSL.field(DSL.name("product_variants", "price_cents"), Integer.class),
                    DSL.field(DSL.name("product_variants", "stock"), Integer.class),
                    DSL.field(DSL.name("products", "base_price_cents"), Integer.class),
                    DSL.field(DSL.name("products", "name"), String.class)
            )
                    .from(DSL.table(DSL.name("product_variants")))
                    .join(DSL.table(DSL.name("products")))
                    .on(DSL.field(DSL.name("product_variants", "product_id"), Long.class)
                            .eq(DSL.field(DSL.name("products", "id"), Long.class)))
                    .where(DSL.field(DSL.name("product_variants", "id"), Long.class).eq(item.variantId())
                            .and(DSL.field(DSL.name("products", "active"), Boolean.class).eq(true))
                            .and(DSL.field(DSL.name("product_variants", "active"), Boolean.class).eq(true)))
                    .fetchOne();

            if (vRec == null) {
                throw new IllegalArgumentException("Variant not found or product is inactive: " + item.variantId());
            }

            int stock = vRec.get(DSL.field(DSL.name("product_variants", "stock"), Integer.class));
            if (stock < item.quantity()) {
                String prodName = vRec.get(DSL.field(DSL.name("products", "name"), String.class));
                String size = vRec.get(DSL.field(DSL.name("product_variants", "size"), String.class));
                throw new IllegalArgumentException(
                        "Insufficient stock for " + prodName + " (" + size + "): " + stock + " available");
            }

            Integer variantPrice = vRec.get(DSL.field(DSL.name("product_variants", "price_cents"), Integer.class));
            int basePrice = vRec.get(DSL.field(DSL.name("products", "base_price_cents"), Integer.class));
            int unitPrice = variantPrice != null ? variantPrice : basePrice;
            totalCents += unitPrice * item.quantity();
        }

        // Create order with expiration
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(PENDING_EXPIRY_MINUTES);

        Field<Long>    userId_f   = DSL.field(DSL.name("user_id"),         Long.class);
        Field<String>  idemp_f    = DSL.field(DSL.name("idempotency_key"), String.class);
        Field<Integer> total_f    = DSL.field(DSL.name("total_cents"),     Integer.class);
        Field<String>  notes_f    = DSL.field(DSL.name("notes"),           String.class);
        Field<OffsetDateTime> exp_f = DSL.field(DSL.name("expires_at"),    OffsetDateTime.class);

        var orderResult = dsl.insertInto(ORDERS)
                .set(userId_f,  userId)
                .set(idemp_f,   req.idempotencyKey())
                .set(total_f,   totalCents)
                .set(notes_f,   req.notes())
                .set(exp_f,     expiresAt)
                .returningResult(DSL.field(DSL.name("id"), Long.class))
                .fetchOne();

        Long orderId = orderResult != null ? orderResult.get(0, Long.class) : null;
        if (orderId == null) throw new RuntimeException("Failed to create order");

        // Create order items (snapshots only — no stock decrement)
        for (var item : req.items()) {
            var vRec = dsl.select(
                    DSL.field(DSL.name("product_variants", "size"), String.class),
                    DSL.field(DSL.name("product_variants", "color"), String.class),
                    DSL.field(DSL.name("product_variants", "price_cents"), Integer.class),
                    DSL.field(DSL.name("products", "base_price_cents"), Integer.class),
                    DSL.field(DSL.name("products", "name"), String.class)
            )
                    .from(DSL.table(DSL.name("product_variants")))
                    .join(DSL.table(DSL.name("products")))
                    .on(DSL.field(DSL.name("product_variants", "product_id"), Long.class)
                            .eq(DSL.field(DSL.name("products", "id"), Long.class)))
                    .where(DSL.field(DSL.name("product_variants", "id"), Long.class).eq(item.variantId()))
                    .fetchOne();

            Integer vPrice = vRec.get(DSL.field(DSL.name("product_variants", "price_cents"), Integer.class));
            int bPrice = vRec.get(DSL.field(DSL.name("products", "base_price_cents"), Integer.class));
            int unitPrice = vPrice != null ? vPrice : bPrice;

            dsl.insertInto(ITEMS)
                    .set(DSL.field(DSL.name("order_id"),         Long.class),    orderId)
                    .set(DSL.field(DSL.name("variant_id"),       Long.class),    item.variantId())
                    .set(DSL.field(DSL.name("quantity"),          Integer.class), item.quantity())
                    .set(DSL.field(DSL.name("unit_price_cents"), Integer.class), unitPrice)
                    .set(DSL.field(DSL.name("product_name"),     String.class),  vRec.get(DSL.field(DSL.name("products", "name"), String.class)))
                    .set(DSL.field(DSL.name("size"),              String.class),  vRec.get(DSL.field(DSL.name("product_variants", "size"), String.class)))
                    .set(DSL.field(DSL.name("color"),             String.class),  vRec.get(DSL.field(DSL.name("product_variants", "color"), String.class)))
                    .execute();
        }

        return getOrder(orderId);
    }

    /**
     * Mark order as paid after Square payment.
     * Only transitions PENDING → PAID.
     * Atomically decrements stock for all items. If any item is out of stock, rolls back.
     */
    @Transactional
    public OrderDto markPaid(Long orderId, String squarePaymentId, String squareReceiptUrl) {
        // Status guard: only PENDING → PAID
        int affected = dsl.update(ORDERS)
                .set(O_STATUS, "PAID")
                .set(O_SQ_PAY_ID, squarePaymentId)
                .set(O_SQ_RECEIPT, squareReceiptUrl)
                .set(O_UPDATED, OffsetDateTime.now())
                .where(O_ID.eq(orderId).and(O_STATUS.eq("PENDING")))
                .execute();

        if (affected == 0) {
            OrderDto existing = getOrder(orderId);
            if (existing != null && "PAID".equals(existing.status())) {
                return existing; // idempotent — already paid
            }
            throw new IllegalStateException(
                    "Cannot confirm order " + orderId + ": not in PENDING status");
        }

        // Now atomically decrement stock for each item.
        // Track successfully decremented variants so we can restore on partial failure.
        var items = dsl.select(I_VARIANT_ID, I_QTY)
                .from(ITEMS)
                .where(I_ORDER_ID.eq(orderId))
                .fetch();

        List<long[]> decremented = new ArrayList<>(); // [variantId, qty]
        for (var item : items) {
            Long variantId = item.get(I_VARIANT_ID);
            int qty = item.get(I_QTY);
            boolean ok = storeService.decrementStock(variantId, qty);
            if (!ok) {
                // Restore stock already decremented in this loop
                for (long[] prev : decremented) {
                    storeService.restoreStock(prev[0], (int) prev[1]);
                }
                // Payment went through but stock is insufficient.
                // Mark for admin manual refund instead of rolling back
                // (because Square already has the money — rollback only undoes DB state).
                dsl.update(ORDERS)
                        .set(O_STATUS, "REQUIRES_REFUND")
                        .set(O_NOTES, "Payment accepted but insufficient stock for variant "
                                + variantId + ". Admin must process refund via Square Dashboard.")
                        .set(O_UPDATED, OffsetDateTime.now())
                        .where(O_ID.eq(orderId))
                        .execute();
                return getOrder(orderId);
            }
            decremented.add(new long[]{variantId, qty});
        }

        return getOrder(orderId);
    }

    // ── State machine ──

    private static final Set<String> TERMINAL_STATES = Set.of("CANCELLED", "REFUNDED");

    /**
     * Valid admin status transitions:
     *   PENDING         → CANCELLED
     *   PAID            → FULFILLED, CANCELLED
     *   FULFILLED       → CANCELLED
     *   REQUIRES_REFUND → CANCELLED, REFUNDED
     *   CANCELLED / REFUNDED are terminal — no further transitions.
     */
    private boolean isValidTransition(String from, String to) {
        if (TERMINAL_STATES.contains(from)) return false;
        return switch (from) {
            case "PENDING"         -> "CANCELLED".equals(to);
            case "PAID"            -> "FULFILLED".equals(to) || "CANCELLED".equals(to);
            case "FULFILLED"       -> "CANCELLED".equals(to);
            case "REQUIRES_REFUND" -> "CANCELLED".equals(to) || "REFUNDED".equals(to);
            default                -> false;
        };
    }

    /** Admin: update order status with state machine enforcement and stock-aware logic. */
    @Transactional
    public OrderDto updateStatus(Long orderId, String newStatus) {
        OrderDto current = getOrder(orderId);
        if (current == null) return null;

        if (!isValidTransition(current.status(), newStatus)) {
            throw new IllegalStateException(
                    "Invalid status transition: " + current.status() + " → " + newStatus);
        }

        // Restore stock when cancelling an order that had stock decremented (PAID or FULFILLED)
        if ("CANCELLED".equals(newStatus)
                && ("PAID".equals(current.status()) || "FULFILLED".equals(current.status()))) {
            for (var item : current.items()) {
                storeService.restoreStock(item.variantId(), item.quantity());
            }
        }

        dsl.update(ORDERS)
                .set(O_STATUS, newStatus)
                .set(O_UPDATED, OffsetDateTime.now())
                .where(O_ID.eq(orderId))
                .execute();
        return getOrder(orderId);
    }

    /**
     * Cancel expired PENDING orders. Called by the scheduled cleanup job.
     * Since stock is NOT decremented for PENDING orders, no stock restoration needed.
     * Returns the number of orders cancelled.
     */
    @Transactional
    public int cancelExpiredOrders() {
        return dsl.update(ORDERS)
                .set(O_STATUS, "CANCELLED")
                .set(O_UPDATED, OffsetDateTime.now())
                .set(O_NOTES, "Expired — payment not completed within " + PENDING_EXPIRY_MINUTES + " minutes")
                .where(O_STATUS.eq("PENDING")
                        .and(O_EXPIRES.lessThan(OffsetDateTime.now())))
                .execute();
    }

    // ── Helpers ──

    private OrderDto mapOrder(Record rec) {
        Long oid = rec.get(O_ID);
        Long uid = rec.get(O_USER_ID);

        List<OrderItemDto> items = dsl.select(I_ID, I_VARIANT_ID, I_QTY, I_UNIT_PRICE, I_PROD_NAME, I_SIZE, I_COLOR)
                .from(ITEMS)
                .where(I_ORDER_ID.eq(oid))
                .fetch()
                .map(i -> new OrderItemDto(
                        i.get(I_ID),
                        i.get(I_VARIANT_ID),
                        i.get(I_QTY) != null ? i.get(I_QTY) : 1,
                        i.get(I_UNIT_PRICE) != null ? i.get(I_UNIT_PRICE) : 0,
                        i.get(I_PROD_NAME),
                        i.get(I_SIZE),
                        i.get(I_COLOR)
                ));

        return new OrderDto(
                oid,
                uid,
                resolveDisplayName(uid),
                rec.get(O_STATUS),
                rec.get(O_TOTAL) != null ? rec.get(O_TOTAL) : 0,
                rec.get(O_SQ_PAY_ID),
                rec.get(O_SQ_RECEIPT),
                rec.get(O_NOTES),
                rec.get(O_CREATED) != null ? rec.get(O_CREATED).toString() : null,
                rec.get(O_UPDATED) != null ? rec.get(O_UPDATED).toString() : null,
                items
        );
    }

    private String resolveDisplayName(Long userId) {
        var rec = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME)
                .from(USERS)
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(USERS.ID.eq(userId))
                .fetchOne();

        if (rec != null && rec.get(PEOPLE.FIRST_NAME) != null) {
            String first = rec.get(PEOPLE.FIRST_NAME);
            String last = rec.get(PEOPLE.LAST_NAME);
            return (first + " " + (last != null ? last : "")).trim();
        }

        var usernameRec = dsl.select(USERS.USERNAME)
                .from(USERS)
                .where(USERS.ID.eq(userId))
                .fetchOne();
        return usernameRec != null ? usernameRec.get(USERS.USERNAME) : "Unknown";
    }
}
