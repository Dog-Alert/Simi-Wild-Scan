package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class ReportIdempotencyRepositoryTests {

    @Autowired
    private ReportIdempotencyRepository idempotencyRepository;

    @Autowired
    private ReportRepository reportRepository;

    /**
     * Necesario para releer desde la base de datos y no desde la cache de primer
     * nivel, que seguiria devolviendo la referencia al reporte ya eliminado.
     */
    @Autowired
    private EntityManager entityManager;

    @Test
    void reservesKeyOnFirstAttempt() {
        String key = UUID.randomUUID().toString();
        String clientReportId = UUID.randomUUID().toString();

        idempotencyRepository.saveAndFlush(reservation(key, clientReportId, hash()));

        assertTrue(idempotencyRepository.existsByKey(key));
        assertTrue(idempotencyRepository.existsByClientReportId(clientReportId));
        assertEquals(hash(), idempotencyRepository.findByKey(key).orElseThrow().getPayloadHash());
    }

    @Test
    void rejectsDuplicatedKey() {
        String key = UUID.randomUUID().toString();
        idempotencyRepository.saveAndFlush(reservation(key, UUID.randomUUID().toString(), hash()));

        assertThrows(
                DataIntegrityViolationException.class,
                () -> idempotencyRepository.saveAndFlush(
                        reservation(key, UUID.randomUUID().toString(), hash())));
    }

    @Test
    void rejectsDuplicatedClientReportId() {
        String clientReportId = UUID.randomUUID().toString();
        idempotencyRepository.saveAndFlush(
                reservation(UUID.randomUUID().toString(), clientReportId, hash()));

        assertThrows(
                DataIntegrityViolationException.class,
                () -> idempotencyRepository.saveAndFlush(
                        reservation(UUID.randomUUID().toString(), clientReportId, hash())),
                "el clientReportId tambien debe ser unico, por si el cliente "
                        + "cambia solo la llave del encabezado");
    }

    @Test
    void keepsKeyReservedWhenAuthorDeletedTheReport() {
        Report report = reportRepository.saveAndFlush(validReport());
        String clientReportId = report.getClientReportId();

        ReportIdempotency reservation = reservation(
                UUID.randomUUID().toString(), clientReportId, hash());
        reservation.setReport(report);
        idempotencyRepository.saveAndFlush(reservation);

        reportRepository.delete(report);
        reportRepository.flush();
        entityManager.clear();

        ReportIdempotency afterDelete = idempotencyRepository
                .findByClientReportId(clientReportId)
                .orElseThrow();
        assertNull(afterDelete.getReport(),
                "la llave debe sobrevivir al borrado para que un reintento no "
                        + "recree el reporte");
        assertTrue(idempotencyRepository.existsByKey(reservation.getKey()),
                "el UUID queda consumido aunque el reporte ya no exista");
    }

    @Test
    void recordsTheOwnerAndTheFirstResponse() {
        String key = UUID.randomUUID().toString();

        ReportIdempotency reservation = reservation(key, UUID.randomUUID().toString(), hash());
        reservation.setUserId(42L);
        reservation.setResponseStatus(201);
        idempotencyRepository.saveAndFlush(reservation);

        ReportIdempotency found = idempotencyRepository.findByKey(key).orElseThrow();
        assertEquals(42L, found.getUserId());
        assertEquals(201, found.getResponseStatus());
    }

    @Test
    void returnsEmptyWhenKeyWasNeverUsed() {
        assertTrue(idempotencyRepository.findByKey(UUID.randomUUID().toString()).isEmpty());
        assertTrue(idempotencyRepository.findByClientReportId(UUID.randomUUID().toString()).isEmpty());
        assertFalse(idempotencyRepository.existsByKey(UUID.randomUUID().toString()));
    }

    private ReportIdempotency reservation(String key, String clientReportId, String hash) {
        ReportIdempotency reservation = new ReportIdempotency();
        reservation.setKey(key);
        reservation.setClientReportId(clientReportId);
        reservation.setPayloadHash(hash);
        return reservation;
    }

    private String hash() {
        return "a".repeat(64);
    }

    private Report validReport() {
        Report report = new Report();
        report.setClientReportId(UUID.randomUUID().toString());
        report.setEventAt(Instant.parse("2026-09-28T18:00:00Z"));
        report.setEventType("SIGHTING");
        report.setSeverity(Severity.LOW);
        report.setCertainty(Certainty.MEDIUM);
        report.setDogCount(2);
        report.setSize(DogSize.MEDIUM);
        report.setColor("cafe");
        report.setColorUndetermined(false);
        report.setCollar(CollarPresence.UNDETERMINED);
        report.setDescription(
                "Dos perros sin responsable aparente observados cerca del camino.");
        report.setLatitude(new BigDecimal("27.7500000"));
        report.setLongitude(new BigDecimal("-107.6330000"));
        report.setPolygonVersion("CREEL-2026-V1");
        report.setConsentAccepted(true);
        return report;
    }
}