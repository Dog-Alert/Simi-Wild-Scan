package com.equipo3.dogalert.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.equipo3.dogalert.auth.JwtService;
import com.equipo3.dogalert.evidence.ReportEvidenceRepository;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Evidencia del criterio de aceptacion: la misma peticion dos veces deja una sola
 * fila en la base de datos. No se usa @Transactional en la prueba porque el
 * camino de replay depende de que la peticion perdedora haga rollback de su
 * propia transaccion; con una sola transaccion externa el marcador de rollback
 * contaminaria las lecturas posteriores.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReportSyncIdempotencyTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private ReportIdempotencyRepository idempotencyRepository;
    @Autowired private ReportEvidenceRepository evidenceRepository;
    @Autowired private JwtService jwtService;
    @Autowired private ObjectMapper objectMapper;

    private String authorization;

    @BeforeEach
    void setUp() {
        authorization = "Bearer " + jwtService.generateToken(newUser()).accessToken();
    }

    @Test
    void identicalRetryReturns200AndKeepsASingleReport() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        String key = clientReportId.toString();

        MvcResult first = submit(clientReportId, key, "LOW", photo()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.replayed").value(false))
                .andReturn();

        MvcResult second = submit(clientReportId, key, "LOW", photo())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.replayed").value(true))
                .andReturn();

        long firstId = reportId(first);
        assertThat(reportId(second)).isEqualTo(firstId);

        assertThat(reportsOf(clientReportId)).hasSize(1);
        assertThat(idempotencyRepository.findByKey(key)).isPresent();
        assertThat(evidenceRepository.existsByReportId(firstId)).isTrue();
    }

    @Test
    void sameKeyWithDifferentPayloadIsAConflict() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        String key = clientReportId.toString();

        submit(clientReportId, key, "LOW", photo()).andExpect(status().isCreated());

        submit(clientReportId, key, "HIGH", photo())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_CONFLICT"));

        assertThat(reportsOf(clientReportId)).hasSize(1);
    }

    @Test
    void sameKeyFromAnotherIdentityIsAConflict() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        String key = clientReportId.toString();

        submit(clientReportId, key, "LOW", photo()).andExpect(status().isCreated());

        mockMvc.perform(multipart("/v1/reports")
                        .file(payloadPart(clientReportId, "LOW"))
                        .file(photo())
                        .header("Idempotency-Key", key)
                        .header(HttpHeaders.AUTHORIZATION, authorizationOf(newUser())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("IDEMPOTENCY_CONFLICT"));

        assertThat(reportsOf(clientReportId)).hasSize(1);
    }

    @Test
    void retryAfterTheAuthorDeletedTheReportIsGone() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        String key = clientReportId.toString();

        long reportId = reportId(
                submit(clientReportId, key, "LOW", photo())
                        .andExpect(status().isCreated())
                        .andReturn());

        deleteReport(reportId);

        submit(clientReportId, key, "LOW", photo())
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.error.code").value("REPORT_DELETED"));

        assertThat(reportsOf(clientReportId)).isEmpty();
        assertThat(idempotencyRepository.findByKey(key))
                .as("la llave debe seguir consumida para no recrear el reporte")
                .isPresent();
    }

    @Test
    void storesThePhotoHashAsThirtyTwoRawBytes() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        String key = clientReportId.toString();
        byte[] content = photo().getBytes();

        long reportId = reportId(
                submit(clientReportId, key, "LOW", photo())
                        .andExpect(status().isCreated())
                        .andReturn());

        var evidence = evidenceRepository.findByReportId(reportId).orElseThrow();
        assertThat(evidence.getSha256()).hasSize(32)
                .isEqualTo(MessageDigest.getInstance("SHA-256").digest(content));
        assertThat(evidence.getMimeType()).isEqualTo("image/jpeg");
        assertThat(content).isNotEmpty();
    }

    @Test
    void rejectsAMismatchingIdempotencyKeyHeader() throws Exception {
        UUID clientReportId = UUID.randomUUID();

        submit(clientReportId, UUID.randomUUID().toString(), "LOW", photo())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("INVALID_REPORT"));

        assertThat(reportsOf(clientReportId)).isEmpty();
        assertThat(idempotencyRepository.findAll())
                .as("una llave rechazada no debe consumirse")
                .noneMatch(reservation -> clientReportId.toString()
                        .equals(reservation.getClientReportId()));
    }

    private org.springframework.test.web.servlet.ResultActions submit(
            UUID clientReportId, String key, String severity, MockMultipartFile photo)
            throws Exception {
        return mockMvc.perform(multipart("/v1/reports")
                .file(payloadPart(clientReportId, severity))
                .file(photo)
                .header("Idempotency-Key", key)
                .header(HttpHeaders.AUTHORIZATION, authorization));
    }

    private MockMultipartFile payloadPart(UUID clientReportId, String severity) {
        String json = """
                {
                  "clientReportId": "%s",
                  "eventAt": "%s",
                  "eventType": "SIGHTING",
                  "severity": "%s",
                  "certainty": "HIGH",
                  "dogCount": 1,
                  "size": "MEDIUM",
                  "color": "cafe",
                  "colorUndetermined": false,
                  "collar": "NO",
                  "description": "Perro sin correa observado en el camino de acceso al paraque.",
                  "location": { "latitude": 27.78, "longitude": -107.60 },
                  "consentAccepted": true
                }
                """
                .formatted(clientReportId, Instant.parse("2026-09-28T18:00:00Z"), severity);
        return new MockMultipartFile(
                "payload", "payload.json", "application/json",
                json.getBytes(StandardCharsets.UTF_8));
    }

    private MockMultipartFile photo() {
        return new MockMultipartFile(
                "photo", "foto.jpg", "image/jpeg", "bytes-de-la-fotografia".getBytes());
    }

    private long reportId(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("id").asLong();
    }

    private List<Report> reportsOf(UUID clientReportId) {
        return reportRepository.findAll().stream()
                .filter(report -> clientReportId.toString().equals(report.getClientReportId()))
                .toList();
    }

    /** deleteById ya es transaccional en SimpleJpaRepository. */
    void deleteReport(long reportId) {
        reportRepository.deleteById(reportId);
    }

    private String authorizationOf(User user) {
        return "Bearer " + jwtService.generateToken(user).accessToken();
    }

    private User newUser() {
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
        return userRepository.saveAndFlush(user);
    }
}