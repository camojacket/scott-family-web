package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.SiteSettingsService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SiteSettingsController {

    private final SiteSettingsService settingsService;
    private final CdnUploadService cdnUploadService;

    public SiteSettingsController(SiteSettingsService settingsService,
                                  CdnUploadService cdnUploadService) {
        this.settingsService = settingsService;
        this.cdnUploadService = cdnUploadService;
    }

    /** Public — any visitor can read site settings. */
    @GetMapping
    public Map<String, String> getAll() {
        return settingsService.getAll();
    }

    /** Admin-only — update one or more settings. */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<Map<String, String>> update(@RequestBody Map<String, String> body) {
        settingsService.putAll(body);
        return ResponseEntity.ok(settingsService.getAll());
    }

    /** Admin-only — upload a new home-page hero image and persist its CDN URL. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/home-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadHomeImage(
            @RequestPart("file") MultipartFile file) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, CdnUploadService.AssetKind.STATIC, file);
        settingsService.put("home_image_url", result.getCdnUrl());
        return ResponseEntity.ok(Map.of(
                "cdnUrl", result.getCdnUrl(),
                "key", result.getKey()
        ));
    }

    /** Admin-only — upload a reunion information packet (PDF) and persist its CDN URL. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(value = "/info-packet", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadInfoPacket(
            @RequestPart("file") MultipartFile file) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, CdnUploadService.AssetKind.DOCUMENT, file);
        settingsService.put("reunion_info_packet_url", result.getCdnUrl());
        return ResponseEntity.ok(Map.of(
                "cdnUrl", result.getCdnUrl(),
                "key", result.getKey()
        ));
    }
}
