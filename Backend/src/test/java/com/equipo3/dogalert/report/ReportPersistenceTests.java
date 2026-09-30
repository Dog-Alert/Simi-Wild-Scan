package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import com.equipo3.dogalert.evidence.ReportEvidence;
import com.equipo3.dogalert.evidence.ReportEvidenceRepository;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

import jakarta.validation.ConstraintViolationException;

@DataJpaTest
@ActiveProfiles("test")
class ReportPersistenceTests {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReportEvidenceRepository evidenceRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void savesAnonymousReportWithoutUser() {
        Report savedReport = reportRepository.saveAndFlush(validReport());

        assertTrue(savedReport.getId() > 0);
        assertNull(savedReport.getUser());
        assertFalse(savedReport.hasPhoto());
        assertEquals(ReportStatus.PENDING, savedReport.getStatus());
    }

    @Test
    void savesReportAssociatedWithRegisteredUser() {
        User user = userRepository.saveAndFlush(validUser());
        Report report = validReport();
        report.setUser(user);

        Report savedReport = reportRepository.saveAndFlush(report);

        assertEquals(user.getId(), savedReport.getUser().getId());
    }

    @Test
    void rejectsDuplicatedClientReportId() {
        Report firstReport = validReport();
        reportRepository.saveAndFlush(firstReport);

        Report duplicatedReport = validReport();
        duplicatedReport.setClientReportId(firstReport.getClientReportId());

        assertThrows(
                DataIntegrityViolationException.class,
                () -> reportRepository.saveAndFlush(duplicatedReport));
    }

    @Test
    void rejectsCoordinatesOutsideWorldBounds() {
        Report report = validReport();
        report.setLatitude(new BigDecimal("91.0000000"));

        assertThrows(
                ConstraintViolationException.class,
                () -> reportRepository.saveAndFlush(report));
    }

    @Test
    void persistsEvidenceAndDeletesItWithReport() throws Exception {
        Report report = validReport();
        ReportEvidence evidence = validEvidence();
        report.attachEvidence(evidence);

        Report savedReport = reportRepository.saveAndFlush(report);
        Long reportId = savedReport.getId();
        Long evidenceId = savedReport.getEvidence().getId();

        assertTrue(savedReport.hasPhoto());
        assertTrue(evidenceRepository.existsByReportId(reportId));

        reportRepository.delete(savedReport);
        reportRepository.flush();

        assertFalse(evidenceRepository.existsById(evidenceId));
    }

    @Test
    void rejectsEvidenceLargerThanOneMegabyte() throws Exception {
        Report report = validReport();
        ReportEvidence evidence = validEvidence();
        evidence.setPhoto(new byte[ReportEvidence.MAX_PHOTO_BYTES + 1]);
        report.attachEvidence(evidence);

        assertThrows(
                ConstraintViolationException.class,
                () -> reportRepository.saveAndFlush(report));
    }

    @Test
    void findsReportsByStatus() {
        reportRepository.saveAndFlush(validReport());

        assertEquals(
                1,
                reportRepository
                        .findByStatusOrderByEventAtDesc(ReportStatus.PENDING)
                        .size());
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

    private ReportEvidence validEvidence() throws Exception {
        byte[] photo = "contenido-fotografia".getBytes();
        ReportEvidence evidence = new ReportEvidence();
        evidence.setPhoto(photo);
        evidence.setMimeType("image/jpeg");
        evidence.setSha256(
                MessageDigest.getInstance("SHA-256").digest(photo));
        evidence.setMetadataConsistent(true);
        return evidence;
    }

    private User validUser() {
        User user = new User();
        user.setName("Usuario de prueba");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash-seguro-de-prueba");
        user.setRole(Role.USUARIO);
        user.setAdultConfirmed(true);
        user.setPrivacyAccepted(true);
        user.setContactAuthorized(false);
        user.setDataAnonymized(false);
        user.setAccountStatus(AccountStatus.ACTIVA);
        return user;
    }
}
