package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.report.dto.CoordinateRequest;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.user.UserRepository;

@ExtendWith(MockitoExtension.class)
class ReportServiceTests {
    @Mock private ReportRepository reportRepository;
    @Mock private UserRepository userRepository;
    private ReportService reportService;

    @BeforeEach
    void setUp() {
        reportService = new ReportService(
                reportRepository,
                userRepository,
                new CreelBoundary("creel-test", "27.72,-107.68;27.72,-107.54;27.84,-107.54;27.84,-107.68"));
    }

    @Test
    void validAnonymousReportIsStoredAsPendingWithoutExactLocationInReceipt() {
        UUID id = UUID.randomUUID();
        when(reportRepository.findByClientReportId(id.toString())).thenReturn(Optional.empty());
        when(reportRepository.save(any(Report.class))).thenAnswer(invocation -> {
            Report report = invocation.getArgument(0);
            report.setId(42L);
            return report;
        });

        var receipt = reportService.create(validRequest(id), null, null, id);

        assertEquals(ReportStatus.PENDING, receipt.status());
        assertEquals(42L, receipt.id());
        verify(reportRepository).save(any(Report.class));
    }

    @Test
    void externalLocationIsRejectedBeforePersistence() {
        UUID id = UUID.randomUUID();
        when(reportRepository.findByClientReportId(id.toString())).thenReturn(Optional.empty());
        ReportCreateRequest request = new ReportCreateRequest(
                id, Instant.now().minusSeconds(3600), "SIGHTING", "LOW", "HIGH", 1,
                "MEDIUM", null, true, "NO", "DescripciÃ³n suficientemente larga para validar el reporte",
                new CoordinateRequest(28.0, -107.60), true);

        assertThrows(ReportLocationOutsideException.class,
                () -> reportService.create(request, null, null, id));
        verify(reportRepository, never()).save(any(Report.class));
    }

    @Test
    void repeatedIdempotencyKeyDoesNotPersistAgain() {
        UUID id = UUID.randomUUID();
        Report existing = new Report();
        existing.setId(7L);
        existing.setClientReportId(id.toString());
        existing.setStatus(ReportStatus.PENDING);
        when(reportRepository.findByClientReportId(id.toString())).thenReturn(Optional.of(existing));

        var receipt = reportService.create(validRequest(id), null, null, id);

        assertEquals(7L, receipt.id());
        assertEquals(true, receipt.replayed());
        verify(reportRepository, never()).save(any(Report.class));
    }

    private ReportCreateRequest validRequest(UUID id) {
        return new ReportCreateRequest(
                id, Instant.now().minusSeconds(3600), "SIGHTING", "LOW", "HIGH", 1,
                "MEDIUM", null, true, "NO", "DescripciÃ³n suficientemente larga para validar el reporte",
                new CoordinateRequest(27.78, -107.60), true);
    }
}