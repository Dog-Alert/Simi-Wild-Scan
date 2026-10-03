package com.equipo3.dogalert.report;

/**
 * Resultado de evaluar un punto contra el limite de Creel.
 *
 * <p>Devuelve la version del poligono junto con la respuesta para que un reporte
 * quede siempre sellado con la misma geometria que se uso para aceptarlo. Si se
 * consultaran por separado, una recarga del poligono entre ambas llamadas podria
 * sellar un reporte con una version que nunca se evaluo.
 */
public record CreelEvaluation(boolean inside, String polygonVersion) {
}