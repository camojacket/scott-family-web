package com.scottfamily.scottfamily.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.azure.storage.blob.BlobContainerClient;

@Service
public class ObituaryService {

    // â”€â”€ Table & fields â”€â”€

    private static final Table<?> OBITUARY        = DSL.table(DSL.name("OBITUARY"));
    private static final Table<?> OBITUARY_PERSON = DSL.table(DSL.name("OBITUARY_PERSON"));
    private static final Table<?> PEOPLE          = DSL.table(DSL.name("PEOPLE"));

    private static final Field<Long>          O_ID          = DSL.field(DSL.name("OBITUARY", "id"),          Long.class);
    private static final Field<String>        O_TITLE       = DSL.field(DSL.name("OBITUARY", "title"),       String.class);
    private static final Field<String>        O_FILE_URL    = DSL.field(DSL.name("OBITUARY", "file_url"),    String.class);
    private static final Field<String>        O_BLOB_KEY    = DSL.field(DSL.name("OBITUARY", "blob_key"),    String.class);
    private static final Field<String>        O_FILE_TYPE   = DSL.field(DSL.name("OBITUARY", "file_type"),   String.class);
    private static final Field<Long>          O_UPLOADED_BY = DSL.field(DSL.name("OBITUARY", "uploaded_by"), Long.class);
    private static final Field<LocalDateTime> O_CREATED_AT  = DSL.field(DSL.name("OBITUARY", "created_at"), LocalDateTime.class);
    private static final Field<LocalDateTime> O_UPDATED_AT  = DSL.field(DSL.name("OBITUARY", "updated_at"), LocalDateTime.class);

    // Unqualified versions for insert/update
    private static final Field<Long>          ID          = DSL.field(DSL.name("id"),          Long.class);
    private static final Field<String>        TITLE       = DSL.field(DSL.name("title"),       String.class);
    private static final Field<String>        FILE_URL    = DSL.field(DSL.name("file_url"),    String.class);
    private static final Field<String>        BLOB_KEY    = DSL.field(DSL.name("blob_key"),    String.class);
    private static final Field<String>        FILE_TYPE   = DSL.field(DSL.name("file_type"),   String.class);
    private static final Field<Long>          UPLOADED_BY = DSL.field(DSL.name("uploaded_by"), Long.class);
    private static final Field<LocalDateTime> CREATED_AT  = DSL.field(DSL.name("created_at"), LocalDateTime.class);
    private static final Field<LocalDateTime> UPDATED_AT  = DSL.field(DSL.name("updated_at"), LocalDateTime.class);

    private static final Field<Long> OP_OBITUARY_ID = DSL.field(DSL.name("OBITUARY_PERSON", "obituary_id"), Long.class);
    private static final Field<Long> OP_PERSON_ID   = DSL.field(DSL.name("OBITUARY_PERSON", "person_id"),   Long.class);

    private static final Field<Long>   P_ID         = DSL.field(DSL.name("PEOPLE", "id"),         Long.class);
    private static final Field<String> P_FIRST_NAME = DSL.field(DSL.name("PEOPLE", "first_name"), String.class);
    private static final Field<String> P_LAST_NAME  = DSL.field(DSL.name("PEOPLE", "last_name"),  String.class);

    private final DSLContext dsl;
    private final BlobContainerClient blobContainer;

    public ObituaryService(DSLContext dsl, BlobContainerClient blobContainer) {
        this.dsl = dsl;
        this.blobContainer = blobContainer;
    }

    // â”€â”€ DTOs â”€â”€

    public record ObituaryDto(
            Long id,
            String title,
            String fileUrl,
            String fileType,
            List<TaggedPerson> taggedPeople,
            String createdAt,
            String updatedAt
    ) {}

    public record TaggedPerson(Long personId, String displayName) {}

    public record UpdateObituaryRequest(String title) {}

    // â”€â”€ Queries â”€â”€

