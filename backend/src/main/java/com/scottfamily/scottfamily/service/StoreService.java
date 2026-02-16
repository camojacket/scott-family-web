package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for managing the product catalog (shirts, merch).
 */
@Service
public class StoreService {

    // ── Products table ──
    private static final Table<?>              PRODUCTS        = DSL.table(DSL.name("products"));
    private static final Field<Long>           P_ID            = DSL.field(DSL.name("products", "id"),            Long.class);
    private static final Field<String>         P_NAME          = DSL.field(DSL.name("products", "name"),          String.class);
    private static final Field<String>         P_DESC          = DSL.field(DSL.name("products", "description"),   String.class);
    private static final Field<String>         P_IMAGE         = DSL.field(DSL.name("products", "image_url"),     String.class);
    private static final Field<Integer>        P_PRICE         = DSL.field(DSL.name("products", "base_price_cents"), Integer.class);
    private static final Field<Boolean>        P_ACTIVE        = DSL.field(DSL.name("products", "active"),        Boolean.class);
    private static final Field<OffsetDateTime> P_CREATED       = DSL.field(DSL.name("products", "created_at"),    OffsetDateTime.class);
    private static final Field<OffsetDateTime> P_UPDATED       = DSL.field(DSL.name("products", "updated_at"),    OffsetDateTime.class);

    // ── Product variants table ──
    private static final Table<?>              VARIANTS        = DSL.table(DSL.name("product_variants"));
    private static final Field<Long>           V_ID            = DSL.field(DSL.name("product_variants", "id"),          Long.class);
    private static final Field<Long>           V_PRODUCT_ID    = DSL.field(DSL.name("product_variants", "product_id"),  Long.class);
    private static final Field<String>         V_SIZE          = DSL.field(DSL.name("product_variants", "size"),        String.class);
    private static final Field<String>         V_COLOR         = DSL.field(DSL.name("product_variants", "color"),       String.class);
    private static final Field<Integer>        V_PRICE         = DSL.field(DSL.name("product_variants", "price_cents"), Integer.class);
    private static final Field<Integer>        V_STOCK         = DSL.field(DSL.name("product_variants", "stock"),       Integer.class);
    private static final Field<Boolean>        V_ACTIVE        = DSL.field(DSL.name("product_variants", "active"),      Boolean.class);

    private final DSLContext dsl;

    public StoreService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTOs ──

    public record ProductDto(
            Long id,
            String name,
            String description,
            String imageUrl,
            int basePriceCents,
            boolean active,
            List<VariantDto> variants
    ) {}

    public record VariantDto(
            Long id,
            Long productId,
            String size,
            String color,
            Integer priceCents,
            int stock,
            boolean active
    ) {}

    public record CreateProductRequest(
            String name,
            String description,
            String imageUrl,
            int basePriceCents
    ) {}

    public record UpdateProductRequest(
            String name,
            String description,
            String imageUrl,
            Integer basePriceCents,
            Boolean active
    ) {}

    public record CreateVariantRequest(
            String size,
            String color,
            Integer priceCents,
            int stock
    ) {}

    public record UpdateVariantRequest(
            String size,
            String color,
            Integer priceCents,
            Integer stock,
            Boolean active
    ) {}

    // ── Product Read ──

    /** List all active products (public storefront). */
    public List<ProductDto> listActiveProducts() {
        var products = dsl.select(P_ID, P_NAME, P_DESC, P_IMAGE, P_PRICE, P_ACTIVE)
                .from(PRODUCTS)
                .where(P_ACTIVE.eq(true))
                .orderBy(P_CREATED.desc())
                .fetch();

        // Batch-fetch all variants for the returned product IDs in a single query
        List<Long> productIds = products.map(r -> r.get(P_ID));
        var variantsByProduct = fetchVariantsByProductIds(productIds);

        return products.map(rec -> {
            Long pid = rec.get(P_ID);
            return new ProductDto(
                    pid,
                    rec.get(P_NAME),
                    rec.get(P_DESC),
                    rec.get(P_IMAGE),
                    rec.get(P_PRICE) != null ? rec.get(P_PRICE) : 0,
                    Boolean.TRUE.equals(rec.get(P_ACTIVE)),
                    variantsByProduct.getOrDefault(pid, List.of())
            );
        });
    }

