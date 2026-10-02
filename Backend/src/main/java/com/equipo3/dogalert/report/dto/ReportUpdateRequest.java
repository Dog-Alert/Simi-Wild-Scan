package com.equipo3.dogalert.report.dto;

import java.time.Instant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

/**
 * Cuerpo de PATCH /v1/me/reports/{reportId}.
 *
 * <p>Todos los campos son obligatorios porque el OpenAPI (schemas/ReportUpdate)
 * define elPATCH como reemplazo completo, no como parche parcial. A diferencia de
 * la creacion no lleva clientReportId ni consentAccepted: el reporte ya existe y
 * su consentimiento se registro al crearlo.
 *
 * <p>Tampoco admite foto: el contrato de edicion es application/json y no existe
 * la forma de cambiar la evidencia.
 */
public record ReportUpdateRequest(
        @NotNull @PastOrPresent Instant eventAt,
        @NotBlank @Size(max = 50) String eventType,
        @NotBlank @Size(max = 20) String severity,
        @NotBlank @Size(max = 20) String certainty,
        @NotNull @Min(1) @Max(999) Integer dogCount,
        @NotBlank @Size(max = 20) String size,
        @Size(max = 120) String color,
        boolean colorUndetermined,
        @NotBlank @Size(max = 20) String collar,
        @NotBlank @Size(min = 20, max = 2000) String description,
        @NotNull @Valid CoordinateRequest location
) {
    @AssertTrue(message = "Debes especificar el color o marcar 'color indeterminado'")
    public boolean isColorSelectionValid() {
        boolean hasColor = color != null && !color.isBlank();
        return hasColor ^ colorUndetermined;
    }
}