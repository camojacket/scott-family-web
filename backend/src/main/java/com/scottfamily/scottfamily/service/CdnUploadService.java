package com.scottfamily.scottfamily.service;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.azure.core.util.BinaryData;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.specialized.BlockBlobClient;
import com.scottfamily.scottfamily.properties.CdnProperties;

/**
 * Uploads images to Azure Blob Storage and returns their CDN URLs.
 * - Uses BinaryData to avoid InputStream mark/reset issues.
 * - Validates MIME type and size using CdnProperties.
 * - Uses Long for user IDs.
 */
@Service
public class CdnUploadService {

    public enum AssetKind { PROFILE, BANNER, POST_IMAGE, STATIC, DOCUMENT, PRODUCT, ARTIFACT, OBITUARY }

    private static final Set<String> ALLOWED_MEDIA_TYPES = Set.of(
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "image/webp",
            "image/avif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo"
    );

    /** Media types accepted for DOCUMENT uploads (e.g. reunion information packet). */
    private static final Set<String> ALLOWED_DOCUMENT_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE
    );

    /** Media types accepted for ARTIFACT uploads (PDFs + images). */
    private static final Set<String> ALLOWED_ARTIFACT_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "image/webp",
            "image/avif"
    );

    /** Media types accepted for OBITUARY uploads (PDFs + images). */
    private static final Set<String> ALLOWED_OBITUARY_TYPES = Set.of(
            MediaType.APPLICATION_PDF_VALUE,
            MediaType.IMAGE_JPEG_VALUE,
            MediaType.IMAGE_PNG_VALUE,
            "image/webp",
            "image/avif"
    );

    private final BlobContainerClient container;
    private final CdnProperties props;

    public CdnUploadService(BlobContainerClient container, CdnProperties props) {
        this.container = container;
        this.props = props;
    }

    public UploadResult uploadUserImage(Long userIdOrNull, AssetKind kind, MultipartFile file) throws IOException {
        Objects.requireNonNull(kind, "asset kind is required");
        Objects.requireNonNull(file, "file is required");
        if (kind == AssetKind.DOCUMENT) {
            validateDocument(file);
        } else if (kind == AssetKind.ARTIFACT) {
            validateArtifact(file);
        } else if (kind == AssetKind.OBITUARY) {
            validateObituary(file);
        } else {
            validateFile(file);
        }

        final String contentType = safeLower(file.getContentType());
        final String ext = pickExtension(contentType);
        final String key = buildKey(userIdOrNull, kind, ext);

        final BlockBlobClient blob = container.getBlobClient(key).getBlockBlobClient();

        final BlobHttpHeaders headers = new BlobHttpHeaders()
                .setContentType(contentType == null ? "application/octet-stream" : contentType)
                .setCacheControl(kind == AssetKind.STATIC
                        ? "public, max-age=31536000, immutable"
                        : props.getCacheControl());

        // Buffer to memory to avoid mark/reset issues on multipart streams.
        final BinaryData data = BinaryData.fromBytes(file.getBytes());
        blob.upload(data, true);
        blob.setHttpHeaders(headers);

        final String cdnUrl = buildCdnUrl(key);

        return new UploadResult(
                key,
                cdnUrl,
                headers.getContentType(),
                file.getSize(),
                OffsetDateTime.now()
        );
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > props.getMaxBytes()) {
            throw new IllegalArgumentException("File too large. Max=" + props.getMaxBytes() + " bytes");
        }
        final String ct = safeLower(file.getContentType());
        if (ct == null || !ALLOWED_MEDIA_TYPES.contains(ct)) {
            throw new IllegalArgumentException("Unsupported content-type: " + file.getContentType());
        }
    }

    private static final long MAX_DOCUMENT_BYTES = 20L * 1024 * 1024; // 20 MB

    private void validateDocument(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_DOCUMENT_BYTES) {
            throw new IllegalArgumentException("Document too large. Max 20 MB");
        }
        final String ct = safeLower(file.getContentType());
        if (ct == null || !ALLOWED_DOCUMENT_TYPES.contains(ct)) {
            throw new IllegalArgumentException("Only PDF files are accepted");
        }
    }

    private void validateArtifact(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_DOCUMENT_BYTES) {
            throw new IllegalArgumentException("File too large. Max 20 MB");
        }
        final String ct = safeLower(file.getContentType());
        if (ct == null || !ALLOWED_ARTIFACT_TYPES.contains(ct)) {
            throw new IllegalArgumentException("Only PDF and image files (JPG, PNG, WebP, AVIF) are accepted");
        }
    }

    private void validateObituary(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        if (file.getSize() > MAX_DOCUMENT_BYTES) {
            throw new IllegalArgumentException("File too large. Max 20 MB");
        }
        final String ct = safeLower(file.getContentType());
        if (ct == null || !ALLOWED_OBITUARY_TYPES.contains(ct)) {
            throw new IllegalArgumentException("Only PDF and image files (JPG, PNG, WebP, AVIF) are accepted");
        }
    }

    private String pickExtension(String contentType) {
        if (contentType == null) return "bin";
        switch (contentType) {
            case MediaType.IMAGE_JPEG_VALUE: return "jpg";
            case MediaType.IMAGE_PNG_VALUE:  return "png";
            case "image/webp":               return "webp";
            case "image/avif":               return "avif";
            case "video/mp4":                return "mp4";
            case "video/webm":               return "webm";
            case "video/quicktime":           return "mov";
            case "video/x-msvideo":           return "avi";
            case MediaType.APPLICATION_PDF_VALUE: return "pdf";
            default:                         return "bin";
        }
    }

    private String buildKey(Long userId, AssetKind kind, String ext) {
        final String folder;
        switch (kind) {
            case PROFILE:
                folder = "pfp/";
                break;
            case BANNER:
                folder = "banner/";
                break;
            case POST_IMAGE:
                folder = "posts/";
                break;
            case STATIC:
                folder = "static/";
                break;
            case DOCUMENT:
                folder = "documents/";
                break;
            case ARTIFACT:
                folder = "artifacts/";
                break;
            case OBITUARY:
                folder = "obituaries/";
                break;
            case PRODUCT:
                folder = "store/products/";
                break;
            default:
                folder = "misc/";
        }
        return folder + UUID.randomUUID() + "." + ext;
    }

    private String buildCdnUrl(String key) {
        String base = props.getBaseUrl();
        if (base == null || base.isBlank()) {
            throw new IllegalStateException("cdn.base-url is not configured");
        }
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + "/" + key;
    }

    private static String safeLower(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }

    // Simple DTO
    public static class UploadResult {
        private final String key;
        private final String cdnUrl;
        private final String contentType;
        private final long bytes;
        private final OffsetDateTime uploadedAt;

        public UploadResult(String key, String cdnUrl, String contentType, long bytes, OffsetDateTime uploadedAt) {
            this.key = key;
            this.cdnUrl = cdnUrl;
            this.contentType = contentType;
            this.bytes = bytes;
            this.uploadedAt = uploadedAt;
        }

        public String getKey() { return key; }
        public String getCdnUrl() { return cdnUrl; }
        public String getContentType() { return contentType; }
        public long getBytes() { return bytes; }
        public OffsetDateTime getUploadedAt() { return uploadedAt; }
    }
}
