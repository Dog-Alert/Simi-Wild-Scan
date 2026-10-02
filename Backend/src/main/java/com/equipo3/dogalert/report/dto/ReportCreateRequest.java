package com.equipo3.dogalert.report.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReportCreateRequest(
        @NotNull UUID clientReportId,
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
        @NotNull @Valid CoordinateRequest location,
        @AssertTrue(message = "Debes aceptar el consentimiento para enviar el reporte")
        boolean consentAccepted
) {
    @AssertTrue(message = "Debes especificar el color o marcar 'color indeterminado'")
    public boolean isColorSelectionValid() {
        boolean hasColor = color != null && !color.isBlank();
        return hasColor ^ colorUndetermined;
    }
}