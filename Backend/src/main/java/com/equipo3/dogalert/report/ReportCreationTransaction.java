package com.equipo3.dogalert.report;

import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.equipo3.dogalert.exception.IdempotencyKeyTakenException;
import com.equipo3.dogalert.report.dto.ReportReceipt;
import com.equipo3.dogalert.user.UserRepository;

/**
 * Escribe el reporte y reserva su llave de idempotencia dentro de una sola
 * transaccion.
 *
 * <p>Vive en un bean aparte de ReportService a proposito. Para que la excepcion
 * de llave ya tomada salga desde dentro de la transaccion y se capture despues,
 * con la transaccion ya deshecha, hacen falta dos beans: si ambos metodos
 * estuvieran en la misma clase la llamada interna saltaria el proxy de Spring y
 * la excepcion se devolveria con la transaccion marcada como rollback only.
 *
 * <p>La unicidad no se comprueba con una consulta previa sino con las
 * restricciones unicas de la base. El pre chequeo es una optimizacion para no
 * abrir una transaccion de escritura en un reintento, y la carrera real entre dos
 * peticiones simultaneas la resuelve la constraint: la perdedor recibe
 * DataIntegrityViolationException y se convierte en reenvio.
 */
@Component
public class ReportCreationTransaction {

    private final ReportRepository reportRepository;
    private final ReportIdempotencyRepository idempotencyRepository;
    private final UserRepository userRepository;

    public ReportCreationTransaction(
            ReportRepository reportRepository,
            ReportIdempotencyRepository idempotencyRepository,
            UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ReportReceipt submit(
            UUID idempotencyKey,
            Report draft,
            Long userId,
            String payloadHash) {
        if (idempotencyRepository.existsByKey(idempotencyKey.toString())
                || reportRepository.existsByClientReportId(draft.getClientReportId())) {
            throw new IdempotencyKeyTakenException();
        }

        if (userId != null) {
            draft.setUser(userRepository.getReferenceById(userId));
        }

        try {
            Report saved = reportRepository.saveAndFlush(draft);
            idempotencyRepository.save(reservation(idempotencyKey, saved, userId, payloadHash));
            return new ReportReceipt(
                    saved.getId(),
                    UUID.fromString(saved.getClientReportId()),
                    saved.getStatus(),
                    false);
        } catch (DataIntegrityViolationException violation) {
            // Otra peticion gano la carrera entre el pre chequeo y esta
            // escritura. Se deshace todo y el orquestador responde como reenvio.
            throw new IdempotencyKeyTakenException();
        }
    }

    private ReportIdempotency reservation(
            UUID idempotencyKey,
            Report report,
            Long userId,
            String payloadHash) {
        ReportIdempotency reservation = new ReportIdempotency();
        reservation.setKey(idempotencyKey.toString());
        reservation.setClientReportId(report.getClientReportId());
        reservation.setPayloadHash(payloadHash);
        reservation.setUserId(userId);
        reservation.setReport(report);
        reservation.setResponseStatus(201);
        return reservation;
    }
}