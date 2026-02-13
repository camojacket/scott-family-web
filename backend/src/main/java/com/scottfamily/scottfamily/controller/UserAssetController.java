package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.CdnUploadService.AssetKind;
import com.yourproject.generated.scott_family_web.Tables;
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

    // Inline field refs for PEOPLE columns
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL = DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<String> P_BANNER_IMAGE_URL   = DSL.field(DSL.name("banner_image_url"),   String.class);

    public UserAssetController(CdnUploadService cdnUploadService, DSLContext dsl) {
        this.cdnUploadService = cdnUploadService;
        this.dsl = dsl;
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
                case PROFILE -> dsl.update(PEOPLE)
                        .set(P_PROFILE_PICTURE_URL, result.getCdnUrl())
                        .where(PEOPLE.ID.eq(personId))
                        .execute();
                case BANNER -> dsl.update(PEOPLE)
                        .set(P_BANNER_IMAGE_URL, result.getCdnUrl())
                        .where(PEOPLE.ID.eq(personId))
                        .execute();
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
}
