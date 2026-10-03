package com.equipo3.dogalert.exception;

/**
 * La llave de idempotencia ya se uso, pero su reporte fue eliminado por el autor
 * (RF-026).
 *
 * <p>La fila de idempotencia sobrevive al borrado fisico con ID_Reporte en NULL,
 * de modo que el UUID queda consumido y un reintento nunca puede recrear el
 * reporte como duplicado. Responder 200 con un recurso inexistente seria
 * incorrecto, asi que se responde 410.
 */
public class ReportDeletedException extends RuntimeException {
    public ReportDeletedException() {
        super("El reporte fue eliminado por su autor");
    }
}