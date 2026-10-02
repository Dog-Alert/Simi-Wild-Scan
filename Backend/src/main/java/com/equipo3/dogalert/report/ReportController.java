package com.equipo3.dogalert.report;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
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

    /**
     * Envio multipart con la evidencia. El payload viaja como parte JSON y la foto
     * como archivo, segun el esquema del SDD.
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ReportReceipt> create(
            @Valid @RequestPart("payload") ReportCreateRequest payload,
            @RequestPart(value = "photo", required = false) MultipartFile photo,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID idempotencyKey,
            Authentication authentication) {
        return respond(payload, photo, idempotencyKey, authentication);
    }

    /** Envio sin evidencia, con el reporte completo en el cuerpo JSON. */
    @PostMapping(consumes = "application/json")
    public ResponseEntity<ReportReceipt> createWithoutPhoto(
            @Valid @RequestBody ReportCreateRequest payload,
            @RequestHeader(value = "Idempotency-Key", required = false) UUID idempotencyKey,
            Authentication authentication) {
        return respond(payload, null, idempotencyKey, authentication);
    }

    /**
     * La primera llamada responde 201 y un reintento identico responde 200 con
     * replayed en true. Por eso el codigo se decide aqui y no con @ResponseStatus.
     * Ver secciones 4.7 y 6.6 del SDD.
     */
    private ResponseEntity<ReportReceipt> respond(
            ReportCreateRequest payload,
            MultipartFile photo,
            UUID idempotencyKey,
            Authentication authentication) {
        ReportReceipt receipt =
                reportService.create(payload, photo, authentication, idempotencyKey);
        HttpStatus status = receipt.replayed() ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(receipt);
    }
}