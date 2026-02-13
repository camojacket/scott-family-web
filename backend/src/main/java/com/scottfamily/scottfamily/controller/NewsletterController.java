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

import com.scottfamily.scottfamily.service.CdnUploadService;
import com.scottfamily.scottfamily.service.CdnUploadService.AssetKind;
import com.scottfamily.scottfamily.service.NewsletterService;
import com.scottfamily.scottfamily.service.NewsletterService.NewsletterDto;
import com.scottfamily.scottfamily.service.NewsletterService.UpdateNewsletterRequest;

@RestController
@RequestMapping("/api/newsletters")
public class NewsletterController {

    private final NewsletterService newsletterService;
    private final CdnUploadService cdnUploadService;

    public NewsletterController(NewsletterService newsletterService, CdnUploadService cdnUploadService) {
        this.newsletterService = newsletterService;
        this.cdnUploadService = cdnUploadService;
    }

    /** Authenticated — list all newsletters sorted by date desc, name asc */
    @GetMapping
    public List<NewsletterDto> getAll() {
        return newsletterService.getAll();
    }

    /** Admin — create newsletter with PDF upload */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<NewsletterDto> create(
            @RequestPart("file") MultipartFile file,
            @RequestPart("name") String name,
            @RequestPart("issueDate") String issueDate
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.DOCUMENT, file);
        NewsletterDto dto = newsletterService.create(name, issueDate, result.getCdnUrl(), result.getKey());
        return ResponseEntity.ok(dto);
    }

    /** Admin — update newsletter metadata (name, date) */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<NewsletterDto> update(
            @PathVariable Long id,
            @RequestBody UpdateNewsletterRequest req
    ) {
        NewsletterDto dto = newsletterService.update(id, req);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — re-upload PDF for existing newsletter */
    @PostMapping(value = "/{id}/reupload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<NewsletterDto> reupload(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        var result = cdnUploadService.uploadUserImage(null, AssetKind.DOCUMENT, file);
        NewsletterDto dto = newsletterService.reupload(id, result.getCdnUrl(), result.getKey());
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — delete newsletter */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        newsletterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
