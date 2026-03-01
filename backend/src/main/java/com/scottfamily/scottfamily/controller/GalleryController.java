package com.scottfamily.scottfamily.controller;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.scottfamily.scottfamily.service.GalleryService;
import com.scottfamily.scottfamily.service.GalleryService.GalleryImageDto;
import com.scottfamily.scottfamily.service.GalleryService.ImageTagDto;
import com.scottfamily.scottfamily.service.UserHelper;

/**
 * REST API for the family photo gallery.
 *
 * Public (authenticated):
 *   GET  /api/gallery/images              — list all gallery images
 *
 * Admin only:
 *   POST /api/gallery/images/register     — register metadata after direct-to-Azure upload
 *   POST /api/gallery/images/youtube      — register a YouTube video link
 *   PUT  /api/gallery/images/{id}         — update caption / date
 *   DELETE /api/gallery/images/{id}       — delete an image
 */
@RestController
@RequestMapping("/api/gallery")
public class GalleryController {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic");

    private final GalleryService galleryService;
    private final UserHelper userHelper;

    public GalleryController(GalleryService galleryService, UserHelper userHelper) {
        this.galleryService = galleryService;
        this.userHelper = userHelper;
    }

    // ── List all images (any authenticated user) ────────────────────────────────

    @GetMapping("/images")
    public ResponseEntity<List<GalleryImageDto>> listImages(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "200") int limit,
            @RequestParam(required = false) Long personId
    ) {
        if (personId != null) {
            return ResponseEntity.ok(galleryService.getByPersonId(personId));
        }
        return ResponseEntity.ok(galleryService.listAll(offset, Math.min(limit, 200)));
    }

    // ── Register images after direct-to-Azure upload (admin only) ───────────────

    /**
     * After the frontend uploads files directly to Azure Blob Storage using SAS
     * tokens, it calls this endpoint to persist metadata into the database.
     */
    @PostMapping("/images/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> registerImages(
            @RequestBody RegisterRequest request,
            Authentication auth
    ) {
        Long uploaderId = userHelper.resolveUserId(auth.getName());
        if (uploaderId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve uploader"));
        }

        List<GalleryImageDto> results = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (RegisterRequest.ImageMeta meta : request.images) {
            if (meta.contentType == null || !ALLOWED_IMAGE_TYPES.contains(meta.contentType.toLowerCase())) {
                errors.add(meta.fileName + ": unsupported content type: " + meta.contentType);
                continue;
            }
            try {
                LocalDate imageDate = (meta.imageDate != null && !meta.imageDate.isBlank())
                        ? LocalDate.parse(meta.imageDate) : null;

                GalleryImageDto dto = galleryService.registerUploaded(
                        meta.blobKey, meta.cdnUrl, meta.fileName,
                        meta.contentType, meta.sizeBytes,
                        meta.caption, imageDate, uploaderId
                );
                results.add(dto);
            } catch (Exception e) {
                errors.add(meta.fileName + ": " + e.getMessage());
            }
        }

        if (!errors.isEmpty() && results.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("errors", errors));
        }

        return ResponseEntity.ok(Map.of("uploaded", results, "errors", errors));
    }

    // ── Update image metadata (admin only) ──────────────────────────────────────
    // ── Register YouTube link (admin only) ────────────────────────────────────────

    @PostMapping("/images/youtube")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> registerYouTubeLink(
            @RequestBody YouTubeLinkRequest request,
            Authentication auth
    ) {
        Long uploaderId = userHelper.resolveUserId(auth.getName());
        if (uploaderId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve uploader"));
        }

        try {
            LocalDate imageDate = (request.imageDate != null && !request.imageDate.isBlank())
                    ? LocalDate.parse(request.imageDate) : null;

            GalleryImageDto dto = galleryService.registerYouTubeLink(
                    request.youtubeUrl, request.caption, imageDate, uploaderId
            );
            return ResponseEntity.ok(dto);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Bulk-register YouTube video links (admin only).
     */
    @PostMapping("/images/youtube/batch")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> registerYouTubeLinks(
            @RequestBody YouTubeBatchRequest request,
            Authentication auth
    ) {
        Long uploaderId = userHelper.resolveUserId(auth.getName());
        if (uploaderId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve uploader"));
        }
        if (request.videos == null || request.videos.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No videos provided"));
        }

        List<GalleryImageDto> results = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (YouTubeLinkRequest video : request.videos) {
            try {
                LocalDate imageDate = (video.imageDate != null && !video.imageDate.isBlank())
                        ? LocalDate.parse(video.imageDate) : null;

                GalleryImageDto dto = galleryService.registerYouTubeLink(
                        video.youtubeUrl, video.caption, imageDate, uploaderId
                );
                results.add(dto);
            } catch (Exception e) {
                errors.add(video.youtubeUrl + ": " + e.getMessage());
            }
        }

        if (!errors.isEmpty() && results.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("errors", errors));
        }

        return ResponseEntity.ok(Map.of("uploaded", results, "errors", errors));
    }
    @PutMapping("/images/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateImage(
            @PathVariable Long id,
            @RequestBody UpdateImageRequest body
    ) {
        try {
            LocalDate imageDate = body.imageDate != null && !body.imageDate.isBlank()
                    ? LocalDate.parse(body.imageDate)
                    : null;
            galleryService.update(id, body.caption, imageDate);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ── Delete image (admin only) ───────────────────────────────────────────────

    @DeleteMapping("/images/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteImage(@PathVariable Long id) {
        try {
            galleryService.delete(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ── Bulk-delete images (admin only) ─────────────────────────────────────────

    @PostMapping("/images/delete-batch")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteImages(@RequestBody DeleteBatchRequest request) {
        if (request.ids == null || request.ids.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No image IDs provided"));
        }
        int deleted = galleryService.deleteMultiple(request.ids);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }

    // ── Tags (people tagged in images) ──────────────────────────────────────────

    /**
     * Get tags for a single image.
     */
    @GetMapping("/images/{id}/tags")
    public ResponseEntity<List<ImageTagDto>> getImageTags(@PathVariable Long id) {
        return ResponseEntity.ok(galleryService.getTagsForImage(id));
    }

    /**
     * Replace all tags on an image (admin only).
     */
    @PutMapping("/images/{id}/tags")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ImageTagDto>> setImageTags(
            @PathVariable Long id,
            @RequestBody SetTagsRequest body
    ) {
        List<ImageTagDto> tags = galleryService.setTags(id, body.personIds);
        return ResponseEntity.ok(tags);
    }

    /**
     * Add a single person tag to an image (admin only).
     */
    @PostMapping("/images/{id}/tags")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ImageTagDto>> addImageTag(
            @PathVariable Long id,
            @RequestBody AddTagRequest body
    ) {
        List<ImageTagDto> tags = galleryService.addTag(id, body.personId);
        return ResponseEntity.ok(tags);
    }

    /**
     * Remove a single person tag from an image (admin only).
     */
    @DeleteMapping("/images/{id}/tags/{personId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ImageTagDto>> removeImageTag(
            @PathVariable Long id,
            @PathVariable Long personId
    ) {
        List<ImageTagDto> tags = galleryService.removeTag(id, personId);
        return ResponseEntity.ok(tags);
    }

    // ── Request body for PUT ────────────────────────────────────────────────────

    public static class UpdateImageRequest {
        public String caption;
        public String imageDate; // ISO yyyy-MM-dd or null
    }

    // ── Request body for POST /images/delete-batch ──────────────────────────────

    public static class DeleteBatchRequest {
        public List<Long> ids;
    }

    // ── Request bodies for tags ─────────────────────────────────────────────────

    public static class SetTagsRequest {
        public List<Long> personIds;
    }

    public static class AddTagRequest {
        public Long personId;
    }

    // ── Request body for POST /images/register ──────────────────────────────────

    public static class RegisterRequest {
        public List<ImageMeta> images;

        public static class ImageMeta {
            public String blobKey;
            public String cdnUrl;
            public String fileName;
            public String contentType;
            public long sizeBytes;
            public String caption;
            public String imageDate; // ISO yyyy-MM-dd or null
        }
    }
    // ── Request body for POST /images/youtube ───────────────────────────────────────

    public static class YouTubeLinkRequest {
        public String youtubeUrl;
        public String caption;
        public String imageDate; // ISO yyyy-MM-dd or null
    }

    // ── Request body for POST /images/youtube/batch ──────────────────────────────

    public static class YouTubeBatchRequest {
        public List<YouTubeLinkRequest> videos;
    }
}
