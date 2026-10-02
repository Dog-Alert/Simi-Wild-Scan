package com.equipo3.dogalert.report;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.equipo3.dogalert.report.dto.OwnedReportPage;
import com.equipo3.dogalert.report.dto.OwnedReportResponse;
import com.equipo3.dogalert.report.dto.ReportUpdateRequest;

import jakarta.validation.Valid;

/**
 * Reportes propios del usuario autenticado. Seccion 4.5 del SDD.
 *
 * <p>No se decide aqui la propiedad: la resuelve el servicio exigiendo el
 * propietario en la consulta, de modo que un reporte ajeno responde 404 igual que
 * uno inexistente.
 *
 * <p>La seguridad de la ruta no se declara aqui tampoco. SecurityConfig deja
 * /v1/me/** dentro de anyRequest().authenticated(), asi que sin token la respuesta
 * es 401 antes de llegar a este controlador.
 */
@RestController
@RequestMapping("/v1/me/reports")
public class MyReportsController {
    private final ReportService reportService;

    public MyReportsController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public OwnedReportPage listar(
            @RequestParam(required = false) String cursor,
            Authentication authentication) {
        return reportService.listar(authentication, cursor);
    }

    @GetMapping("/{reportId}")
    public OwnedReportResponse detalle(
            @PathVariable Long reportId,
            Authentication authentication) {
        return reportService.detalle(authentication, reportId);
    }

    @PatchMapping("/{reportId}")
    public OwnedReportResponse actualizar(
            @PathVariable Long reportId,
            @Valid @RequestBody ReportUpdateRequest request,
            Authentication authentication) {
        return reportService.actualizar(authentication, reportId, request);
    }

    @DeleteMapping("/{reportId}")
    public ResponseEntity<Void> borrar(
            @PathVariable Long reportId,
            Authentication authentication) {
        reportService.borrar(authentication, reportId);
        return ResponseEntity.noContent().build();
    }
}