package com.equipo3.dogalert.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.equipo3.dogalert.auth.JwtService;
import com.equipo3.dogalert.evidence.ReportEvidenceRepository;
import com.equipo3.dogalert.report.dto.CoordinateRequest;
import com.equipo3.dogalert.report.dto.ReportUpdateRequest;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Reportes propios: propiedad, edicion y borrado. Seccion 4.5 del SDD.
 *
 * <p>No lleva @Transactional porque el borrado necesita confirmarse en la base y
 * el reintento del POST depende de que la transaccion previa ya haya terminado.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MyReportsOwnershipTests {

    private static final double INSIDE_LAT = 27.78;
    private static final double INSIDE_LON = -107.60;
    private static final double OUTSIDE_LAT = 28.90;
    private static final double OUTSIDE_LON = -107.10;
    private static final String DESCRIPCION =
            "Perro sin correa observado en el camino de acceso al parque.";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private ReportEvidenceRepository evidenceRepository;
    @Autowired private JwtService jwtService;
    @Autowired private ObjectMapper objectMapper;

    private User author;
    private String authorToken;

    @BeforeEach
    void setUp() {
        author = newUser(Role.USUARIO);
        authorToken = token(author);
    }

    @Test
    void listaUnicamenteLosReportesDelUsuario() throws Exception {
        post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null);
        post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null);

        User stranger = newUser(Role.USUARIO);
        post(stranger, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null);

        mockMvc.perform(get("/v1/me/reports").header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
    }

    @Test
    void paginaDelMasRecienteAlMasAntiguoSinRepetirNiSaltar() throws Exception {
        // Se insertan direto porque por HTTP serian 21 peticiones lentas; lo que
        // se prueba es la paginacion, no el endpoint de creacion.
        List<Instant> instants = new ArrayList<>();
        for (int index = 0; index < 21; index++) {
            Instant eventAt = Instant.parse("2026-01-01T00:00:00Z").plus(index, ChronoUnit.HOURS);
            instants.add(eventAt);
            reportRepository.saveAndFlush(validReport(author, eventAt));
        }

        MvcResult first = mockMvc
                .perform(get("/v1/me/reports").header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(20))
                .andReturn();

        JsonNode firstPage = objectMapper.readTree(first.getResponse().getContentAsString());
        assertThat(firstPage.get("items").get(0).get("eventAt").asText())
                .as("la primera pagina arranca en el reporte mas reciente")
                .isEqualTo(instants.get(20).toString());
        String nextCursor = firstPage.get("nextCursor").asText();

        MvcResult second = mockMvc
                .perform(get("/v1/me/reports")
                        .param("cursor", nextCursor)
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.nextCursor").doesNotExist())
                .andReturn();

        JsonNode secondPage = objectMapper.readTree(second.getResponse().getContentAsString());

        List<String> firstIds = ids(firstPage);
        List<String> secondIds = ids(secondPage);

        assertThat(firstIds).doesNotContainAnyElementsOf(secondIds);
        assertThat(firstPage.get("items").get(19).get("eventAt").asText())
                .isEqualTo(instants.get(1).toString());
        assertThat(secondPage.get("items").get(0).get("eventAt").asText())
                .isEqualTo(instants.get(0).toString());
    }

    @Test
    void cursorInvalidoResponde400() throws Exception {
        mockMvc.perform(get("/v1/me/reports")
                        .param("cursor", "no-es-un-cursor")
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("BAD_REQUEST"));
    }

    @Test
    void sinTokenResponde401() throws Exception {
        mockMvc.perform(get("/v1/me/reports")).andExpect(status().isUnauthorized());
    }

    @Test
    void reporteAjenoEInexistenteDevuelvenElMismo404() throws Exception {
        User stranger = newUser(Role.USUARIO);
        long ajeno = idOf(post(stranger, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));

        MvcResult ajenoResponse = mockMvc
                .perform(get("/v1/me/reports/" + ajeno).header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound())
                .andReturn();

        MvcResult inexistenteResponse = mockMvc
                .perform(get("/v1/me/reports/999999").header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound())
                .andReturn();

        assertThat(errorCode(ajenoResponse))
                .as("responder 403 confirmaria que el reporte ajeno existe")
                .isEqualTo(errorCode(inexistenteResponse));
        assertThat(errorMessage(ajenoResponse))
                .as("ambos casos deben ser indistinguibles para el cliente")
                .isEqualTo(errorMessage(inexistenteResponse))
                .isEqualTo("El reporte no existe");
        assertThat(errorCode(ajenoResponse)).isEqualTo("REPORT_NOT_FOUND");
    }

    @Test
    void administradorRecibe404SobreUnReporteAjeno() throws Exception {
        User admin = newUser(Role.ADMIN);
        long ajeno = idOf(post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));

        mockMvc.perform(get("/v1/me/reports/" + ajeno).header(HttpHeaders.AUTHORIZATION, token(admin)))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/v1/me/reports/" + ajeno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(DESCRIPCION, INSIDE_LAT, INSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, token(admin)))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/v1/me/reports/" + ajeno)
                        .header(HttpHeaders.AUTHORIZATION, token(admin)))
                .andExpect(status().isNotFound());
    }

    @Test
    void editarUnVerificadoLoRegresaAPending() throws Exception {
        long id = idOf(post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));
        setStatus(id, ReportStatus.VERIFIED);

        mockMvc.perform(patch("/v1/me/reports/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("Descripcion corregida por el autor del reporte.", INSIDE_LAT, INSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.description")
                        .value("Descripcion corregida por el autor del reporte."))
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void editarUnRechazadoResponde409() throws Exception {
        long id = idOf(post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));
        setStatus(id, ReportStatus.REJECTED);

        mockMvc.perform(patch("/v1/me/reports/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(DESCRIPCION, INSIDE_LAT, INSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("REPORT_NOT_EDITABLE"));
    }

    @Test
    void editarFueraDeCreelResponde422YNoModificaElReporte() throws Exception {
        long id = idOf(post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));
        setStatus(id, ReportStatus.VERIFIED);

        mockMvc.perform(patch("/v1/me/reports/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody("Intento de mover el reporte fuera del Creel.", OUTSIDE_LAT, OUTSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("LOCATION_OUTSIDE_CREEL"));

        mockMvc.perform(get("/v1/me/reports/" + id).header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VERIFIED"))
                .andExpect(jsonPath("$.description").value(DESCRIPCION));
    }

    @Test
    void editarUnReporteAjenoResponde404() throws Exception {
        User stranger = newUser(Role.USUARIO);
        long ajeno = idOf(post(stranger, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));

        mockMvc.perform(patch("/v1/me/reports/" + ajeno)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(DESCRIPCION, INSIDE_LAT, INSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound());

        assertThat(reportRepository.findById(ajeno)).isPresent();
    }

    @Test
    void borrarEliminaElReporteYSuEvidencia() throws Exception {
        long id = idOf(post(author, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, photo()));

        assertThat(evidenceRepository.existsByReportId(id)).isTrue();

        mockMvc.perform(delete("/v1/me/reports/" + id)
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNoContent());

        assertThat(reportRepository.findById(id)).isEmpty();
        assertThat(evidenceRepository.existsByReportId(id)).isFalse();
    }

    @Test
    void trasBorrarElReintentoDelPostDevuelve410() throws Exception {
        UUID clientReportId = UUID.randomUUID();
        long id = idOf(post(author, clientReportId, DESCRIPCION, INSIDE_LAT, INSIDE_LON, photo()));

        mockMvc.perform(delete("/v1/me/reports/" + id)
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(multipart("/v1/reports")
                        .file(payloadPart(clientReportId, DESCRIPCION, INSIDE_LAT, INSIDE_LON))
                        .file(photo())
                        .header("Idempotency-Key", clientReportId.toString())
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.error.code").value("REPORT_DELETED"));

        assertThat(reportRepository.findByClientReportId(clientReportId.toString())).isEmpty();
    }

    @Test
    void unReporteAnonimoNoEsAdministrablePorNadie() throws Exception {
        long anonimo = idOf(post(null, UUID.randomUUID(), DESCRIPCION, INSIDE_LAT, INSIDE_LON, null));

        assertThat(reportRepository.findById(anonimo).orElseThrow().getUser()).isNull();

        mockMvc.perform(get("/v1/me/reports/" + anonimo).header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/v1/me/reports/" + anonimo)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(DESCRIPCION, INSIDE_LAT, INSIDE_LON))
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/v1/me/reports/" + anonimo)
                        .header(HttpHeaders.AUTHORIZATION, authorToken))
                .andExpect(status().isNotFound());

        assertThat(reportRepository.findById(anonimo)).isPresent();
    }

    private MvcResult post(
            User owner, UUID clientReportId, String description, double latitude, double longitude,
            MockMultipartFile photo) throws Exception {
        var request = mockMvc.perform(multipart("/v1/reports")
                        .file(payloadPart(clientReportId, description, latitude, longitude))
                        .file(photo == null ? new MockMultipartFile("photo", new byte[0]) : photo)
                        .header("Idempotency-Key", clientReportId.toString())
                        .header(HttpHeaders.AUTHORIZATION, owner == null ? "" : token(owner)))
                .andExpect(status().isCreated())
                .andReturn();
        return request;
    }

    private long idOf(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private String errorCode(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("error").get("code").asText();
    }

    private String errorMessage(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("error").get("message").asText();
    }

    private List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("id").asText()));
        return ids;
    }

    private void setStatus(long reportId, ReportStatus status) {
        Report report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(status);
        reportRepository.saveAndFlush(report);
    }

    private String updateBody(String description, double latitude, double longitude) {
        try {
            return objectMapper.writeValueAsString(new ReportUpdateRequest(
                    Instant.now().minusSeconds(3600), "SIGHTING", "LOW", "HIGH", 1,
                    "MEDIUM", "cafe", false, "NO", description,
                    new CoordinateRequest(latitude, longitude)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo construir el cuerpo de prueba", exception);
        }
    }

    private MockMultipartFile payloadPart(
            UUID clientReportId, String description, double latitude, double longitude) {
        String json = """
                {
                  "clientReportId": "%s",
                  "eventAt": "%s",
                  "eventType": "SIGHTING",
                  "severity": "LOW",
                  "certainty": "HIGH",
                  "dogCount": 1,
                  "size": "MEDIUM",
                  "color": "cafe",
                  "colorUndetermined": false,
                  "collar": "NO",
                  "description": "%s",
                  "location": { "latitude": %s, "longitude": %s },
                  "consentAccepted": true
                }
                """
                .formatted(
                        clientReportId,
                        Instant.parse("2026-09-28T18:00:00Z"),
                        description,
                        latitude,
                        longitude);
        return new MockMultipartFile(
                "payload", "payload.json", "application/json",
                json.getBytes(StandardCharsets.UTF_8));
    }

    private MockMultipartFile photo() {
        return new MockMultipartFile(
                "photo", "foto.jpg", "image/jpeg", "bytes-de-la-fotografia".getBytes());
    }

    private Report validReport(User owner, Instant eventAt) {
        Report report = new Report();
        report.setClientReportId(UUID.randomUUID().toString());
        report.setUser(owner);
        report.setEventAt(eventAt);
        report.setEventType("SIGHTING");
        report.setSeverity(Severity.LOW);
        report.setCertainty(Certainty.HIGH);
        report.setDogCount(1);
        report.setSize(DogSize.MEDIUM);
        report.setColor("cafe");
        report.setColorUndetermined(false);
        report.setCollar(CollarPresence.NO);
        report.setDescription(DESCRIPCION);
        report.setLatitude(new BigDecimal("27.7800000"));
        report.setLongitude(new BigDecimal("-107.6000000"));
        report.setPolygonVersion("creel-2026-01");
        report.setConsentAccepted(true);
        report.setStatus(ReportStatus.PENDING);
        return report;
    }

    private String token(User user) {
        return "Bearer " + jwtService.generateToken(user).accessToken();
    }

    private User newUser(Role role) {
        User user = new User();
        user.setName("Usuario de prueba");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash-seguro-de-prueba");
        user.setRole(role);
        user.setAdultConfirmed(true);
        user.setPrivacyAccepted(true);
        user.setContactAuthorized(false);
        user.setDataAnonymized(false);
        user.setAccountStatus(AccountStatus.ACTIVA);
        return userRepository.saveAndFlush(user);
    }
}