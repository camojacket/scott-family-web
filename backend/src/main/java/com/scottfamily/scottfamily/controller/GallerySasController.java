package com.scottfamily.scottfamily.controller;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.sas.BlobContainerSasPermission;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import com.scottfamily.scottfamily.properties.CdnProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Generates short-lived SAS (Shared Access Signature) tokens so the browser
 * can upload gallery images directly to Azure Blob Storage — no server-side
 * memory or request-size limits involved.
 *
 * Flow:
 *   1. Admin calls POST /api/gallery/sas with a list of files (name + contentType)
 *   2. Backend returns { uploads: [{ blobKey, sasUrl, cdnUrl }] } for each file
 *   3. Frontend uploads each file directly to its sasUrl using @azure/storage-blob
 *   4. Frontend calls POST /api/gallery/images/register with metadata for each
 */
@RestController
@RequestMapping("/api/gallery")
public class GallerySasController {

    private final BlobContainerClient container;
    private final CdnProperties cdnProps;

    public GallerySasController(BlobContainerClient container, CdnProperties cdnProps) {
        this.container = container;
        this.cdnProps = cdnProps;
    }

    // ── Request / Response DTOs ──────────────────────────────────────────────────

    public static class SasRequest {
        public List<FileInfo> files;

        public static class FileInfo {
            public String fileName;
            public String contentType;
        }
    }

    public static class SasResponse {
        public List<UploadTarget> uploads;

        public SasResponse(List<UploadTarget> uploads) {
            this.uploads = uploads;
        }
    }

    public static class UploadTarget {
        public String blobKey;
        public String sasUrl;
        public String cdnUrl;

        public UploadTarget(String blobKey, String sasUrl, String cdnUrl) {
            this.blobKey = blobKey;
            this.sasUrl = sasUrl;
            this.cdnUrl = cdnUrl;
        }
    }

    // ── Endpoint ────────────────────────────────────────────────────────────────

    /**
     * Generate SAS upload URLs for a batch of files.
     * Each SAS token is valid for 30 minutes and scoped to a single blob key.
     */
    @PostMapping("/sas")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SasResponse> generateSasUrls(@RequestBody SasRequest request) {
        if (request.files == null || request.files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        List<UploadTarget> targets = new ArrayList<>();

        for (SasRequest.FileInfo info : request.files) {
            String ext = pickExtension(info.contentType);
            String blobKey = "gallery/" + UUID.randomUUID() + "." + ext;

            // Generate a SAS token scoped to this single blob, valid 30 min
            BlobContainerSasPermission permissions = new BlobContainerSasPermission()
                    .setWritePermission(true)
                    .setCreatePermission(true);

            BlobServiceSasSignatureValues sasValues = new BlobServiceSasSignatureValues(
                    OffsetDateTime.now().plusMinutes(30),
                    permissions
            );

            String sasToken = container.getBlobClient(blobKey)
                    .generateSas(sasValues);

            String sasUrl = container.getBlobClient(blobKey).getBlobUrl() + "?" + sasToken;
            String cdnUrl = buildCdnUrl(blobKey);

            targets.add(new UploadTarget(blobKey, sasUrl, cdnUrl));
        }

        return ResponseEntity.ok(new SasResponse(targets));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

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
            case "video/quicktime"  -> "mov";
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
}
