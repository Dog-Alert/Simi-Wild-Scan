package com.equipo3.dogalert.report;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.equipo3.dogalert.evidence.ReportEvidence;
import com.equipo3.dogalert.exception.IdempotencyConflictException;
import com.equipo3.dogalert.exception.InvalidTokenSubjectException;
import com.equipo3.dogalert.exception.IdempotencyKeyTakenException;
import com.equipo3.dogalert.exception.InvalidPhotoException;
import com.equipo3.dogalert.exception.ReportDeletedException;
import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;

/**
 * Orquesta la creacion de reportes.
 *
 * <p>No lleva @Transactional a proposito. Las validaciones se ejecutan primero y
 * por separado para que un 422 no consuma la llave de idempotencia: si una
 * correccion del usuario cambia el payload, el hash deja de coincidir y el
 * reintento rightful debe recibir 409, no un falso conflicto de reintento.
 *
 * <p>La escritura va en ReportCreationTransaction. Si esa transaccion falla por
 * una llave ya tomada, se captura aqui, con la transaccion ya deshecha, y se
 * responde como reenvio.
 */
@Service
public class ReportService {
    private static final long MAX_REPORT_AGE_DAYS = 365;
    private static final String[] PHOTO_TYPES = { "image/jpeg", "image/png", "image/heic" };

    private final ReportRepository reportRepository;
    private final ReportIdempotencyRepository idempotencyRepository;
    private final ReportCreationTransaction creationTransaction;
    private final CreelBoundary creelBoundary;
    private final PayloadHasher payloadHasher;

    public ReportService(
            ReportRepository reportRepository,
            ReportIdempotencyRepository idempotencyRepository,
            ReportCreationTransaction creationTransaction,
            CreelBoundary creelBoundary,
            PayloadHasher payloadHasher) {
        this.reportRepository = reportRepository;
        this.idempotencyRepository = idempotencyRepository;
        this.creationTransaction = creationTransaction;
        this.creelBoundary = creelBoundary;
        this.payloadHasher = payloadHasher;
    }

    public ReportReceipt create(
            ReportCreateRequest request,
            MultipartFile photo,
            Authentication authentication,
            UUID idempotencyKey) {
        UUID key = resolveKey(request, idempotencyKey);

        PhotoContent photoContent = readPhoto(photo);
        validateDate(request.eventAt());
        requireInsideCreel(request.location().latitude(), request.location().longitude());

        String payloadHash = payloadHasher.hash(request, photoContent.bytes());
        Long userId = userId(authentication);
        Report draft = draft(request, photoContent);

        try {
            return creationTransaction.submit(key, draft, userId, payloadHash);
        } catch (IdempotencyKeyTakenException taken) {
            return replay(key, request, userId, payloadHash);
        }
    }

    /**
     * Respuesta a una llave ya reservada: 200 con el recurso existente, 409 si el
     * contenido o la identidad no coinciden, 410 si el autor elimino el reporte.
     */
    private ReportReceipt replay(
            UUID key,
            ReportCreateRequest request,
            Long userId,
            String payloadHash) {
        String clientReportId = request.clientReportId().toString();

        ReportIdempotency reservation = idempotencyRepository.findByKey(key.toString())
                .or(() -> idempotencyRepository.findByClientReportId(clientReportId))
                .orElse(null);

        if (reservation != null) {
            if (!Objects.equals(reservation.getPayloadHash(), payloadHash)) {
                throw new IdempotencyConflictException(
                        "La llave de idempotencia ya se uso con un contenido distinto");
            }
            if (!Objects.equals(reservation.getUserId(), userId)) {
                // La seccion 6.4.7 del SDD prohibe degradar en silencio a anonimo
                // un reporte creado como registrado.
                throw new IdempotencyConflictException(
                        "La llave de idempotencia ya se uso desde otra identidad");
            }
        }

        return reportRepository.findByClientReportId(clientReportId)
                .map(existing -> receipt(existing, true))
                .orElseThrow(() -> new ReportDeletedException());
    }

    private UUID resolveKey(ReportCreateRequest request, UUID idempotencyKey) {
        if (request.clientReportId() == null) {
            throw new IllegalArgumentException("clientReportId es obligatorio");
        }
        if (idempotencyKey != null && !idempotencyKey.equals(request.clientReportId())) {
            throw new IllegalArgumentException("Idempotency-Key debe coincidir con clientReportId");
        }
        return request.clientReportId();
    }

    private void validateDate(Instant eventAt) {
        Instant now = Instant.now();
        if (eventAt.isAfter(now.plus(5, ChronoUnit.MINUTES))
                || eventAt.isBefore(now.minus(MAX_REPORT_AGE_DAYS, ChronoUnit.DAYS))) {
            throw new IllegalArgumentException("La fecha del evento debe estar dentro del último año y no ser futura");
        }
    }

    private void requireInsideCreel(double latitude, double longitude) {
        if (!creelBoundary.contains(latitude, longitude)) {
            throw new ReportLocationOutsideException();
        }
    }

    /**
     * Lee y valida la foto una sola vez. Devolver los bytes y su tipo real permite
     * hashear el contenido sin releer el archivo, y evita construir la entidad
     * antes de saber si la evidencia es valida.
     */
    private PhotoContent readPhoto(MultipartFile photo) {
        if (photo == null || photo.isEmpty()) {
            return PhotoContent.none();
        }
        String contentType = photo.getContentType();
        if (photo.getSize() > ReportEvidence.MAX_PHOTO_BYTES
                || Arrays.stream(PHOTO_TYPES).noneMatch(type -> type.equalsIgnoreCase(contentType))) {
            throw new InvalidPhotoException("La foto debe ser JPEG, PNG o HEIC y no superar 1 MB");
        }
        try {
            return new PhotoContent(photo.getBytes(), contentType.toLowerCase());
        } catch (IOException exception) {
            throw new InvalidPhotoException("No se pudo leer la foto");
        }
    }

    private Report draft(ReportCreateRequest request, PhotoContent photoContent) {
        Report report = new Report();
        report.setClientReportId(request.clientReportId().toString());
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
        report.setConsentAccepted(request.consentAccepted());
        if (photoContent.bytes() != null) {
            report.attachEvidence(evidence(photoContent));
        }
        report.setStatus(ReportStatus.PENDING);
        return report;
    }

    private ReportEvidence evidence(PhotoContent photoContent) {
        ReportEvidence evidence = new ReportEvidence();
        evidence.setPhoto(photoContent.bytes());
        evidence.setMimeType(photoContent.mimeType());
        evidence.setSha256(payloadHasher.sha256(photoContent.bytes()));
        return evidence;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Valor inválido para " + field + ": " + value);
        }
    }

    /**
 * Identidad del autor segun el contrato de tokens: el claim sub contiene el
 * ID_Usuario que emite JwtService. Un token sin sub utilizable es un token
 * invalido y no debe degradarse a reporte anonimo.
 */
private Long userId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return null;
        }
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new InvalidTokenSubjectException();
        }
        try {
            return Long.valueOf(subject.trim());
        } catch (NumberFormatException exception) {
            throw new InvalidTokenSubjectException();
        }
    }

    private ReportReceipt receipt(Report report, boolean replayed) {
        return new ReportReceipt(
                report.getId(),
                UUID.fromString(report.getClientReportId()),
                report.getStatus(),
                replayed);
    }

    /** Bytes de la foto y su tipo MIME declarado, ya validados. */
    private record PhotoContent(byte[] bytes, String mimeType) {
        static PhotoContent none() {
            return new PhotoContent(null, null);
        }
    }
}