package com.scottfamily.scottfamily.service;

import com.azure.storage.blob.BlobContainerClient;
import lombok.*;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Service for managing gallery images stored in Azure Blob Storage.
 * Metadata is persisted in the GALLERY_IMAGES SQL table.
 * Images are uploaded to a dedicated "gallery/" prefix in the blob container.
 */
@Service
public class GalleryService {

    // ── jOOQ inline table/field definitions (avoids needing code-gen for this new table) ──

    private static final Table<?> GALLERY_IMAGES = DSL.table("GALLERY_IMAGES");

    private static final Field<Long>             F_ID           = DSL.field("ID",           SQLDataType.BIGINT.identity(true));
    private static final Field<String>           F_BLOB_KEY     = DSL.field("BLOB_KEY",     SQLDataType.NVARCHAR(500));
    private static final Field<String>           F_CDN_URL      = DSL.field("CDN_URL",      SQLDataType.NVARCHAR(1000));
    private static final Field<String>           F_FILE_NAME    = DSL.field("FILE_NAME",    SQLDataType.NVARCHAR(500));
    private static final Field<String>           F_CONTENT_TYPE = DSL.field("CONTENT_TYPE", SQLDataType.NVARCHAR(100));
    private static final Field<Long>             F_SIZE_BYTES   = DSL.field("SIZE_BYTES",   SQLDataType.BIGINT);
    private static final Field<String>           F_CAPTION      = DSL.field("CAPTION",      SQLDataType.NVARCHAR(1000));
    private static final Field<LocalDate>        F_IMAGE_DATE   = DSL.field("IMAGE_DATE",   SQLDataType.LOCALDATE);
    private static final Field<Long>             F_UPLOADED_BY  = DSL.field("UPLOADED_BY",  SQLDataType.BIGINT);
    private static final Field<OffsetDateTime>   F_UPLOADED_AT  = DSL.field("UPLOADED_AT",  SQLDataType.OFFSETDATETIME);

    private final DSLContext dsl;
    private final BlobContainerClient container;

