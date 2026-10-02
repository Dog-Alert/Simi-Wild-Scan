package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.equipo3.dogalert.exception.IdempotencyConflictException;
import com.equipo3.dogalert.exception.IdempotencyKeyTakenException;
import com.equipo3.dogalert.exception.InvalidTokenSubjectException;
import com.equipo3.dogalert.exception.ReportDeletedException;
import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.report.dto.CoordinateRequest;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;

@ExtendWith(MockitoExtension.class)
class ReportServiceTests {
    private static final String DESCRIPCION =
            "Descripción suficientemente larga para validar el reporte";

    @Mock private ReportRepository reportRepository;
    @Mock private ReportIdempotencyRepository idempotencyRepository;
    @Mock private ReportCreationTransaction creationTransaction;

    private PayloadHasher payloadHasher;
    private ReportService reportService;

    @BeforeEach
    void setUp() {
        payloadHasher = new PayloadHasher();
        reportService = new ReportService(
                reportRepository,
                idempotencyRepository,
                creationTransaction,
                new CreelBoundary(
                        "creel-test",
                        "27.72,-107.68;27.72,-107.54;27.84,-107.54;27.84,-107.68"),
                payloadHasher);
    }

    @Test
    void firstSubmissionIsDelegatedToTheTransactionAndIsNotReplayed() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), isNull(), anyString()))
                .thenReturn(new ReportReceipt(42L, id, ReportStatus.PENDING, false));

        ReportReceipt receipt = reportService.create(request, null, null, id);

        assertEquals(42L, receipt.id());
        assertFalse(receipt.replayed());
    }

    @Test
    void validationHappensBeforeAnyReservationSoA422DoesNotBurnTheKey() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = new ReportCreateRequest(
                id, Instant.now().minusSeconds(3600), "SIGHTING", "LOW", "HIGH", 1,
                "MEDIUM", null, true, "NO", DESCRIPCION,
                new CoordinateRequest(28.0, -107.60), true);

        assertThrows(ReportLocationOutsideException.class,
                () -> reportService.create(request, null, null, id));

        verify(creationTransaction, never())
                .submit(any(), any(Report.class), any(), anyString());
    }

    @Test
    void mismatchingIdempotencyKeyHeaderIsRejected() {
        UUID clientReportId = UUID.randomUUID();

        assertThrows(IllegalArgumentException.class,
                () -> reportService.create(
                        validRequest(clientReportId), null, null, UUID.randomUUID()));

        verify(creationTransaction, never())
                .submit(any(), any(Report.class), any(), anyString());
    }

    @Test
    void takenKeyWithSamePayloadReturnsTheExistingReport() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), isNull(), anyString()))
                .thenThrow(new IdempotencyKeyTakenException());
        when(idempotencyRepository.findByKey(id.toString()))
                .thenReturn(Optional.of(reservation(id, hashOf(request), null)));
        when(reportRepository.findByClientReportId(id.toString()))
                .thenReturn(Optional.of(existingReport(id)));

        ReportReceipt receipt = reportService.create(request, null, null, id);

        assertEquals(7L, receipt.id());
        assertTrue(receipt.replayed());
    }

    @Test
    void takenKeyWithDifferentPayloadIsAConflict() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), isNull(), anyString()))
                .thenThrow(new IdempotencyKeyTakenException());
        when(idempotencyRepository.findByKey(id.toString()))
                .thenReturn(Optional.of(reservation(id, "a".repeat(64), null)));

        assertThrows(IdempotencyConflictException.class,
                () -> reportService.create(request, null, null, id));
    }

    @Test
    void takenKeyFromAnotherIdentityIsAConflict() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), anyLong(), anyString()))
                .thenThrow(new IdempotencyKeyTakenException());
        when(idempotencyRepository.findByKey(id.toString()))
                .thenReturn(Optional.of(reservation(id, hashOf(request), 99L)));

        assertThrows(IdempotencyConflictException.class,
                () -> reportService.create(request, null, authenticatedUser(100L), id),
                "la misma llave desde otra identidad es un conflicto");
    }

    @Test
    void anonymousRetryOfAnAuthenticatedReportIsAConflict() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), isNull(), anyString()))
                .thenThrow(new IdempotencyKeyTakenException());
        when(idempotencyRepository.findByKey(id.toString()))
                .thenReturn(Optional.of(reservation(id, hashOf(request), 7L)));

        assertThrows(IdempotencyConflictException.class,
                () -> reportService.create(request, null, null, id),
                "un reporte creado como registrado no puede degradarse a anonimo");
    }

    @Test
    void takenKeyWithoutReportMeansTheAuthorDeletedIt() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);
        when(creationTransaction.submit(eq(id), any(Report.class), isNull(), anyString()))
                .thenThrow(new IdempotencyKeyTakenException());
        when(idempotencyRepository.findByKey(id.toString()))
                .thenReturn(Optional.of(reservation(id, hashOf(request), null)));
        when(reportRepository.findByClientReportId(id.toString()))
                .thenReturn(Optional.empty());

        assertThrows(ReportDeletedException.class,
                () -> reportService.create(request, null, null, id));
    }

    @Test
    void tokenWithoutUsableSubjectIsRejectedInsteadOfBeingAnonymous() {
        UUID id = UUID.randomUUID();

        assertThrows(InvalidTokenSubjectException.class,
                () -> reportService.create(
                        validRequest(id), null, authenticatedUser("no-es-un-id"), id));
    }

    @Test
    void hashIsStableAcrossTwoIdenticalRequests() {
        UUID id = UUID.randomUUID();
        Instant eventAt = Instant.now().minusSeconds(3600);

        String first = payloadHasher.hash(request(id, "LOW", eventAt), null);
        String second = payloadHasher.hash(request(id, "LOW", eventAt), null);

        assertEquals(first, second);
        assertEquals(64, first.length());
    }

    @Test
    void hashChangesWhenAFieldChanges() {
        UUID id = UUID.randomUUID();
        Instant eventAt = Instant.now().minusSeconds(3600);

        String baseline = payloadHasher.hash(request(id, "LOW", eventAt), null);
        String changed = payloadHasher.hash(request(id, "HIGH", eventAt), null);

        assertNotEquals(baseline, changed);
    }

    @Test
    void hashChangesWhenThePhotoChanges() {
        UUID id = UUID.randomUUID();
        ReportCreateRequest request = validRequest(id);

        assertNotEquals(
                payloadHasher.hash(request, null),
                payloadHasher.hash(request, "contenido-fotografia".getBytes()));
    }

    private ReportCreateRequest validRequest(UUID id) {
        return request(id, "LOW", Instant.now().minusSeconds(3600));
    }

    private ReportCreateRequest request(UUID id, String severity, Instant eventAt) {
        return new ReportCreateRequest(
                id, eventAt, "SIGHTING", severity, "HIGH", 1,
                "MEDIUM", null, true, "NO", DESCRIPCION,
                new CoordinateRequest(27.78, -107.60), true);
    }

    private String hashOf(ReportCreateRequest request) {
        return payloadHasher.hash(request, null);
    }

    private ReportIdempotency reservation(UUID id, String hash, Long userId) {
        ReportIdempotency reservation = new ReportIdempotency();
        reservation.setKey(id.toString());
        reservation.setClientReportId(id.toString());
        reservation.setPayloadHash(hash);
        reservation.setUserId(userId);
        return reservation;
    }

    private Report existingReport(UUID id) {
        Report report = new Report();
        report.setId(7L);
        report.setClientReportId(id.toString());
        report.setStatus(ReportStatus.PENDING);
        return report;
    }

    /**
     * Usa el mismo tipo de token que produce oauth2ResourceServer en produccion,
     * porque JwtAuthenticationToken marca la autenticacion como verdadera.
     */
    private Authentication authenticatedUser(String subject) {
        Jwt jwt = Jwt.withTokenValue("token-de-prueba")
                .header("alg", "HS256")
                .subject(subject)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        return new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority("ROLE_USUARIO")));
    }

    private Authentication authenticatedUser(Long userId) {
        return authenticatedUser(String.valueOf(userId));
    }
}