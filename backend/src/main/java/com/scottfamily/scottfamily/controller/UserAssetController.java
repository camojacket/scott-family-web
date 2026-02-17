package com.scottfamily.scottfamily.controller;

import com.azure.storage.blob.BlobContainerClient;
import com.scottfamily.scottfamily.properties.CdnProperties;
import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.CdnUploadService.AssetKind;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;

@RestController
@RequestMapping("/api")
@Validated
public class UserAssetController {

    private final CdnUploadService cdnUploadService;
    private final DSLContext dsl;
    private final BlobContainerClient blobContainer;
    private final CdnProperties cdnProps;

    // Inline field refs for PEOPLE columns
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL = DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<String> P_BANNER_IMAGE_URL   = DSL.field(DSL.name("banner_image_url"),   String.class);

    public UserAssetController(CdnUploadService cdnUploadService, DSLContext dsl,
                               BlobContainerClient blobContainer, CdnProperties cdnProps) {
        this.cdnUploadService = cdnUploadService;
        this.dsl = dsl;
        this.blobContainer = blobContainer;
        this.cdnProps = cdnProps;
    }

    // Anonymous upload for signup: returns CDN URL to include in SignupRequest
    @PostMapping(value = "/assets/anonymous/{kind}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> anonymousUpload(
            @PathVariable AssetKind kind,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, kind, file);
        return ResponseEntity.ok(Map.of(
                "key", result.getKey(),
                "cdnUrl", result.getCdnUrl(),
                "contentType", result.getContentType(),
                "bytes", result.getBytes()
        ));
    }

    /**
     * Authenticated upload for existing users.
     * After V12, persists image URL to the PEOPLE row (via user's person_id).
     */
    @PostMapping(value = "/users/{userId}/assets/{kind}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> userUpload(
            @PathVariable Long userId,
            @PathVariable AssetKind kind,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(userId, kind, file);

        // Resolve the user's person_id
        Long personId = dsl.select(USERS.PERSON_ID).from(USERS)
                .where(USERS.ID.eq(userId)).fetchOneInto(Long.class);

        if (personId != null) {
            switch (kind) {
                case PROFILE -> {
                    // Fetch old URL before overwriting, then delete old blob
                    String oldUrl = dsl.select(P_PROFILE_PICTURE_URL).from(PEOPLE)
                            .where(PEOPLE.ID.eq(personId)).fetchOneInto(String.class);
                    dsl.update(PEOPLE)
                        .set(P_PROFILE_PICTURE_URL, result.getCdnUrl())
                        .where(PEOPLE.ID.eq(personId))
                        .execute();
                    deleteOldBlob(oldUrl, result.getCdnUrl());
                }
                case BANNER -> {
                    String oldUrl = dsl.select(P_BANNER_IMAGE_URL).from(PEOPLE)
                            .where(PEOPLE.ID.eq(personId)).fetchOneInto(String.class);
                    dsl.update(PEOPLE)
                        .set(P_BANNER_IMAGE_URL, result.getCdnUrl())
                        .where(PEOPLE.ID.eq(personId))
                        .execute();
                    deleteOldBlob(oldUrl, result.getCdnUrl());
                }
                default -> { /* POST_IMAGE/STATIC not handled here */ }
            }
        }

        return ResponseEntity.ok(Map.of(
                "key", result.getKey(),
                "cdnUrl", result.getCdnUrl(),
                "contentType", result.getContentType(),
                "bytes", result.getBytes()
        ));
    }

    /** Delete old blob from Azure Storage when a new image replaces it. */
    private void deleteOldBlob(String oldUrl, String newUrl) {
        if (oldUrl == null || oldUrl.isBlank() || oldUrl.equals(newUrl)) return;
        try {
            String blobKey = extractBlobKey(oldUrl);
            if (blobKey != null && !blobKey.isBlank()) {
                blobContainer.getBlobClient(blobKey).deleteIfExists();
            }
        } catch (Exception ignored) { /* best-effort cleanup */ }
    }

    private String extractBlobKey(String cdnUrl) {
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
