package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.AnnouncementService;
import com.scottfamily.scottfamily.service.AnnouncementService.AnnouncementDto;
import com.scottfamily.scottfamily.service.AnnouncementService.CreateAnnouncementRequest;
import com.scottfamily.scottfamily.service.AnnouncementService.UpdateAnnouncementRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    /** Public — active announcements only */
    @GetMapping("/active")
    public List<AnnouncementDto> getActive() {
        return announcementService.getActive();
    }

    /** Admin — all announcements */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<AnnouncementDto> getAll() {
        return announcementService.getAll();
    }

    /** Admin — create */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnnouncementDto> create(@RequestBody CreateAnnouncementRequest req) {
        return ResponseEntity.ok(announcementService.create(req));
    }

    /** Admin — update */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AnnouncementDto> update(
            @PathVariable Long id,
            @RequestBody UpdateAnnouncementRequest req
    ) {
        AnnouncementDto dto = announcementService.update(id, req);
        if (dto == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(dto);
    }

    /** Admin — delete */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        announcementService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
