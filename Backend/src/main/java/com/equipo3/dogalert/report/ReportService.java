package com.equipo3.dogalert.report;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.equipo3.dogalert.evidence.ReportEvidence;
import com.equipo3.dogalert.exception.IdempotencyConflictException;
import com.equipo3.dogalert.exception.InvalidTokenSubjectException;
import com.equipo3.dogalert.exception.IdempotencyKeyTakenException;
import com.equipo3.dogalert.exception.InvalidPhotoException;
import com.equipo3.dogalert.exception.ReportDeletedException;
import com.equipo3.dogalert.exception.ReportLocationOutsideException;
import com.equipo3.dogalert.exception.ReportNotFoundException;
import com.equipo3.dogalert.report.dto.OwnedReportPage;
import com.equipo3.dogalert.report.dto.OwnedReportResponse;
import com.equipo3.dogalert.report.dto.ReportCreateRequest;
import com.equipo3.dogalert.report.dto.ReportReceipt;
import com.equipo3.dogalert.report.dto.ReportUpdateRequest;

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

    /**
     * Tamano de pagina de GET /v1/me/reports. El SDD fija el cursor pero no el
     * tamano, asi que se toma 20 como el valor que no castiga al movil con
     * paginas enormes ni obliga atravelar en mas de una peticion.
     */
    private static final int PAGE_SIZE = 20;

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
        CreelEvaluation creel = requireInsideCreel(
                request.location().latitude(),
                request.location().longitude());

        String payloadHash = payloadHasher.hash(request, photoContent.bytes());
        Long userId = userId(authentication);
        Report draft = draft(request, photoContent, creel.polygonVersion());

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

    /**
     * Evalua el punto y devuelve la version del poligono que se uso, para que el
     * reporte quede sellado con la misma geometria que lo acepto.
     */
    private CreelEvaluation requireInsideCreel(double latitude, double longitude) {
        CreelEvaluation evaluation = creelBoundary.evaluate(latitude, longitude);

        if (!evaluation.inside()) {
            throw new ReportLocationOutsideException();
        }
        return evaluation;
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

    /**
     * Lista los reportes del autor, del mas reciente al mas antiguo.
     *
     * <p>No acepta filtros a proposito: el OpenAPI solo declara el cursor para esta
     * operacion, y filtrar por el autor ya lo hace el query.
     */
    @Transactional(readOnly = true)
    public OwnedReportPage listar(Authentication authentication, String cursor) {
        Long userId = requireUserId(authentication);

        ReportCursor position = (cursor == null || cursor.isBlank())
                ? null
                : ReportCursor.decode(cursor);

        List<Report> rows = reportRepository.findOwnPage(
                userId,
                position == null ? null : position.eventAt(),
                position == null ? null : position.reportId(),
                PageRequest.of(0, PAGE_SIZE + 1));

        boolean hasMore = rows.size() > PAGE_SIZE;
        List<Report> page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;

        return new OwnedReportPage(
                page.stream().map(OwnedReportResponse::from).toList(),
                hasMore ? ReportCursor.of(page.get(page.size() - 1)).encode() : null);
    }

    @Transactional(readOnly = true)
    public OwnedReportResponse detalle(Authentication authentication, Long reportId) {
        return OwnedReportResponse.from(findOwned(authentication, reportId));
    }

    /**
     * Edita un reporte propio y lo devuelve a PENDING.
     *
     * <p>La validacion completa ocurre antes de tocar la entidad: si el punto queda
     * fuera de Creel o la fecha es invalida, el reporte queda intacto y la
     * transaccion no llega a escribir.
     */
    @Transactional
    public OwnedReportResponse actualizar(
            Authentication authentication,
            Long reportId,
            ReportUpdateRequest request) {
        Report report = findOwned(authentication, reportId);

        validateDate(request.eventAt());
        CreelEvaluation creel = requireInsideCreel(
                request.location().latitude(),
                request.location().longitude());

        report.editByAuthor(new ReportEdit(
                request.eventAt(),
                request.eventType(),
                parse(Severity.class, request.severity(), "severity"),
                parse(Certainty.class, request.certainty(), "certainty"),
                request.dogCount(),
                parse(DogSize.class, request.size(), "size"),
                request.color(),
                request.colorUndetermined(),
                parse(CollarPresence.class, request.collar(), "collar"),
                request.description().trim(),
                BigDecimal.valueOf(request.location().latitude()),
                BigDecimal.valueOf(request.location().longitude()),
                creel.polygonVersion()));

        return OwnedReportResponse.from(reportRepository.saveAndFlush(report));
    }

    /**
     * Borrado fisico del reporte y de su evidencia.
     *
     * <p>La fila de idempotencia sobrevive con ID_Reporte en NULL, de modo que un
     * reintento del POST original recibe 410 y no vuelve a crear el reporte. Ver
     * DEC-007 y el requerimiento de idempotencia del contrato de base de datos.
     */
    @Transactional
    public void borrar(Authentication authentication, Long reportId) {
        Report report = findOwned(authentication, reportId);
        reportRepository.delete(report);
        reportRepository.flush();
    }

    /**
     * Localiza el reporte exigiendo que sea del autor. Un reporte ajeno y uno
     * inexistente son el mismo error a proposito: responder 403 confirmaria que el
     * reporte existe y permitiria enumerar los de otros autores.
     */
    private Report findOwned(Authentication authentication, Long reportId) {
        Long userId = requireUserId(authentication);
        return reportRepository.findByIdAndUser_Id(reportId, userId)
                .orElseThrow(ReportNotFoundException::new);
    }

    /**
     * /v1/me/** exige identidad, asi que un principal sin subject utilizable es un
     * token invalido y no un visitante sin sesion.
     */
    private Long requireUserId(Authentication authentication) {
        Long userId = userId(authentication);
        if (userId == null) {
            throw new InvalidTokenSubjectException();
        }
        return userId;
    }

    private Report draft(ReportCreateRequest request, PhotoContent photoContent, String polygonVersion) {
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
        report.setPolygonVersion(polygonVersion);
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