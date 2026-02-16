package com.scottfamily.scottfamily.controller;

import java.io.IOException;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.CdnUploadService.AssetKind;
import com.scottfamily.scottfamily.service.ObituaryService;
import com.scottfamily.scottfamily.service.ObituaryService.ObituaryDto;
import com.scottfamily.scottfamily.service.ObituaryService.UpdateObituaryRequest;

@RestController
@RequestMapping("/api/obituaries")
public class ObituaryController {

    private final ObituaryService obituaryService;
    private final CdnUploadService cdnUploadService;

    public ObituaryController(ObituaryService obituaryService, CdnUploadService cdnUploadService) {
        this.obituaryService = obituaryService;
        this.cdnUploadService = cdnUploadService;
    }

    /** Authenticated — list all obituaries with tagged people */
    @GetMapping
    public List<ObituaryDto> getAll(
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "100") int limit) {
        return obituaryService.getAll(offset, Math.min(limit, 100));
    }

    /** Authenticated — get obituaries tagged to a specific person */
    @GetMapping(params = "personId")
    public List<ObituaryDto> getByPerson(@RequestParam Long personId) {
        return obituaryService.getByPersonId(personId);
    }

    /** Admin — create obituary with file upload + title + tagged person IDs */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ObituaryDto> create(
            @RequestPart("file") MultipartFile file,
            @RequestPart("title") String title,
            @RequestPart(value = "personIds", required = false) String personIdsJson
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.OBITUARY, file);

        String contentType = file.getContentType();
        String fileType = (contentType != null && contentType.startsWith("image/")) ? "IMAGE" : "PDF";

        List<Long> personIds = List.of();
        if (personIdsJson != null && !personIdsJson.isBlank()) {
            personIds = parsePersonIds(personIdsJson);
        }

        ObituaryDto dto = obituaryService.create(title, result.getCdnUrl(), result.getKey(), fileType, null, personIds);
        return ResponseEntity.ok(dto);
    }

    /** Admin — update obituary metadata (title) */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ObituaryDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateObituaryRequest req
    ) {
        ObituaryDto dto = obituaryService.update(id, req);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — update tagged people */
    @PutMapping("/{id}/tags")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ObituaryDto> updateTags(
            @PathVariable Long id,
            @RequestBody List<Long> personIds
    ) {
        ObituaryDto dto = obituaryService.updateTags(id, personIds);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — re-upload file for existing obituary */
    @PostMapping(value = "/{id}/reupload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ObituaryDto> reupload(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.OBITUARY, file);
        String contentType = file.getContentType();
        String fileType = (contentType != null && contentType.startsWith("image/")) ? "IMAGE" : "PDF";
        ObituaryDto dto = obituaryService.reupload(id, result.getCdnUrl(), result.getKey(), fileType);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — delete obituary */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        obituaryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // Parse JSON array of person IDs: "[1,2,3]"
    private List<Long> parsePersonIds(String json) {
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("[")) trimmed = trimmed.substring(1);
            if (trimmed.endsWith("]")) trimmed = trimmed.substring(0, trimmed.length() - 1);
            if (trimmed.isBlank()) return List.of();
            return java.util.Arrays.stream(trimmed.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(Long::parseLong)
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }
}
