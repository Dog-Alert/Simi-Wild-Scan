package com.equipo3.dogalert.report.dto;

import java.util.List;

/**
 * Pagina de reportes propios,schemas/listMyReports del OpenAPI.
 *
 * <p>nextCursor es null en la ultima pagina. Se pide una fila extra al repositorio
 * para saber si hay mas sin contar dos veces.
 */
public record OwnedReportPage(List<OwnedReportResponse> items, String nextCursor) {
}