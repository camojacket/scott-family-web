package com.scottfamily.scottfamily.controller;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.sas.BlobContainerSasPermission;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scottfamily.scottfamily.properties.CdnProperties;
import com.scottfamily.scottfamily.service.SiteSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Manages the homepage slideshow media.
 * Media entries are stored as a JSON array in site_settings under key "slideshow_images".
 * Each entry: { "url": "...", "caption": "...", "order": 0, "type": "image"|"video" }
 * Max 5 items, min 1.
 *
 * Upload flow (SAS-based, same pattern as gallery):
 *   1. Admin calls POST /api/slideshow/sas with fileName + contentType
 *   2. Backend returns { blobKey, sasUrl, cdnUrl }
 *   3. Frontend uploads directly to Azure Blob Storage via @azure/storage-blob
 *   4. Frontend calls POST /api/slideshow/register with { url, caption, type }
 */
@RestController
@RequestMapping("/api/slideshow")
public class SlideshowController {

    private static final String SETTING_KEY = "slideshow_images";
    private static final int MAX_IMAGES = 5;
    private static final int MIN_IMAGES = 1;

    private final SiteSettingsService settingsService;
    private final BlobContainerClient container;
    private final CdnProperties cdnProps;
    private final ObjectMapper objectMapper;

    public SlideshowController(SiteSettingsService settingsService,
                               BlobContainerClient container,
                               CdnProperties cdnProps,
                               ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.container = container;
        this.cdnProps = cdnProps;
        this.objectMapper = objectMapper;
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    public static class SasRequest {
        public String fileName;
        public String contentType;
    }

    public static class SasResponse {
        public String blobKey;
        public String sasUrl;
        public String cdnUrl;

        public SasResponse(String blobKey, String sasUrl, String cdnUrl) {
            this.blobKey = blobKey;
            this.sasUrl = sasUrl;
            this.cdnUrl = cdnUrl;
        }
    }

    public static class RegisterRequest {
        public String url;
        public String caption;
        public String type; // "image" | "video"
        public Integer duration; // seconds per slide (default 6)
    }

    // ── Endpoints ─────────────────────────────────────────────────────────────

    /** Public — get current slideshow media. */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getSlideshow() {
        List<Map<String, Object>> images = loadImages();

        // Fallback: if no slideshow configured, return the legacy home_image_url
        if (images.isEmpty()) {
            String legacyUrl = settingsService.get("home_image_url");
            String legacyCaption = settingsService.get("home_image_caption");
            if (legacyUrl != null && !legacyUrl.isBlank()) {
                Map<String, Object> legacy = new LinkedHashMap<>();
                legacy.put("url", legacyUrl);
                legacy.put("caption", legacyCaption != null ? legacyCaption : "");
                legacy.put("order", 0);
                images.add(legacy);
            }
        }

        return ResponseEntity.ok(images);
    }

    /** Admin-only — generate a SAS upload URL for a single file. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/sas")
    public ResponseEntity<?> generateSasUrl(@RequestBody SasRequest request) {
        List<Map<String, Object>> images = loadImages();
        if (images.size() >= MAX_IMAGES) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Maximum " + MAX_IMAGES + " slideshow items allowed."));
        }

        String ext = pickExtension(request.contentType);
        String blobKey = "slideshow/" + UUID.randomUUID() + "." + ext;

        BlobContainerSasPermission permissions = new BlobContainerSasPermission()
                .setWritePermission(true)
                .setCreatePermission(true);

        BlobServiceSasSignatureValues sasValues = new BlobServiceSasSignatureValues(
                OffsetDateTime.now().plusMinutes(30),
                permissions
        );

        String sasToken = container.getBlobClient(blobKey).generateSas(sasValues);
        String sasUrl = container.getBlobClient(blobKey).getBlobUrl() + "?" + sasToken;
        String cdnUrl = buildCdnUrl(blobKey);

        return ResponseEntity.ok(new SasResponse(blobKey, sasUrl, cdnUrl));
    }

    /** Admin-only — register a media item after direct-to-Azure upload. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/register")
    public ResponseEntity<?> registerMedia(@RequestBody RegisterRequest request) {
        List<Map<String, Object>> images = loadImages();

        if (images.size() >= MAX_IMAGES) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Maximum " + MAX_IMAGES + " slideshow items allowed."));
        }
        if (request.url == null || request.url.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "url is required"));
        }

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("url", request.url);
        entry.put("caption", request.caption != null ? request.caption : "");
        entry.put("order", images.size());
        entry.put("type", request.type != null ? request.type : "image");
        entry.put("duration", request.duration != null && request.duration >= 1 ? request.duration : 6);
        entry.put("focalX", 50.0);
        entry.put("focalY", 50.0);
        images.add(entry);

        saveImages(images);

        return ResponseEntity.ok(images);
    }

    /** Admin-only — remove an item by index. */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{index}")
    public ResponseEntity<?> removeImage(@PathVariable int index) {
        List<Map<String, Object>> images = loadImages();

        if (index < 0 || index >= images.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid image index."));
        }
        if (images.size() <= MIN_IMAGES) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "At least " + MIN_IMAGES + " slideshow image is required."));
        }

        // Delete the blob from Azure Storage (best-effort)
        Map<String, Object> removed = images.get(index);
        String url = removed.get("url") != null ? removed.get("url").toString() : null;
        if (url != null) {
            String blobKey = extractBlobKey(url);
            if (blobKey != null) {
                try { container.getBlobClient(blobKey).deleteIfExists(); } catch (Exception ignored) {}
            }
        }

        images.remove(index);
        for (int i = 0; i < images.size(); i++) {
            images.get(i).put("order", i);
        }
        saveImages(images);

        return ResponseEntity.ok(images);
    }

    /** Admin-only — reorder items. Body: array of indices in new order. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/reorder")
    public ResponseEntity<?> reorder(@RequestBody List<Integer> newOrder) {
        List<Map<String, Object>> images = loadImages();

        if (newOrder.size() != images.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Order array must match image count."));
        }

        List<Map<String, Object>> reordered = new ArrayList<>();
        for (int idx : newOrder) {
            if (idx < 0 || idx >= images.size()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid index: " + idx));
            }
            reordered.add(images.get(idx));
        }
        for (int i = 0; i < reordered.size(); i++) {
            reordered.get(i).put("order", i);
        }
        saveImages(reordered);

        return ResponseEntity.ok(reordered);
    }

    /** Admin-only — update duration (seconds) for an item by index. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{index}/duration")
    public ResponseEntity<?> updateDuration(@PathVariable int index, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> images = loadImages();

        if (index < 0 || index >= images.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid index."));
        }

        Object raw = body.get("duration");
        int dur = 6;
        if (raw instanceof Number n) dur = Math.max(1, n.intValue());
        images.get(index).put("duration", dur);
        saveImages(images);

        return ResponseEntity.ok(images);
    }

    /** Admin-only — update focal point for an item by index. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{index}/focal-point")
    public ResponseEntity<?> updateFocalPoint(@PathVariable int index, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> images = loadImages();

        if (index < 0 || index >= images.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid index."));
        }

        Object rawX = body.get("focalX");
        Object rawY = body.get("focalY");
        double fx = 50, fy = 50;
        if (rawX instanceof Number n) fx = Math.max(0, Math.min(100, n.doubleValue()));
        if (rawY instanceof Number n) fy = Math.max(0, Math.min(100, n.doubleValue()));
        images.get(index).put("focalX", Math.round(fx * 10.0) / 10.0);
        images.get(index).put("focalY", Math.round(fy * 10.0) / 10.0);
        saveImages(images);

        return ResponseEntity.ok(images);
    }

    /** Admin-only — update caption for an item by index. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{index}/caption")
    public ResponseEntity<?> updateCaption(@PathVariable int index, @RequestBody Map<String, String> body) {
        List<Map<String, Object>> images = loadImages();

        if (index < 0 || index >= images.size()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid image index."));
        }

        images.get(index).put("caption", body.getOrDefault("caption", ""));
        saveImages(images);

        return ResponseEntity.ok(images);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private List<Map<String, Object>> loadImages() {
        String json = settingsService.get(SETTING_KEY);
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private void saveImages(List<Map<String, Object>> images) {
        try {
            settingsService.put(SETTING_KEY, objectMapper.writeValueAsString(images));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize slideshow images", e);
        }
    }

    private String pickExtension(String contentType) {
        if (contentType == null) return "bin";
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/jpeg"      -> "jpg";
            case "image/png"       -> "png";
            case "image/webp"      -> "webp";
            case "image/avif"      -> "avif";
            case "image/gif"       -> "gif";
            case "video/mp4"       -> "mp4";
            case "video/webm"      -> "webm";
            case "video/quicktime" -> "mov";
            case "video/x-msvideo" -> "avi";
            default                -> "bin";
        };
    }

    private String buildCdnUrl(String key) {
        String base = cdnProps.getBaseUrl();
        if (base == null || base.isBlank()) {
            throw new IllegalStateException("cdn.base-url is not configured");
        }
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/" + key;
    }

    /**
     * Extract the blob key from a CDN URL.
     * e.g. "https://cdn.example.com/slideshow/abc.jpg" → "slideshow/abc.jpg"
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
        // Fallback: take the path after the last domain segment
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
