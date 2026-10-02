package com.equipo3.dogalert.report;

import java.io.IOException;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.equipo3.dogalert.evidence.ReportEvidence;
import com.equipo3.dogalert.exception.InvalidPhotoException;
import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

@Service
public class ReportService {
    private static final long MAX_PHOTO_BYTES = ReportEvidence.MAX_PHOTO_BYTES;
    private static final long MAX_REPORT_AGE_DAYS = 365;
    private static final String[] PHOTO_TYPES = { "image/jpeg", "image/png", "image/heic" };

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final CreelBoundary creelBoundary;

    public ReportService(
            ReportRepository reportRepository,
            UserRepository userRepository,
            CreelBoundary creelBoundary) {
        this.reportRepository = reportRepository;
        this.userRepository = userRepository;
        this.creelBoundary = creelBoundary;
    }

    @Transactional
    public ReportReceipt create(
            ReportCreateRequest request,
            MultipartFile photo,
            Authentication authentication,
            UUID idempotencyKey) {
        if (idempotencyKey == null) {
            idempotencyKey = request.clientReportId() != null ? request.clientReportId() : UUID.randomUUID();
        }
        if (request.clientReportId() == null || !request.clientReportId().equals(idempotencyKey)) {
            throw new IllegalArgumentException("Idempotency-Key debe coincidir con clientReportId");
        }

        var existing = reportRepository.findByClientReportId(request.clientReportId().toString());
        if (existing.isPresent()) return receipt(existing.get(), true);

        validateDate(request.eventAt());
        validatePhoto(photo);
        if (!creelBoundary.contains(request.location().latitude(), request.location().longitude())) {
            throw new ReportLocationOutsideException();
        }

        Report report = new Report();
        report.setClientReportId(request.clientReportId().toString());
        report.setUser(user(authentication));
        report.setEventAt(request.eventAt());
        report.setEventType(request.eventType());
        report.setSeverity(parse(Severity.class, request.severity(), "severity"));
        report.setCertainty(parse(Certainty.class, request.certainty(), "certainty"));
        report.setDogCount(request.dogCount());
        report.setSize(parse(DogSize.class, request.size(), "size"));
        report.setColor(request.color());
        report.setColorUndetermined(request.colorUndetermined());
        report.setCollar(parse(CollarPresence.class, request.collar(), "collar"));
        report.setDescription(request.description().trim());
        report.setLatitude(BigDecimal.valueOf(request.location().latitude()));
        report.setLongitude(BigDecimal.valueOf(request.location().longitude()));
        report.setPolygonVersion(creelBoundary.version());
        if (photo != null && !photo.isEmpty()) report.attachEvidence(evidence(photo));
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
            throw new InvalidPhotoException("La foto debe ser JPEG, PNG o HEIC y no superar 1 MB");
        }
    }

    private ReportEvidence evidence(MultipartFile photo) {
        try {
            byte[] bytes = photo.getBytes();
            ReportEvidence evidence = new ReportEvidence();
            evidence.setPhoto(bytes);
            evidence.setMimeType(photo.getContentType().toLowerCase());
            evidence.setSha256(MessageDigest.getInstance("SHA-256").digest(bytes));
            return evidence;
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new InvalidPhotoException("No se pudo leer la foto");
        }
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Valor inválido para " + field + ": " + value);
        }
    }

    private User user(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Jwt jwt)) return null;
        return userRepository.getReferenceById(Long.valueOf(jwt.getSubject()));
    }

    private ReportReceipt receipt(Report report, boolean replayed) {
        return new ReportReceipt(
                report.getId(), UUID.fromString(report.getClientReportId()), report.getStatus(), replayed);
    }
}
