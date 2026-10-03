package com.equipo3.dogalert.exception;

/**
 * Reporte propio inexistente o ajeno al usuario autenticado.
 *
 * <p>Ambos casos comparten el mismo codigo de error porque responder 403 a un
 * reporte ajeno confirmaria que ese ID existe y permitiria enumerar reportes de
 * otros autores. Ver 04_api_rest.md seccion 4.5 y 09_seguridad_privacidad.md 9.3.
 */
public class ReportNotFoundException extends RuntimeException {
    public ReportNotFoundException() {
        super("El reporte no existe");
    }
}