package com.equipo3.dogalert.report.dto;

import java.time.Instant;
import java.util.UUID;

import com.equipo3.dogalert.report.Report;
import com.equipo3.dogalert.report.ReportStatus;

/**
 * Detalle de un reporte propio,schemas/OwnedReport del OpenAPI.
 *
 * <p>Incluye la coordenada exacta porque el lector es el autor del reporte. La
 * coordenada aproximada y la alimentacion de mapas y estadisticas usan otras rutas.
 *
 * <p>El campo replayed lo impone el allOf con ReportReceipt y no tiene sentido en
 * una lectura, asi que siempre viaja en false.
 */
public record OwnedReportResponse(
        Long id,
        UUID clientReportId,
        ReportStatus status,
        boolean replayed,
        Instant eventAt,
        String eventType,
        String severity,
        String certainty,
        int dogCount,
        String size,
        String collar,
        String description,
        CoordinateRequest exactLocation,
        boolean hasPhoto) {

    public static OwnedReportResponse from(Report report) {
        return new OwnedReportResponse(
                report.getId(),
                UUID.fromString(report.getClientReportId()),
                report.getStatus(),
                false,
                report.getEventAt(),
                report.getEventType(),
                report.getSeverity().name(),
                report.getCertainty().name(),
                report.getDogCount(),
                report.getSize().name(),
                report.getCollar().name(),
                report.getDescription(),
                new CoordinateRequest(
                        report.getLatitude().doubleValue(),
                        report.getLongitude().doubleValue()),
                report.hasPhoto());
    }
}