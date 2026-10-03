package com.equipo3.dogalert.report;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReportRepository extends JpaRepository<Report, Long> {

    Optional<Report> findByClientReportId(String clientReportId);

    boolean existsByClientReportId(String clientReportId);

    List<Report> findByStatusOrderByEventAtDesc(ReportStatus status);

    List<Report> findByEventAtBetweenOrderByEventAtDesc(
            Instant start,
            Instant end);

    List<Report> findByEventAtBetweenAndSizeAndColorAndCollar(
            Instant start,
            Instant end,
            DogSize size,
            String color,
            CollarPresence collar);

    /**
     * Busca un reporte exigiendo la pertenencia en la misma sentencia.
     *
     * <p>El filtro va dentro del query a proposito: cargar el reporte y luego
     * comparar el usuario en memoria abriria la puerta a responder 403 y por tanto
     * a confirmar que el reporte ajeno existe. Aqui la ausencia y la ajenidad
     * devuelven el mismo Optional vacio, y el servicio las traduce al mismo 404.
     */
    Optional<Report> findByIdAndUser_Id(Long id, Long userId);

    /**
     * Pagina los reportes propios por keyset sobre (Fecha_Evento, ID_Reporte), el
     * orden que sostiene el indice idx_reportes_usuario_fecha. Con cursor nulo
     * devuelve la primera pagina.
     */
    @Query("""
            select r from Report r
            where r.user.id = :userId
              and (
                :cursorAt is null
                or r.eventAt < :cursorAt
                or (r.eventAt = :cursorAt and r.id < :cursorId)
              )
            order by r.eventAt desc, r.id desc
            """)
    List<Report> findOwnPage(
            @Param("userId") Long userId,
            @Param("cursorAt") Instant cursorAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable);
}