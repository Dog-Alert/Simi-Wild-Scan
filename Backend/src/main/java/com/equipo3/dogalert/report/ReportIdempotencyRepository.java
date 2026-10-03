package com.equipo3.dogalert.report;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Reserva de llaves de idempotencia. Tabla creada por
 * {@code V1.4__sincronizacion_idempotencia_reportes_propios.sql} (requisito A
 * del contrato de base de datos de DOG-35).
 *
 * <p>Los dos métodos {@code exists*} son el PRE CHEQUEO del flujo de creación.
 * No son la garantía: la garantía son las dos restricciones UNIQUE de la tabla,
 * que es lo único que detiene la carrera entre dos peticiones simultáneas con
 * la misma llave. Si el pre chequeo dice que no existe y las dos escriben a la
 * vez, el UNIQUE rechaza a la segunda y el llamador convierte ese
 * {@code DataIntegrityViolationException} en un 200 de reenvío.
 */
public interface ReportIdempotencyRepository
        extends JpaRepository<ReportIdempotency, Long> {

    boolean existsByKey(String key);

    boolean existsByClientReportId(String clientReportId);

    Optional<ReportIdempotency> findByKey(String key);

    Optional<ReportIdempotency> findByClientReportId(String clientReportId);
}