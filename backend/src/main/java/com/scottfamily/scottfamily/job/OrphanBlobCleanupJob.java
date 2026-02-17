package com.scottfamily.scottfamily.job;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobItem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scottfamily.scottfamily.properties.CdnProperties;
import com.scottfamily.scottfamily.service.SiteSettingsService;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Scheduled job that scans Azure Blob Storage for orphaned blobs —
 * files that are no longer referenced by any database record.
 *
 * Runs once daily at 4:00 AM. Collects all blob keys referenced across:
 *   - gallery_images.blob_key
 *   - obituary.blob_key
 *   - newsletters.blob_key
 *   - family_artifacts.blob_key
 *   - people.profile_picture_url, people.banner_image_url (CDN URLs → blob keys)
 *   - products.image_url (CDN URLs → blob keys)
 *   - site_settings "slideshow_images" (JSON array with CDN URLs)
 *
 * Any blob in the container NOT in this reference set AND older than 24 hours
 * is deleted (the 24h grace period prevents racing with in-progress uploads).
 */
@Component
public class OrphanBlobCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OrphanBlobCleanupJob.class);

    private final BlobContainerClient container;
    private final DSLContext dsl;
    private final CdnProperties cdnProps;
    private final SiteSettingsService settingsService;
    private final ObjectMapper objectMapper;

    // ── DB tables & fields ──────────────────────────────────────────────────

    private static final Table<?> GALLERY_IMAGES   = DSL.table(DSL.name("GALLERY_IMAGES"));
    private static final Table<?> OBITUARY         = DSL.table(DSL.name("OBITUARY"));
    private static final Table<?> NEWSLETTERS      = DSL.table(DSL.name("NEWSLETTERS"));
    private static final Table<?> FAMILY_ARTIFACTS = DSL.table(DSL.name("FAMILY_ARTIFACTS"));
    private static final Table<?> PEOPLE           = DSL.table(DSL.name("PEOPLE"));
    private static final Table<?> PRODUCTS         = DSL.table(DSL.name("products"));

    private static final Field<String> G_BLOB_KEY  = DSL.field(DSL.name("GALLERY_IMAGES",   "blob_key"), String.class);
    private static final Field<String> O_BLOB_KEY  = DSL.field(DSL.name("OBITUARY",         "blob_key"), String.class);
    private static final Field<String> N_BLOB_KEY  = DSL.field(DSL.name("NEWSLETTERS",      "blob_key"), String.class);
    private static final Field<String> A_BLOB_KEY  = DSL.field(DSL.name("FAMILY_ARTIFACTS", "blob_key"), String.class);
    private static final Field<String> P_PFP       = DSL.field(DSL.name("PEOPLE",           "profile_picture_url"), String.class);
    private static final Field<String> P_BANNER    = DSL.field(DSL.name("PEOPLE",           "banner_image_url"),    String.class);
    private static final Field<String> PR_IMAGE    = DSL.field(DSL.name("products",         "image_url"),           String.class);

    public OrphanBlobCleanupJob(BlobContainerClient container,
                                DSLContext dsl,
                                CdnProperties cdnProps,
                                SiteSettingsService settingsService,
                                ObjectMapper objectMapper) {
        this.container = container;
        this.dsl = dsl;
        this.cdnProps = cdnProps;
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
    }

    @Scheduled(cron = "0 0 4 * * *") // 4:00 AM daily
    public void cleanupOrphanBlobs() {
        try {
            Set<String> referencedKeys = collectAllReferencedBlobKeys();
            log.info("OrphanBlobCleanupJob: {} blob keys referenced in DB", referencedKeys.size());

            int deleted = 0;
            int scanned = 0;

            java.time.OffsetDateTime cutoff = java.time.OffsetDateTime.now().minusHours(24);

            for (BlobItem blob : container.listBlobs()) {
                scanned++;
                String blobName = blob.getName();

                // Skip if referenced in DB
                if (referencedKeys.contains(blobName)) continue;

                // Skip if created within the last 24 hours (grace period for in-progress uploads)
                if (blob.getProperties() != null
                        && blob.getProperties().getLastModified() != null
                        && blob.getProperties().getLastModified().isAfter(cutoff)) {
                    continue;
                }

                // Delete orphan
                try {
                    container.getBlobClient(blobName).deleteIfExists();
                    deleted++;
                } catch (Exception e) {
                    log.warn("OrphanBlobCleanupJob: failed to delete orphan blob {}: {}", blobName, e.getMessage());
                }
            }

            log.info("OrphanBlobCleanupJob: scanned {} blobs, deleted {} orphans", scanned, deleted);
        } catch (Exception e) {
            log.error("OrphanBlobCleanupJob: error during cleanup", e);
        }
    }

    /**
     * Collect all blob keys that are actively referenced in the database.
     */
    private Set<String> collectAllReferencedBlobKeys() {
        Set<String> keys = new HashSet<>();

        // 1. Direct blob_key columns
        collectColumn(keys, GALLERY_IMAGES, G_BLOB_KEY);
        collectColumn(keys, OBITUARY,       O_BLOB_KEY);
        collectColumn(keys, NEWSLETTERS,    N_BLOB_KEY);
        collectColumn(keys, FAMILY_ARTIFACTS, A_BLOB_KEY);

        // 2. CDN URL columns (need to extract blob key from URL)
        collectCdnUrlColumn(keys, PEOPLE, P_PFP);
        collectCdnUrlColumn(keys, PEOPLE, P_BANNER);
        collectCdnUrlColumn(keys, PRODUCTS, PR_IMAGE);

        // 3. Slideshow images from site_settings (JSON array with "url" fields)
        collectSlideshowKeys(keys);

        return keys;
    }

    private void collectColumn(Set<String> keys, Table<?> table, Field<String> field) {
        try {
            dsl.selectDistinct(field).from(table).where(field.isNotNull()).fetch(field)
                    .stream()
                    .filter(k -> k != null && !k.isBlank())
                    .forEach(keys::add);
        } catch (Exception e) {
            log.warn("OrphanBlobCleanupJob: failed to query {}.{}: {}", table, field.getName(), e.getMessage());
        }
    }

    private void collectCdnUrlColumn(Set<String> keys, Table<?> table, Field<String> field) {
        try {
            dsl.selectDistinct(field).from(table).where(field.isNotNull()).fetch(field)
                    .stream()
                    .filter(url -> url != null && !url.isBlank())
                    .map(this::extractBlobKey)
                    .filter(k -> k != null && !k.isBlank())
                    .forEach(keys::add);
        } catch (Exception e) {
            log.warn("OrphanBlobCleanupJob: failed to query {}.{}: {}", table, field.getName(), e.getMessage());
        }
    }

    private void collectSlideshowKeys(Set<String> keys) {
        try {
            String json = settingsService.get("slideshow_images");
            if (json == null || json.isBlank()) return;
            List<Map<String, Object>> slides = objectMapper.readValue(json, new TypeReference<>() {});
            for (Map<String, Object> slide : slides) {
                Object urlObj = slide.get("url");
                if (urlObj instanceof String url && !url.isBlank()) {
                    String key = extractBlobKey(url);
                    if (key != null && !key.isBlank()) keys.add(key);
                }
            }
        } catch (Exception e) {
            log.warn("OrphanBlobCleanupJob: failed to parse slideshow_images: {}", e.getMessage());
        }
    }

    /**
     * Extract blob key from a CDN URL.
     * e.g. "https://cdn.example.com/users/1/pfp/abc.jpg" → "users/1/pfp/abc.jpg"
     */
    private String extractBlobKey(String cdnUrl) {
        if (cdnUrl == null || cdnUrl.isBlank()) return null;
        String base = cdnProps.getBaseUrl();
        if (base != null && !base.isBlank()) {
            if (!base.endsWith("/")) base += "/";
            if (cdnUrl.startsWith(base)) {
                return cdnUrl.substring(base.length());
            }
        }
        try {
            java.net.URI uri = java.net.URI.create(cdnUrl);
            String path = uri.getPath();
            if (path != null && path.startsWith("/")) path = path.substring(1);
            return path;
        } catch (Exception e) {
            return null;
        }
    }
}
