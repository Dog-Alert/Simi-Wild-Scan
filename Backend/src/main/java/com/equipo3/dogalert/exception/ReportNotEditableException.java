package com.equipo3.dogalert.exception;

/**
 * El reporte propio existe pero su estado no admite edicion por parte del autor.
 *
 * <p>Solo PENDING y VERIFIED son editables. REJECTED, DUPLICATE y ARCHIVED se
 * liberan por via administrativa segun report_state.mmd.
 */
public class ReportNotEditableException extends RuntimeException {
    public ReportNotEditableException() {
        super("El reporte no se puede editar en su estado actual");
    }
}