    public GalleryService(DSLContext dsl, BlobContainerClient container) {
        this.dsl = dsl;
        this.container = container;
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Register metadata for an image that was uploaded directly to Azure Blob
     * Storage by the frontend using a SAS token. No file data touches the server.
     */
    @Transactional
    public GalleryImageDto registerUploaded(
            String blobKey, String cdnUrl, String fileName,
            String contentType, long sizeBytes,
            String caption, LocalDate imageDate, Long uploadedBy
    ) {
        Record inserted = dsl.insertInto(GALLERY_IMAGES)
                .set(F_BLOB_KEY, blobKey)
                .set(F_CDN_URL, cdnUrl)
                .set(F_FILE_NAME, fileName)
                .set(F_CONTENT_TYPE, contentType)
                .set(F_SIZE_BYTES, sizeBytes)
                .set(F_CAPTION, caption)
                .set(F_IMAGE_DATE, imageDate)
                .set(F_UPLOADED_BY, uploadedBy)
                .returningResult(F_ID, F_UPLOADED_AT)
                .fetchOne();

        Long id = inserted != null ? inserted.get(F_ID) : null;
        OffsetDateTime uploadedAt = inserted != null ? inserted.get(F_UPLOADED_AT) : OffsetDateTime.now();

        return GalleryImageDto.builder()
                .id(id)
                .blobKey(blobKey)
                .cdnUrl(cdnUrl)
                .fileName(fileName)
                .contentType(contentType)
                .sizeBytes(sizeBytes)
                .caption(caption)
                .imageDate(imageDate)
                .uploadedBy(uploadedBy)
                .uploadedAt(uploadedAt)
                .build();
    }

    /**
     * List gallery images, ordered by imageDate desc (nulls last), then uploadedAt desc.
     * Includes tags for each image. Supports pagination via offset/limit.
     */
    public List<GalleryImageDto> listAll(int offset, int limit) {
        Map<Long, List<ImageTagDto>> allTags = getAllTags();

        return dsl.selectFrom(GALLERY_IMAGES)
                .orderBy(
                        DSL.field("IMAGE_DATE").desc().nullsLast(),
                        DSL.field("UPLOADED_AT").desc()
                )
                .offset(offset)
                .limit(limit)
                .fetch()
                .map(r -> {
                    Long id = r.get(F_ID);
                    return GalleryImageDto.builder()
                        .id(id)
                        .blobKey(r.get(F_BLOB_KEY))
                        .cdnUrl(r.get(F_CDN_URL))
                        .fileName(r.get(F_FILE_NAME))
                        .contentType(r.get(F_CONTENT_TYPE))
                        .sizeBytes(r.get(F_SIZE_BYTES))
                        .caption(r.get(F_CAPTION))
                        .imageDate(toLocalDate(r.get("IMAGE_DATE")))
                        .uploadedBy(r.get(F_UPLOADED_BY))
                        .uploadedAt(r.get(F_UPLOADED_AT))
                        .tags(allTags.getOrDefault(id, new ArrayList<>()))
                        .build();
                });
    }

    /** Backwards-compatible overload — returns all images. */
    public List<GalleryImageDto> listAll() {
        return listAll(0, 200);
    }

    /**
     * Return gallery images tagged with a specific person, ordered by imageDate desc.
     */
    public List<GalleryImageDto> getByPersonId(Long personId) {
        // Find image IDs tagged with this person
        List<Long> imageIds = dsl.select(TAG_IMAGE_ID)
                .from(GALLERY_IMAGE_TAGS)
                .where(TAG_PERSON_ID.eq(personId))
                .fetchInto(Long.class);

        if (imageIds.isEmpty()) return List.of();

        Map<Long, List<ImageTagDto>> tagMap = getAllTags();

        return dsl.selectFrom(GALLERY_IMAGES)
                .where(F_ID.in(imageIds))
                .orderBy(
                        DSL.field("IMAGE_DATE").desc().nullsLast(),
                        DSL.field("UPLOADED_AT").desc()
                )
                .fetch()
                .map(r -> {
                    Long id = r.get(F_ID);
                    return GalleryImageDto.builder()
                        .id(id)
                        .blobKey(r.get(F_BLOB_KEY))
                        .cdnUrl(r.get(F_CDN_URL))
                        .fileName(r.get(F_FILE_NAME))
                        .contentType(r.get(F_CONTENT_TYPE))
                        .sizeBytes(r.get(F_SIZE_BYTES))
                        .caption(r.get(F_CAPTION))
                        .imageDate(toLocalDate(r.get("IMAGE_DATE")))
                        .uploadedBy(r.get(F_UPLOADED_BY))
                        .uploadedAt(r.get(F_UPLOADED_AT))
                        .tags(tagMap.getOrDefault(id, new ArrayList<>()))
                        .build();
                });
    }

    /**
     * Update caption and/or date for an existing gallery image.
     */
    @Transactional
    public void update(Long imageId, String caption, LocalDate imageDate) {
        int rows = dsl.update(GALLERY_IMAGES)
                .set(F_CAPTION, caption)
                .set(F_IMAGE_DATE, imageDate)
                .where(F_ID.eq(imageId))
                .execute();
        if (rows == 0) {
            throw new NoSuchElementException("Gallery image not found: " + imageId);
        }
    }

    /**
     * Delete a gallery image — removes from both blob storage and the database.
     */
    @Transactional
    public void delete(Long imageId) {
        Record row = dsl.select(F_BLOB_KEY)
                .from(GALLERY_IMAGES)
                .where(F_ID.eq(imageId))
                .fetchOne();
        if (row == null) {
            throw new NoSuchElementException("Gallery image not found: " + imageId);
        }

        String blobKey = row.get(F_BLOB_KEY);

        // Delete from blob storage
        try {
            container.getBlobClient(blobKey).deleteIfExists();
        } catch (Exception e) {
            // Log but don't fail — still remove from DB
            System.err.println("Warning: failed to delete blob " + blobKey + ": " + e.getMessage());
        }

        dsl.deleteFrom(GALLERY_IMAGES)
                .where(F_ID.eq(imageId))
                .execute();
    }

    /**
     * Bulk-delete gallery images — removes from both blob storage and the database.
     * Returns the number of images successfully deleted.
     */
    @Transactional
    public int deleteMultiple(List<Long> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) return 0;

        // Fetch blob keys for all requested images
        var rows = dsl.select(F_ID, F_BLOB_KEY)
                .from(GALLERY_IMAGES)
                .where(F_ID.in(imageIds))
                .fetch();

        // Delete blobs (best-effort)
        for (var row : rows) {
            String blobKey = row.get(F_BLOB_KEY);
            try {
                container.getBlobClient(blobKey).deleteIfExists();
            } catch (Exception e) {
                System.err.println("Warning: failed to delete blob " + blobKey + ": " + e.getMessage());
            }
        }

        // Delete from DB
        return dsl.deleteFrom(GALLERY_IMAGES)
                .where(F_ID.in(imageIds))
                .execute();
    }