    /** All obituaries with their tagged people, sorted by title */
    public List<ObituaryDto> getAll() {
        // Fetch all obituaries
        var rows = dsl.select(O_ID, O_TITLE, O_FILE_URL, O_FILE_TYPE, O_CREATED_AT, O_UPDATED_AT)
                .from(OBITUARY)
                .orderBy(O_TITLE.asc())
                .fetch();

        // Fetch all tags in one query
        var tags = dsl.select(OP_OBITUARY_ID, OP_PERSON_ID, P_FIRST_NAME, P_LAST_NAME)
                .from(OBITUARY_PERSON)
                .join(PEOPLE).on(OP_PERSON_ID.eq(P_ID))
                .fetch();

        // Group tags by obituary id
        var tagMap = tags.stream().collect(Collectors.groupingBy(
                r -> r.get(OP_OBITUARY_ID),
                Collectors.mapping(r -> new TaggedPerson(
                        r.get(OP_PERSON_ID),
                        (r.get(P_FIRST_NAME) + " " + r.get(P_LAST_NAME)).trim()
                ), Collectors.toList())
        ));

        return rows.stream().map(r -> new ObituaryDto(
                r.get(O_ID),
                r.get(O_TITLE),
                r.get(O_FILE_URL),
                r.get(O_FILE_TYPE),
                tagMap.getOrDefault(r.get(O_ID), List.of()),
                r.get(O_CREATED_AT) != null ? r.get(O_CREATED_AT).toString() : null,
                r.get(O_UPDATED_AT) != null ? r.get(O_UPDATED_AT).toString() : null
        )).toList();
    }

    /** Get obituaries tagged to a specific person */
    public List<ObituaryDto> getByPersonId(Long personId) {
        var obituaryIds = dsl.select(OP_OBITUARY_ID)
                .from(OBITUARY_PERSON)
                .where(OP_PERSON_ID.eq(personId))
                .fetchInto(Long.class);

        if (obituaryIds.isEmpty()) return List.of();

        var rows = dsl.select(O_ID, O_TITLE, O_FILE_URL, O_FILE_TYPE, O_CREATED_AT, O_UPDATED_AT)
                .from(OBITUARY)
                .where(O_ID.in(obituaryIds))
                .orderBy(O_TITLE.asc())
                .fetch();

        var tags = dsl.select(OP_OBITUARY_ID, OP_PERSON_ID, P_FIRST_NAME, P_LAST_NAME)
                .from(OBITUARY_PERSON)
                .join(PEOPLE).on(OP_PERSON_ID.eq(P_ID))
                .where(OP_OBITUARY_ID.in(obituaryIds))
                .fetch();

        var tagMap = tags.stream().collect(Collectors.groupingBy(
                r -> r.get(OP_OBITUARY_ID),
                Collectors.mapping(r -> new TaggedPerson(
                        r.get(OP_PERSON_ID),
                        (r.get(P_FIRST_NAME) + " " + r.get(P_LAST_NAME)).trim()
                ), Collectors.toList())
        ));

        return rows.stream().map(r -> new ObituaryDto(
                r.get(O_ID),
                r.get(O_TITLE),
                r.get(O_FILE_URL),
                r.get(O_FILE_TYPE),
                tagMap.getOrDefault(r.get(O_ID), List.of()),
                r.get(O_CREATED_AT) != null ? r.get(O_CREATED_AT).toString() : null,
                r.get(O_UPDATED_AT) != null ? r.get(O_UPDATED_AT).toString() : null
        )).toList();
    }

    /** Create obituary with file info and tagged people */
    @Transactional
    public ObituaryDto create(String title, String fileUrl, String blobKey, String fileType, Long uploadedBy, List<Long> personIds) {
        LocalDateTime now = LocalDateTime.now();

        Record r = dsl.insertInto(OBITUARY)
                .set(TITLE, title)
                .set(FILE_URL, fileUrl)
                .set(BLOB_KEY, blobKey)
                .set(FILE_TYPE, fileType)
                .set(UPLOADED_BY, uploadedBy)
                .set(CREATED_AT, now)
                .set(UPDATED_AT, now)
                .returningResult(ID, TITLE, FILE_URL, FILE_TYPE, CREATED_AT, UPDATED_AT)
                .fetchOne();

        Long obituaryId = r.get(ID);

        // Insert tags
        if (personIds != null && !personIds.isEmpty()) {
            var insert = dsl.insertInto(OBITUARY_PERSON,
                    DSL.field(DSL.name("obituary_id"), Long.class),
                    DSL.field(DSL.name("person_id"), Long.class));
            for (Long pid : personIds) {
                insert = insert.values(obituaryId, pid);
            }
            insert.execute();
        }

        // Re-fetch with tags
        return getById(obituaryId);
    }

