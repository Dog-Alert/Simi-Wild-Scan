package com.equipo3.dogalert.report;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/v1/reports")
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) { this.reportService = reportService; }

    @PostMapping(consumes = {"multipart/form-data", "application/json"})
    @ResponseStatus(HttpStatus.CREATED)
    public ReportReceipt create(
            @Valid @RequestPart(value = "payload", required = false) ReportCreateRequest payload,
            @Valid ReportCreateRequest requestJson,
            @RequestPart(value = "photo", required = false) MultipartFile photo,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID idempotencyKey,
            Authentication authentication) {
        ReportCreateRequest actual = payload != null ? payload : requestJson;
        return reportService.create(actual, photo, authentication, idempotencyKey);
    }
}