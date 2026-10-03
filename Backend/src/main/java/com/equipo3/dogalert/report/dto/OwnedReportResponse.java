package com.equipo3.dogalert.report.dto;

import java.time.Instant;
import java.util.UUID;

import com.equipo3.dogalert.report.Report;
import com.equipo3.dogalert.report.ReportStatus;

/**
 * Detalle de un reporte propio, schemas/OwnedReport del OpenAPI.
 *
 * <p>Incluye la coordenada exacta porque el lector es el autor del reporte. La
 * coordenada aproximada y la alimentacion de mapas y estadisticas usan otras rutas.
 *
 * <p>No declara replayed: ese campo distingue un reintento idempotente del alta y no
 * tiene sentido al leer o editar. Se elimino de aqui cuando ReportReceipt paso a
 * componerse sobre ReportIdentity.
 */
public record OwnedReportResponse(
        Long id,
        UUID clientReportId,
        ReportStatus status,
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