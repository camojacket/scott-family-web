package com.scottfamily.scottfamily.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.azure.storage.blob.BlobContainerClient;

@Service
public class NewsletterService {

    // ── Table & fields ──

    private static final Table<?> NEWSLETTERS = DSL.table(DSL.name("newsletters"));
    private static final Field<Long>          F_ID         = DSL.field(DSL.name("id"),         Long.class);
    private static final Field<String>        F_NAME       = DSL.field(DSL.name("name"),       String.class);
    private static final Field<String>        F_PDF_URL    = DSL.field(DSL.name("pdf_url"),    String.class);
    private static final Field<String>        F_BLOB_KEY   = DSL.field(DSL.name("blob_key"),   String.class);
    private static final Field<LocalDate>     F_ISSUE_DATE = DSL.field(DSL.name("issue_date"), LocalDate.class);
    private static final Field<LocalDateTime> F_CREATED_AT = DSL.field(DSL.name("created_at"), LocalDateTime.class);
    private static final Field<LocalDateTime> F_UPDATED_AT = DSL.field(DSL.name("updated_at"), LocalDateTime.class);

    private final DSLContext dsl;
    private final CdnUploadService cdnUploadService;
    private final BlobContainerClient blobContainer;

    public NewsletterService(DSLContext dsl, CdnUploadService cdnUploadService, BlobContainerClient blobContainer) {
        this.dsl = dsl;
        this.cdnUploadService = cdnUploadService;
        this.blobContainer = blobContainer;
    }

    // ── DTOs ──

    public record NewsletterDto(
            Long id,
            String name,
            String pdfUrl,
            String issueDate,
            String createdAt,
            String updatedAt
    ) {}

    public record CreateNewsletterRequest(String name, String issueDate) {}

    public record UpdateNewsletterRequest(String name, String issueDate) {}

    // ── Queries ──

    /** All newsletters, sorted by issue_date DESC then name ASC */
    public List<NewsletterDto> getAll() {
        return dsl.select(F_ID, F_NAME, F_PDF_URL, F_ISSUE_DATE, F_CREATED_AT, F_UPDATED_AT)
                .from(NEWSLETTERS)
                .orderBy(F_ISSUE_DATE.desc(), F_NAME.asc())
                .fetch(this::toDto);
    }

    /** Create a newsletter record after PDF is uploaded */
    @Transactional
    public NewsletterDto create(String name, String issueDate, String pdfUrl, String blobKey) {
        LocalDateTime now = LocalDateTime.now();
        Record r = dsl.insertInto(NEWSLETTERS)
                .set(F_NAME, name)
                .set(F_PDF_URL, pdfUrl)
                .set(F_BLOB_KEY, blobKey)
                .set(F_ISSUE_DATE, LocalDate.parse(issueDate))
                .set(F_CREATED_AT, now)
                .set(F_UPDATED_AT, now)
                .returningResult(F_ID, F_NAME, F_PDF_URL, F_ISSUE_DATE, F_CREATED_AT, F_UPDATED_AT)
                .fetchOne();
        return toDto(r);
    }

    /** Update name / date metadata */
    @Transactional
    public NewsletterDto update(Long id, UpdateNewsletterRequest req) {
        var stmt = dsl.update(NEWSLETTERS).set(F_UPDATED_AT, LocalDateTime.now());
        if (req.name() != null)      stmt = stmt.set(F_NAME, req.name());
        if (req.issueDate() != null) stmt = stmt.set(F_ISSUE_DATE, LocalDate.parse(req.issueDate()));
        stmt.where(F_ID.eq(id)).execute();

        return dsl.select(F_ID, F_NAME, F_PDF_URL, F_ISSUE_DATE, F_CREATED_AT, F_UPDATED_AT)
                .from(NEWSLETTERS)
                .where(F_ID.eq(id))
                .fetchOne(this::toDto);
    }

    /** Re-upload: update the PDF URL and blob key, delete old blob */
    @Transactional
    public NewsletterDto reupload(Long id, String newPdfUrl, String newBlobKey) {
        // fetch old blob key to delete from storage
        String oldBlobKey = dsl.select(F_BLOB_KEY).from(NEWSLETTERS)
                .where(F_ID.eq(id)).fetchOneInto(String.class);

        dsl.update(NEWSLETTERS)
                .set(F_PDF_URL, newPdfUrl)
                .set(F_BLOB_KEY, newBlobKey)
                .set(F_UPDATED_AT, LocalDateTime.now())
                .where(F_ID.eq(id))
                .execute();

        // delete old blob asynchronously (best effort)
        if (oldBlobKey != null && !oldBlobKey.isBlank()) {
            try { blobContainer.getBlobClient(oldBlobKey).deleteIfExists(); } catch (Exception ignored) {}
        }

        return dsl.select(F_ID, F_NAME, F_PDF_URL, F_ISSUE_DATE, F_CREATED_AT, F_UPDATED_AT)
                .from(NEWSLETTERS)
                .where(F_ID.eq(id))
                .fetchOne(this::toDto);
    }

    /** Delete newsletter and its blob */
    @Transactional
    public void delete(Long id) {
        String blobKey = dsl.select(F_BLOB_KEY).from(NEWSLETTERS)
                .where(F_ID.eq(id)).fetchOneInto(String.class);

        dsl.deleteFrom(NEWSLETTERS).where(F_ID.eq(id)).execute();

        if (blobKey != null && !blobKey.isBlank()) {
            try { blobContainer.getBlobClient(blobKey).deleteIfExists(); } catch (Exception ignored) {}
        }
    }

    // ── Mapper ──

    private NewsletterDto toDto(Record r) {
        return new NewsletterDto(
                r.get(F_ID),
                r.get(F_NAME),
                r.get(F_PDF_URL),
                r.get(F_ISSUE_DATE) != null ? r.get(F_ISSUE_DATE).toString() : null,
                r.get(F_CREATED_AT) != null ? r.get(F_CREATED_AT).toString() : null,
                r.get(F_UPDATED_AT) != null ? r.get(F_UPDATED_AT).toString() : null
        );
    }
}
