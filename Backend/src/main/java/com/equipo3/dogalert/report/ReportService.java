package com.equipo3.dogalert.report;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.equipo3.dogalert.exception.InvalidPhotoException;
import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;

@Service
public class ReportService {
    private static final long MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    private static final long MAX_REPORT_AGE_DAYS = 365;
    private static final String[] PHOTO_TYPES = { "image/jpeg", "image/png", "image/webp" };

    private final ReportRepository reportRepository;
    private final CreelBoundary creelBoundary;

    public ReportService(ReportRepository reportRepository, CreelBoundary creelBoundary) {
        this.reportRepository = reportRepository;
        this.creelBoundary = creelBoundary;
    }

    @Transactional
    public ReportReceipt create(
            ReportCreateRequest request,
            MultipartFile photo,
            Authentication authentication,
            UUID idempotencyKey) {
        if (request.clientReportId() == null || !request.clientReportId().equals(idempotencyKey)) {
            throw new IllegalArgumentException("Idempotency-Key debe coincidir con clientReportId");
        }

        var existing = reportRepository.findByClientReportId(request.clientReportId());
        if (existing.isPresent()) return receipt(existing.get(), true);

        validateDate(request.eventAt());
        validatePhoto(photo);
        if (!creelBoundary.contains(request.location().latitude(), request.location().longitude())) {
            throw new ReportLocationOutsideException();
        }

        Report report = new Report();
        report.setClientReportId(request.clientReportId());
        report.setUserId(userId(authentication));
        report.setEventAt(request.eventAt());
        report.setEventType(request.eventType());
        report.setSeverity(request.severity());
        report.setCertainty(request.certainty());
        report.setDogCount(request.dogCount());
        report.setSize(request.size());
        report.setColor(request.color());
        report.setColorUndetermined(request.colorUndetermined());
        report.setCollar(request.collar());
        report.setDescription(request.description().trim());
        report.setLatitude(request.location().latitude());
        report.setLongitude(request.location().longitude());
        report.setBoundaryVersion(creelBoundary.version());
        report.setHasPhoto(photo != null && !photo.isEmpty());
        report.setConsentAccepted(request.consentAccepted());
        report.setStatus(ReportStatus.PENDING);
        return receipt(reportRepository.save(report), false);
    }

    private void validateDate(Instant eventAt) {
        Instant now = Instant.now();
        if (eventAt.isAfter(now.plus(5, ChronoUnit.MINUTES))
                || eventAt.isBefore(now.minus(MAX_REPORT_AGE_DAYS, ChronoUnit.DAYS))) {
            throw new IllegalArgumentException("La fecha del evento debe estar dentro del último año y no ser futura");
        }
    }

    private void validatePhoto(MultipartFile photo) {
        if (photo == null || photo.isEmpty()) return;
        if (photo.getSize() > MAX_PHOTO_BYTES
                || java.util.Arrays.stream(PHOTO_TYPES).noneMatch(type -> type.equalsIgnoreCase(photo.getContentType()))) {
            throw new InvalidPhotoException("La foto debe ser JPEG, PNG o WEBP y no superar 5 MB");
        }
    }

    private Long userId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Jwt jwt)) return null;
        return Long.valueOf(jwt.getSubject());
    }

    private ReportReceipt receipt(Report report, boolean replayed) {
        return new ReportReceipt(report.getId(), report.getClientReportId(), report.getStatus(), replayed);
    }
}