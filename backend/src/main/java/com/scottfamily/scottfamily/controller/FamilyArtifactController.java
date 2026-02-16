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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.CdnUploadService.AssetKind;
import com.scottfamily.scottfamily.service.FamilyArtifactService;
import com.scottfamily.scottfamily.service.FamilyArtifactService.FamilyArtifactDto;
import com.scottfamily.scottfamily.service.FamilyArtifactService.UpdateFamilyArtifactRequest;

@RestController
@RequestMapping("/api/family-artifacts")
public class FamilyArtifactController {

    private final FamilyArtifactService familyArtifactService;
    private final CdnUploadService cdnUploadService;

    public FamilyArtifactController(FamilyArtifactService familyArtifactService, CdnUploadService cdnUploadService) {
        this.familyArtifactService = familyArtifactService;
        this.cdnUploadService = cdnUploadService;
    }

    /** Authenticated — list all family artifacts sorted by date desc, name asc */
    @GetMapping
    public List<FamilyArtifactDto> getAll() {
        return familyArtifactService.getAll();
    }

    /** Admin — create family artifact with PDF upload */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FamilyArtifactDto> create(
            @RequestPart("file") MultipartFile file,
            @RequestPart("name") String name,
            @RequestPart("issueDate") String issueDate
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.ARTIFACT, file);
        FamilyArtifactDto dto = familyArtifactService.create(name, issueDate, result.getCdnUrl(), result.getKey());
        return ResponseEntity.ok(dto);
    }

    /** Admin — update family artifact metadata (name, date) */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FamilyArtifactDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateFamilyArtifactRequest req
    ) {
        FamilyArtifactDto dto = familyArtifactService.update(id, req);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — re-upload file for existing family artifact */
    @PostMapping(value = "/{id}/reupload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FamilyArtifactDto> reupload(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.ARTIFACT, file);
        FamilyArtifactDto dto = familyArtifactService.reupload(id, result.getCdnUrl(), result.getKey());
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — delete family artifact */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        familyArtifactService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