    /** List ALL products including inactive (admin, paginated). */
    public List<ProductDto> listAllProducts(int offset, int limit) {
        var products = dsl.select(P_ID, P_NAME, P_DESC, P_IMAGE, P_PRICE, P_ACTIVE)
                .from(PRODUCTS)
                .orderBy(P_CREATED.desc())
                .offset(offset)
                .limit(limit)
                .fetch();

        // Batch-fetch all variants for the returned product IDs in a single query
        List<Long> productIds = products.map(r -> r.get(P_ID));
        var variantsByProduct = fetchVariantsByProductIds(productIds);

        return products.map(rec -> {
            Long pid = rec.get(P_ID);
            return new ProductDto(
                    pid,
                    rec.get(P_NAME),
                    rec.get(P_DESC),
                    rec.get(P_IMAGE),
                    rec.get(P_PRICE) != null ? rec.get(P_PRICE) : 0,
                    Boolean.TRUE.equals(rec.get(P_ACTIVE)),
                    variantsByProduct.getOrDefault(pid, List.of())
            );
        });
    }

    /** Backward-compatible overload */
    public List<ProductDto> listAllProducts() {
        return listAllProducts(0, 200);
    }

    /** Get a single product by ID. */
    public ProductDto getProduct(Long productId) {
        var rec = dsl.select(P_ID, P_NAME, P_DESC, P_IMAGE, P_PRICE, P_ACTIVE)
                .from(PRODUCTS)
                .where(P_ID.eq(productId))
                .fetchOne();
        if (rec == null) return null;
        return new ProductDto(
                rec.get(P_ID),
                rec.get(P_NAME),
                rec.get(P_DESC),
                rec.get(P_IMAGE),
                rec.get(P_PRICE) != null ? rec.get(P_PRICE) : 0,
                Boolean.TRUE.equals(rec.get(P_ACTIVE)),
                getVariantsForProduct(productId)
        );
    }

    private List<VariantDto> getVariantsForProduct(Long productId) {
        return dsl.select(V_ID, V_PRODUCT_ID, V_SIZE, V_COLOR, V_PRICE, V_STOCK, V_ACTIVE)
                .from(VARIANTS)
                .where(V_PRODUCT_ID.eq(productId))
                .orderBy(V_SIZE.asc())
                .fetch()
                .map(v -> new VariantDto(
                        v.get(V_ID),
                        v.get(V_PRODUCT_ID),
                        v.get(V_SIZE),
                        v.get(V_COLOR),
                        v.get(V_PRICE),
                        v.get(V_STOCK) != null ? v.get(V_STOCK) : 0,
                        Boolean.TRUE.equals(v.get(V_ACTIVE))
                ));
    }

    /** Batch-fetch variants for multiple products in a single query. */
    private Map<Long, List<VariantDto>> fetchVariantsByProductIds(List<Long> productIds) {
        if (productIds.isEmpty()) return Map.of();
        return dsl.select(V_ID, V_PRODUCT_ID, V_SIZE, V_COLOR, V_PRICE, V_STOCK, V_ACTIVE)
                .from(VARIANTS)
                .where(V_PRODUCT_ID.in(productIds))
                .orderBy(V_SIZE.asc())
                .fetch()
                .stream()
                .map(v -> new VariantDto(
                        v.get(V_ID),
                        v.get(V_PRODUCT_ID),
                        v.get(V_SIZE),
                        v.get(V_COLOR),
                        v.get(V_PRICE),
                        v.get(V_STOCK) != null ? v.get(V_STOCK) : 0,
                        Boolean.TRUE.equals(v.get(V_ACTIVE))
                ))
                .collect(Collectors.groupingBy(VariantDto::productId));
    }

    // ── Product Write (Admin) ──

    @Transactional
    public ProductDto createProduct(CreateProductRequest req) {
        // Unqualified fields for insert
        Field<String>  name  = DSL.field(DSL.name("name"),             String.class);
        Field<String>  desc  = DSL.field(DSL.name("description"),      String.class);
        Field<String>  img   = DSL.field(DSL.name("image_url"),        String.class);
        Field<Integer> price = DSL.field(DSL.name("base_price_cents"), Integer.class);

        var result = dsl.insertInto(PRODUCTS)
                .set(name,  req.name())
                .set(desc,  req.description())
                .set(img,   req.imageUrl())
                .set(price, req.basePriceCents())
                .returningResult(DSL.field(DSL.name("id"), Long.class))
                .fetchOne();

        Long id = result != null ? result.get(0, Long.class) : null;
        return id != null ? getProduct(id) : null;
    }

    @Transactional
    public ProductDto updateProduct(Long productId, UpdateProductRequest req) {
        var upd = dsl.update(PRODUCTS);
        var step = upd.set(P_UPDATED, OffsetDateTime.now());

        if (req.name() != null)           step = step.set(P_NAME,   req.name());
        if (req.description() != null)    step = step.set(P_DESC,   req.description());
        if (req.imageUrl() != null)       step = step.set(P_IMAGE,  req.imageUrl());
        if (req.basePriceCents() != null) step = step.set(P_PRICE,  req.basePriceCents());
        if (req.active() != null)         step = step.set(P_ACTIVE, req.active());

        step.where(P_ID.eq(productId)).execute();
        return getProduct(productId);
    }

