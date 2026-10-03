package com.equipo3.dogalert.report;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;

import com.equipo3.dogalert.exception.InvalidCursorException;

/**
 * Cursor opaco de la lista de reportes propios.
 *
 * <p>Guarda la posicion (Fecha_Evento, ID_Reporte) codificada en Base64. El
 * cliente no debe interpretarlo ni construirlo, por eso no se expone como pagina
 * ni como offset: un offset se desfasa en cuanto el autor edita o borra un
 * reporte, y keyset no.
 */
public final class ReportCursor {

    private static final String SEPARATOR = "|";

    private final Instant eventAt;
    private final Long reportId;

    private ReportCursor(Instant eventAt, Long reportId) {
        this.eventAt = eventAt;
        this.reportId = reportId;
    }

    public static ReportCursor of(Report report) {
        return new ReportCursor(report.getEventAt(), report.getId());
    }

    public String encode() {
        String raw = eventAt + SEPARATOR + reportId;
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static ReportCursor decode(String encoded) {
        String raw;
        try {
            raw = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            throw new InvalidCursorException();
        }

        int separator = raw.indexOf(SEPARATOR);
        if (separator < 0) {
            throw new InvalidCursorException();
        }

        try {
            return new ReportCursor(
                    Instant.parse(raw.substring(0, separator)),
                    Long.valueOf(raw.substring(separator + 1)));
        } catch (DateTimeParseException | NumberFormatException exception) {
            throw new InvalidCursorException();
        }
    }

    public Instant eventAt() {
        return eventAt;
    }

    public Long reportId() {
        return reportId;
    }
}