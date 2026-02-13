package com.scottfamily.scottfamily.service;

import org.jooq.*;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Service for managing modular page content (stored as JSON blocks).
 * Each "page" is identified by a unique key (e.g. "history").
 */
@Service
public class PageContentService {

    private static final Table<?> PAGE_CONTENT = DSL.table(DSL.name("page_content"));
    private static final Field<Long>          F_ID         = DSL.field(DSL.name("id"),         SQLDataType.BIGINT.identity(true));
    private static final Field<String>        F_PAGE_KEY   = DSL.field(DSL.name("page_key"),   SQLDataType.NVARCHAR(100));
    private static final Field<String>        F_BLOCKS     = DSL.field(DSL.name("blocks"),     SQLDataType.NVARCHAR);
    private static final Field<LocalDateTime> F_UPDATED_AT = DSL.field(DSL.name("updated_at"), SQLDataType.LOCALDATETIME);
    private static final Field<Long>          F_UPDATED_BY = DSL.field(DSL.name("updated_by"), SQLDataType.BIGINT);

    private final DSLContext dsl;

    public PageContentService(DSLContext dsl) {
        this.dsl = dsl;
    }

    /**
     * Returns the JSON blocks string for a given page key, or null if no record exists.
     */
    public String getBlocks(String pageKey) {
        return dsl.select(F_BLOCKS)
                .from(PAGE_CONTENT)
                .where(F_PAGE_KEY.eq(pageKey))
                .fetchOne(F_BLOCKS);
    }

    /**
     * Upserts the blocks for a given page key.
     * @param pageKey   The page identifier (e.g. "history")
     * @param blocksJson The JSON array of content blocks
     * @param userId     The admin user ID performing the save
     */
    public void saveBlocks(String pageKey, String blocksJson, Long userId) {
        int updated = dsl.update(PAGE_CONTENT)
                .set(F_BLOCKS, blocksJson)
                .set(F_UPDATED_AT, LocalDateTime.now())
                .set(F_UPDATED_BY, userId)
                .where(F_PAGE_KEY.eq(pageKey))
                .execute();

        if (updated == 0) {
            dsl.insertInto(PAGE_CONTENT)
                    .set(F_PAGE_KEY, pageKey)
                    .set(F_BLOCKS, blocksJson)
                    .set(F_UPDATED_AT, LocalDateTime.now())
                    .set(F_UPDATED_BY, userId)
                    .execute();
        }
    }
}
