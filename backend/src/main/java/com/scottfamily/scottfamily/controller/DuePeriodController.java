package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.DuePeriodService;
import com.scottfamily.scottfamily.service.DuePeriodService.DuePeriodDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * REST API for managing the reunion due period.
 *
 *   GET  /api/dues/period        — anyone: get current active period
 *   POST /api/dues/period        — admin: save/update the period
 */
@RestController
@RequestMapping("/api/dues/period")
public class DuePeriodController {

    private final DuePeriodService periodService;

    public DuePeriodController(DuePeriodService periodService) {
        this.periodService = periodService;
    }

    /** Get the current (or latest) due period configuration. Accessible to any authenticated user. */
    @GetMapping
    public ResponseEntity<?> getPeriod() {
        DuePeriodDto active = periodService.getActivePeriod();
        if (active == null) {
            // Fall back to latest configured (even if not currently active)
            DuePeriodDto latest = periodService.getLatestPeriod();
            if (latest == null) {
                return ResponseEntity.ok(Map.of("configured", false));
            }
            return ResponseEntity.ok(Map.of(
                    "configured", true,
                    "active", false,
                    "period", latest
            ));
        }
        return ResponseEntity.ok(Map.of(
                "configured", true,
                "active", true,
                "period", active
        ));
    }

    /** Admin: save or update the reunion due period. */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<?> savePeriod(@RequestBody SavePeriodRequest request) {
        if (request.reunionYear < 2000 || request.reunionYear > 2100) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid reunion year"));
        }
        if (request.startDate == null || request.endDate == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Start date and end date are required"));
        }

        try {
            LocalDate start = LocalDate.parse(request.startDate);
            LocalDate end = LocalDate.parse(request.endDate);
            DuePeriodDto saved = periodService.save(request.reunionYear, start, end);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public static class SavePeriodRequest {
        public int reunionYear;
        public String startDate;
        public String endDate;
    }
}