    /** Get single obituary by ID */
    public ObituaryDto getById(Long obituaryId) {
        var row = dsl.select(O_ID, O_TITLE, O_FILE_URL, O_FILE_TYPE, O_CREATED_AT, O_UPDATED_AT)
                .from(OBITUARY)
                .where(O_ID.eq(obituaryId))
                .fetchOne();
        if (row == null) return null;

        var tags = dsl.select(OP_PERSON_ID, P_FIRST_NAME, P_LAST_NAME)
                .from(OBITUARY_PERSON)
                .join(PEOPLE).on(OP_PERSON_ID.eq(P_ID))
                .where(OP_OBITUARY_ID.eq(obituaryId))
                .fetch(r -> new TaggedPerson(
                        r.get(OP_PERSON_ID),
                        (r.get(P_FIRST_NAME) + " " + r.get(P_LAST_NAME)).trim()
                ));

        return new ObituaryDto(
                row.get(O_ID),
                row.get(O_TITLE),
                row.get(O_FILE_URL),
                row.get(O_FILE_TYPE),
                tags,
                row.get(O_CREATED_AT) != null ? row.get(O_CREATED_AT).toString() : null,
                row.get(O_UPDATED_AT) != null ? row.get(O_UPDATED_AT).toString() : null
        );
    }

    /** Update title */
    @Transactional
    public ObituaryDto update(Long id, UpdateObituaryRequest req) {
        dsl.update(OBITUARY)
                .set(TITLE, req.title())
                .set(UPDATED_AT, LocalDateTime.now())
                .where(O_ID.eq(id))
                .execute();
        return getById(id);
    }

    /** Replace the tagged people for an obituary */
    @Transactional
    public ObituaryDto updateTags(Long obituaryId, List<Long> personIds) {
        dsl.deleteFrom(OBITUARY_PERSON)
                .where(OP_OBITUARY_ID.eq(obituaryId))
                .execute();

        if (personIds != null && !personIds.isEmpty()) {
            var insert = dsl.insertInto(OBITUARY_PERSON,
                    DSL.field(DSL.name("obituary_id"), Long.class),
                    DSL.field(DSL.name("person_id"), Long.class));
            for (Long pid : personIds) {
                insert = insert.values(obituaryId, pid);
            }
            insert.execute();
        }

        dsl.update(OBITUARY)
                .set(UPDATED_AT, LocalDateTime.now())
                .where(O_ID.eq(obituaryId))
                .execute();

        return getById(obituaryId);
    }

    /** Re-upload file for existing obituary */
    @Transactional
    public ObituaryDto reupload(Long id, String newFileUrl, String newBlobKey, String newFileType) {
        String oldBlobKey = dsl.select(BLOB_KEY).from(OBITUARY)
                .where(O_ID.eq(id)).fetchOneInto(String.class);

        dsl.update(OBITUARY)
                .set(FILE_URL, newFileUrl)
                .set(BLOB_KEY, newBlobKey)
                .set(FILE_TYPE, newFileType)
                .set(UPDATED_AT, LocalDateTime.now())
                .where(O_ID.eq(id))
                .execute();

        if (oldBlobKey != null && !oldBlobKey.isBlank()) {
            try { blobContainer.getBlobClient(oldBlobKey).deleteIfExists(); } catch (Exception ignored) {}
        }

        return getById(id);
    }

    /** Delete obituary and its blob */
    @Transactional
    public void delete(Long id) {
        String blobKey = dsl.select(BLOB_KEY).from(OBITUARY)
                .where(O_ID.eq(id)).fetchOneInto(String.class);

        dsl.deleteFrom(OBITUARY_PERSON).where(OP_OBITUARY_ID.eq(id)).execute();
        dsl.deleteFrom(OBITUARY).where(O_ID.eq(id)).execute();

        if (blobKey != null && !blobKey.isBlank()) {
            try { blobContainer.getBlobClient(blobKey).deleteIfExists(); } catch (Exception ignored) {}
        }
    }
}
