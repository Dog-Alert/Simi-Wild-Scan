package com.equipo3.dogalert.report;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Valores ya validados de una edicion del autor.
 *
 * <p>Existe para que Report.editByAuthor reciba un unico objeto en lugar de once
 * argumentos, y para dejar explicito que la validacion (fechas, poligono y
 * catalogos) ocurre antes, en el servicio.
 */
public record ReportEdit(
        Instant eventAt,
        String eventType,
        Severity severity,
        Certainty certainty,
        int dogCount,
        DogSize size,
        String color,
        boolean colorUndetermined,
        CollarPresence collar,
        String description,
        BigDecimal latitude,
        BigDecimal longitude,
        String polygonVersion) {
}