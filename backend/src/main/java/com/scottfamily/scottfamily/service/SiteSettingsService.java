package com.scottfamily.scottfamily.service;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Simple key-value store backed by the SITE_SETTINGS table.
 * Uses inline DSL references since jOOQ codegen may not include the new table yet.
 */
@Service
public class SiteSettingsService {

    private static final Table<?> SITE_SETTINGS = DSL.table(DSL.name("site_settings"));
    private static final Field<String> KEY   = DSL.field(DSL.name("setting_key"),   String.class);
    private static final Field<String> VALUE = DSL.field(DSL.name("setting_value"), String.class);

    private final DSLContext dsl;

    public SiteSettingsService(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** Return all settings as a map. */
    public Map<String, String> getAll() {
        return dsl.select(KEY, VALUE)
                .from(SITE_SETTINGS)
                .fetchStream()
                .collect(Collectors.toMap(r -> r.get(KEY), r -> r.get(VALUE) != null ? r.get(VALUE) : ""));
    }

    /** Get a single setting, or null if missing. */
    public String get(String key) {
        return dsl.select(VALUE)
                .from(SITE_SETTINGS)
                .where(KEY.eq(key))
                .fetchOne(VALUE);
    }

    /** Upsert a setting. */
    public void put(String key, String value) {
        int updated = dsl.update(SITE_SETTINGS)
                .set(VALUE, value)
                .where(KEY.eq(key))
                .execute();
        if (updated == 0) {
            dsl.insertInto(SITE_SETTINGS)
                    .set(KEY, key)
                    .set(VALUE, value)
                    .execute();
        }
    }

    /** Bulk upsert from a map. */
    public void putAll(Map<String, String> entries) {
        entries.forEach(this::put);
    }

    /** Convenience: check if a bypass-style boolean flag is "true". */
    public boolean isEnabled(String key) {
        return "true".equalsIgnoreCase(get(key));
    }

    // Well-known keys
    public static final String BYPASS_SIGNUP_APPROVAL          = "bypass_signup_approval";
    public static final String BYPASS_PROFILE_CHANGE_APPROVAL  = "bypass_profile_change_approval";
    public static final String BYPASS_PEOPLE_REQUEST_APPROVAL  = "bypass_people_request_approval";
}
