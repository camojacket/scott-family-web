package com.scottfamily.scottfamily.controller;

import java.io.IOException;
import java.util.Map;

import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.PageContentService;

/**
 * REST API for modular page content.
 *
 *   GET    /api/page-content/{pageKey}          — get blocks (public)
 *   PUT    /api/page-content/{pageKey}          — save blocks (admin only)
 *   POST   /api/page-content/upload-image       — upload an image (admin only)
 */
@RestController
@RequestMapping("/api/page-content")
public class PageContentController {

    private final PageContentService pageContentService;
    private final CdnUploadService cdnUploadService;
    private final DSLContext dsl;

    public PageContentController(PageContentService pageContentService,
                                  CdnUploadService cdnUploadService,
                                  DSLContext dsl) {
        this.pageContentService = pageContentService;
        this.cdnUploadService = cdnUploadService;
        this.dsl = dsl;
    }

    /** Public — any visitor can read page content. */
    @GetMapping("/{pageKey}")
    public ResponseEntity<Map<String, Object>> getBlocks(@PathVariable String pageKey) {
        String blocks = pageContentService.getBlocks(pageKey);
        if (blocks == null) {
            return ResponseEntity.ok(Map.of("pageKey", pageKey, "blocks", "[]"));
        }
        // Return raw JSON string — the blocks field is already JSON
        return ResponseEntity.ok(Map.of("pageKey", pageKey, "blocks", blocks));
    }

    /** Admin-only — save page content blocks. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{pageKey}")
    public ResponseEntity<Map<String, Object>> saveBlocks(
            @PathVariable String pageKey,
            @RequestBody SaveBlocksRequest request,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        pageContentService.saveBlocks(pageKey, request.blocks, userId);
        return ResponseEntity.ok(Map.of("pageKey", pageKey, "saved", true));
    }

    /** Admin-only — upload an image for use in page content blocks. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadImage(
            @RequestPart("file") MultipartFile file) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, CdnUploadService.AssetKind.STATIC, file);
        return ResponseEntity.ok(Map.of(
                "cdnUrl", result.getCdnUrl(),
                "key", result.getKey()
        ));
    }

    // ── Request DTOs ──

    public static class SaveBlocksRequest {
        public String blocks; // JSON string of content blocks array
    }

    // ── Helper ──

    private Long resolveUserId(String username) {
        return dsl.select(DSL.field(DSL.name("users", "id"), SQLDataType.BIGINT))
                .from(DSL.table(DSL.name("users")))
                .where(DSL.field(DSL.name("users", "username"), SQLDataType.NVARCHAR(255)).eq(username))
                .fetchOne(DSL.field(DSL.name("users", "id"), SQLDataType.BIGINT));
    }
}