    // ── DTO ─────────────────────────────────────────────────────────────────────

    /** Safely convert JDBC DATE (java.sql.Date or LocalDate) to LocalDate. */
    private static LocalDate toLocalDate(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDate ld) return ld;
        if (val instanceof java.sql.Date sd) return sd.toLocalDate();
        return val.toString().isBlank() ? null : LocalDate.parse(val.toString());
    }

    // ── Tag operations ──────────────────────────────────────────────────────────

    private static final Table<?> GALLERY_IMAGE_TAGS = DSL.table("GALLERY_IMAGE_TAGS");
    private static final Field<Long> TAG_IMAGE_ID  = DSL.field("IMAGE_ID",  SQLDataType.BIGINT);
    private static final Field<Long> TAG_PERSON_ID = DSL.field("PERSON_ID", SQLDataType.BIGINT);

    private static final Table<?> PEOPLE_TABLE      = DSL.table("PEOPLE");
    private static final Field<Long>   P_ID         = DSL.field("ID",         SQLDataType.BIGINT);
    private static final Field<String> P_FIRST_NAME = DSL.field("FIRST_NAME", SQLDataType.NVARCHAR(100));
    private static final Field<String> P_LAST_NAME  = DSL.field("LAST_NAME",  SQLDataType.NVARCHAR(100));
    private static final Field<String> P_PREFIX     = DSL.field("PREFIX",     SQLDataType.NVARCHAR(20));
    private static final Field<String> P_MIDDLE     = DSL.field("MIDDLE_NAME",SQLDataType.NVARCHAR(100));
    private static final Field<String> P_SUFFIX_F   = DSL.field("SUFFIX",     SQLDataType.NVARCHAR(20));
    private static final Field<LocalDate> P_DOB     = DSL.field("DATE_OF_BIRTH", SQLDataType.LOCALDATE);
    private static final Field<LocalDate> P_DOD     = DSL.field("DATE_OF_DEATH", SQLDataType.LOCALDATE);

    /**
     * Return tags for a single image.
     */
    public List<ImageTagDto> getTagsForImage(Long imageId) {
        return dsl.select(TAG_PERSON_ID, P_FIRST_NAME, P_LAST_NAME,
                        P_PREFIX, P_MIDDLE, P_SUFFIX_F, P_DOB, P_DOD)
                .from(GALLERY_IMAGE_TAGS)
                .join(PEOPLE_TABLE).on(P_ID.eq(TAG_PERSON_ID))
                .where(TAG_IMAGE_ID.eq(imageId))
                .orderBy(P_FIRST_NAME.asc(), P_LAST_NAME.asc())
                .fetch(r -> ImageTagDto.builder()
                        .personId(r.get(TAG_PERSON_ID))
                        .displayName(PeopleService.fullDisplayName(
                            r.get(P_PREFIX), r.get(P_FIRST_NAME), r.get(P_MIDDLE),
                            r.get(P_LAST_NAME), r.get(P_SUFFIX_F),
                            r.get(P_DOB), r.get(P_DOD)))
                        .build()
                );
    }

    /**
     * Return tags for all images, keyed by imageId.
     */
    public Map<Long, List<ImageTagDto>> getAllTags() {
        var rows = dsl.select(TAG_IMAGE_ID, TAG_PERSON_ID, P_FIRST_NAME, P_LAST_NAME,
                        P_PREFIX, P_MIDDLE, P_SUFFIX_F, P_DOB, P_DOD)
                .from(GALLERY_IMAGE_TAGS)
                .join(PEOPLE_TABLE).on(P_ID.eq(TAG_PERSON_ID))
                .orderBy(P_FIRST_NAME.asc(), P_LAST_NAME.asc())
                .fetch();

        Map<Long, List<ImageTagDto>> map = new HashMap<>();
        for (var r : rows) {
            Long imgId = r.get(TAG_IMAGE_ID);
            map.computeIfAbsent(imgId, k -> new ArrayList<>())
                .add(ImageTagDto.builder()
                    .personId(r.get(TAG_PERSON_ID))
                    .displayName(PeopleService.fullDisplayName(
                        r.get(P_PREFIX), r.get(P_FIRST_NAME), r.get(P_MIDDLE),
                        r.get(P_LAST_NAME), r.get(P_SUFFIX_F),
                        r.get(P_DOB), r.get(P_DOD)))
                    .build()
                );
        }
        return map;
    }

    /**
     * Replace all tags for an image with the given person IDs.
     */
    @Transactional
    public List<ImageTagDto> setTags(Long imageId, List<Long> personIds) {
        // Delete existing tags
        dsl.deleteFrom(GALLERY_IMAGE_TAGS)
                .where(TAG_IMAGE_ID.eq(imageId))
                .execute();

        // Insert new tags
        if (personIds != null) {
            for (Long pid : personIds) {
                dsl.insertInto(GALLERY_IMAGE_TAGS)
                        .set(TAG_IMAGE_ID, imageId)
                        .set(TAG_PERSON_ID, pid)
                        .execute();
            }
        }

        return getTagsForImage(imageId);
    }

    /**
     * Add a single tag to an image. Returns updated tag list.
     */
    @Transactional
    public List<ImageTagDto> addTag(Long imageId, Long personId) {
        // Upsert — ignore if already exists
        var exists = dsl.fetchExists(
            dsl.selectFrom(GALLERY_IMAGE_TAGS)
               .where(TAG_IMAGE_ID.eq(imageId).and(TAG_PERSON_ID.eq(personId)))
        );
        if (!exists) {
            dsl.insertInto(GALLERY_IMAGE_TAGS)
                    .set(TAG_IMAGE_ID, imageId)
                    .set(TAG_PERSON_ID, personId)
                    .execute();
        }
        return getTagsForImage(imageId);
    }

    /**
     * Remove a single tag from an image. Returns updated tag list.
     */
    @Transactional
    public List<ImageTagDto> removeTag(Long imageId, Long personId) {
        dsl.deleteFrom(GALLERY_IMAGE_TAGS)
                .where(TAG_IMAGE_ID.eq(imageId).and(TAG_PERSON_ID.eq(personId)))
                .execute();
        return getTagsForImage(imageId);
    }

    // ── DTOs ────────────────────────────────────────────────────────────────────

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ImageTagDto {
        private Long personId;
        private String displayName;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GalleryImageDto {
        private Long id;
        private String blobKey;
        private String cdnUrl;
        private String fileName;
        private String contentType;
        private Long sizeBytes;
        private String caption;
        private LocalDate imageDate;
        private Long uploadedBy;
        private OffsetDateTime uploadedAt;
        @Builder.Default
        private List<ImageTagDto> tags = new ArrayList<>();
    }
}