    @Transactional
    public void deleteProduct(Long productId) {
        // Check if any order_items reference variants of this product
        var variantIds = dsl.select(V_ID).from(VARIANTS).where(V_PRODUCT_ID.eq(productId)).fetch(V_ID);
        if (!variantIds.isEmpty()) {
            int refs = dsl.fetchCount(
                    DSL.selectFrom(DSL.table(DSL.name("order_items")))
                            .where(DSL.field(DSL.name("order_items", "variant_id"), Long.class).in(variantIds))
            );
            if (refs > 0) {
                throw new IllegalStateException(
                        "Cannot delete product: " + refs + " order item(s) reference its variants. "
                        + "Deactivate the product instead.");
            }
        }
        dsl.deleteFrom(VARIANTS).where(V_PRODUCT_ID.eq(productId)).execute();
        dsl.deleteFrom(PRODUCTS).where(P_ID.eq(productId)).execute();
    }

    // ── Variant Write (Admin) ──

    @Transactional
    public VariantDto createVariant(Long productId, CreateVariantRequest req) {
        Field<Long>    pid   = DSL.field(DSL.name("product_id"),  Long.class);
        Field<String>  size  = DSL.field(DSL.name("size"),        String.class);
        Field<String>  color = DSL.field(DSL.name("color"),       String.class);
        Field<Integer> price = DSL.field(DSL.name("price_cents"), Integer.class);
        Field<Integer> stock = DSL.field(DSL.name("stock"),       Integer.class);

        var result = dsl.insertInto(VARIANTS)
                .set(pid,   productId)
                .set(size,  req.size())
                .set(color, req.color())
                .set(price, req.priceCents())
                .set(stock, req.stock())
                .returningResult(DSL.field(DSL.name("id"), Long.class))
                .fetchOne();

        Long id = result != null ? result.get(0, Long.class) : null;
        if (id == null) return null;

        var v = dsl.select(V_ID, V_PRODUCT_ID, V_SIZE, V_COLOR, V_PRICE, V_STOCK, V_ACTIVE)
                .from(VARIANTS)
                .where(V_ID.eq(id))
                .fetchOne();
        if (v == null) return null;
        return new VariantDto(v.get(V_ID), v.get(V_PRODUCT_ID), v.get(V_SIZE),
                v.get(V_COLOR), v.get(V_PRICE),
                v.get(V_STOCK) != null ? v.get(V_STOCK) : 0,
                Boolean.TRUE.equals(v.get(V_ACTIVE)));
    }

    @Transactional
    public VariantDto updateVariant(Long variantId, UpdateVariantRequest req) {
        var step = dsl.update(VARIANTS).set(V_ID, V_ID); // no-op start
        if (req.size() != null)   step = step.set(V_SIZE,   req.size());
        if (req.color() != null)  step = step.set(V_COLOR,  req.color());
        if (req.priceCents() != null) step = step.set(V_PRICE, req.priceCents());
        if (req.stock() != null)  step = step.set(V_STOCK,  req.stock());
        if (req.active() != null) step = step.set(V_ACTIVE, req.active());
        step.where(V_ID.eq(variantId)).execute();

        var v = dsl.select(V_ID, V_PRODUCT_ID, V_SIZE, V_COLOR, V_PRICE, V_STOCK, V_ACTIVE)
                .from(VARIANTS)
                .where(V_ID.eq(variantId))
                .fetchOne();
        if (v == null) return null;
        return new VariantDto(v.get(V_ID), v.get(V_PRODUCT_ID), v.get(V_SIZE),
                v.get(V_COLOR), v.get(V_PRICE),
                v.get(V_STOCK) != null ? v.get(V_STOCK) : 0,
                Boolean.TRUE.equals(v.get(V_ACTIVE)));
    }

    @Transactional
    public void deleteVariant(Long variantId) {
        dsl.deleteFrom(VARIANTS).where(V_ID.eq(variantId)).execute();
    }

    // ── Stock management ──

    /**
     * Atomically decrement stock for a variant.
     * Uses UPDATE ... WHERE stock >= quantity to prevent race conditions and negative stock.
     * Returns false if insufficient stock (no rows affected).
     */
    @Transactional
    public boolean decrementStock(Long variantId, int quantity) {
        int affected = dsl.update(VARIANTS)
                .set(V_STOCK, V_STOCK.minus(quantity))
                .where(V_ID.eq(variantId).and(V_STOCK.greaterOrEqual(quantity)))
                .execute();
        return affected > 0;
    }

    /**
     * Restore stock for a variant (used when cancelling/expiring orders).
     */
    @Transactional
    public void restoreStock(Long variantId, int quantity) {
        dsl.update(VARIANTS)
                .set(V_STOCK, V_STOCK.plus(quantity))
                .where(V_ID.eq(variantId))
                .execute();
    }
}
