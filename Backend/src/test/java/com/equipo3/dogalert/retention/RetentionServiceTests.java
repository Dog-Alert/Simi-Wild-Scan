package com.equipo3.dogalert.retention;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import com.equipo3.dogalert.auth.AuthService;
import com.equipo3.dogalert.auth.dto.LoginRequest;
import com.equipo3.dogalert.exception.InvalidCredentialsException;
import com.equipo3.dogalert.report.Certainty;
import com.equipo3.dogalert.report.CollarPresence;
import com.equipo3.dogalert.report.DogSize;
import com.equipo3.dogalert.report.Report;
import com.equipo3.dogalert.report.ReportRepository;
import com.equipo3.dogalert.report.ReportStatus;
import com.equipo3.dogalert.report.Severity;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

/**
 * Retencion: RF-044 del SRS. Datos personales tras 12 meses sin un inicio de
 * sesion exitoso.
 *
 * <p>No lleva @Transactional porque el servicio abre una transaccion por cuenta
 * para que un fallo aislado no revierta la tanda entera.
 */
@SpringBootTest
@ActiveProfiles("test")
class RetentionServiceTests {

    private static final Instant NOW = Instant.now();
    private static final String PASSWORD = "contrasena-de-prueba";

    @Autowired private RetentionService retentionService;
    @Autowired private UserRepository userRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AuthService authService;

    @Test
    void eliminaLosDatosPersonalesDeLaCuentaInactiva() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(13));
        user.setName("Rosalba Nunez");
        user.setPhone("6641234567");
        user.setContactAuthorized(true);
        String previousHash = user.getPasswordHash();

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(user.getId()).orElseThrow();

        assertThat(after.getName()).isNull();
        assertThat(after.getPhone()).isNull();
        assertThat(after.getEmail()).isEqualTo("anonimizado+" + user.getId() + "@dogalert.invalid");
        assertThat(after.getPasswordHash()).isNotEqualTo(previousHash);
        assertThat(passwordEncoder.matches(PASSWORD, after.getPasswordHash()))
                .as("el hash de reemplazo no debe satisfacer ninguna contrasena")
                .isFalse();

        assertThat(after.isAdultConfirmed()).isFalse();
        assertThat(after.isContactAuthorized()).isFalse();
        assertThat(after.isPrivacyAccepted()).isFalse();

        assertThat(after.isDataAnonymized()).isTrue();
        assertThat(after.getAccountStatus()).isEqualTo(AccountStatus.ANONIMIZADA);
    }

    @Test
    void noTocaLaCuentaQueInicioSesionHaceMenosDeDoceMeses() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(11));

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(user.getId()).orElseThrow();

        assertThat(after.isDataAnonymized()).isFalse();
        assertThat(after.getAccountStatus()).isEqualTo(AccountStatus.ACTIVA);
        assertThat(after.getEmail()).isEqualTo(user.getEmail());
        assertThat(after.getName()).isEqualTo("Usuario de prueba");
    }

    /**
     * El SRS mide el periodo desde el ultimo inicio de sesion exitoso, no desde
     * la creacion ni desde Ultima_Actividad. Una cuenta vieja que acaba de entrar
     * no puede perder sus credenciales.
     */
    @Test
    void mideElPeriodoDesdeElUltimoLoginYNoDesdeLaCreacion() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, yearsAgo(3));
        user.setLastLogin(NOW.minus(2, ChronoUnit.DAYS));
        userRepository.saveAndFlush(user);

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(user.getId()).orElseThrow();

        assertThat(after.isDataAnonymized())
                .as("un login reciente reinicia el periodo de 12 meses")
                .isFalse();
        assertThat(after.getEmail()).isEqualTo(user.getEmail());
    }

    @Test
    void usaLaFechaDeCreacionCuandoLaCuentaNuncaInicioSesion() {
        User user = neverLoggedInUser();

        assertThat(user.getLastLogin()).isNull();

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(user.getId()).orElseThrow();

        assertThat(after.isDataAnonymized()).isTrue();
        assertThat(after.getAccountStatus()).isEqualTo(AccountStatus.ANONIMIZADA);
    }

    @Test
    void elTrabajoEsIdempotente() {
        newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(13));
        User alreadyDone = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(20));
        alreadyDone.setDataAnonymized(true);
        alreadyDone.setAccountStatus(AccountStatus.ANONIMIZADA);
        userRepository.saveAndFlush(alreadyDone);

        RetentionResult first = retentionService.executeRetentionPolicy();
        RetentionResult second = retentionService.executeRetentionPolicy();

        assertThat(first.anonymized()).isEqualTo(1);
        assertThat(second.anonymized()).isZero();
        assertThat(second.candidates())
                .as("una cuenta ya limpiada no vuelve a entrar en el criterio")
                .isZero();
        assertThat(second.failed()).isZero();
    }

    @Test
    void conservaLosReportesVinculadosALaCuenta() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(13));
        Report report = reportRepository.saveAndFlush(validReport(user));

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(user.getId()).orElseThrow();
        Report storedReport = reportRepository.findById(report.getId()).orElseThrow();

        assertThat(after.isDataAnonymized()).isTrue();
        assertThat(storedReport.getUser())
                .as("RF-043 obliga a conservar el reporte con su autor")
                .isNotNull();
        assertThat(storedReport.getUser().getId()).isEqualTo(user.getId());
    }

    @Test
    void noAnonimizaCuentasDeAdministrador() {
        User admin = newUser(Role.ADMIN, AccountStatus.ACTIVA, monthsAgo(24));

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(admin.getId()).orElseThrow();

        assertThat(after.isDataAnonymized())
                .as("el trabajo no puede dejar al sistema sin cuenta operativa")
                .isFalse();
        assertThat(after.getEmail()).isEqualTo(admin.getEmail());
    }

    @Test
    void anonimizaCuentasBloqueadas() {
        User blocked = newUser(Role.USUARIO, AccountStatus.BLOQUEADA, monthsAgo(13));

        retentionService.executeRetentionPolicy();

        User after = userRepository.findById(blocked.getId()).orElseThrow();

        assertThat(after.isDataAnonymized())
                .as("una cuenta bloqueada tambien retiene datos personales")
                .isTrue();
    }

    @Test
    void laCuentaAnonimizadaYaNoPuedeIniciarSesion() {
        // Ojo: no se prueba el login antes de anonimizar a proposito. Un login
        // exitoso reinicia el periodo de 12 meses, asi que "comprobar que entra"
        // dejaria la cuenta recien activa y el trabajo no la tocaria.
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(13));

        retentionService.executeRetentionPolicy();

        assertThatThrownBy(() -> authService.login(new LoginRequest(user.getEmail(), PASSWORD)))
                .isInstanceOf(InvalidCredentialsException.class);

        assertThatThrownBy(() -> authService.login(new LoginRequest(
                        "anonimizado+" + user.getId() + "@dogalert.invalid",
                        PASSWORD)))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void reportaElCorteYLosConteos() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, monthsAgo(13));

        RetentionResult result = retentionService.executeRetentionPolicy();

        assertThat(result.anonymized()).isGreaterThanOrEqualTo(1);
        assertThat(result.failed()).isZero();
        assertThat(result.cutoff()).isBetween(
                monthsAgo(13),
                monthsAgo(11));
        assertThat(result.executedAt()).isBetween(
                Instant.now().minus(1, ChronoUnit.MINUTES),
                Instant.now());
    }

    // Instant no admite meses ni años, asi que el retroceso se hace en calendario.
    private static Instant monthsAgo(int months) {
        return LocalDateTime.now(ZoneOffset.UTC).minusMonths(months).toInstant(ZoneOffset.UTC);
    }

    private static Instant yearsAgo(int years) {
        return LocalDateTime.now(ZoneOffset.UTC).minusYears(years).toInstant(ZoneOffset.UTC);
    }

    /** Cuenta creada hace 13 meses que nunca ha iniciado sesion. */
    private User neverLoggedInUser() {
        User user = newUser(Role.USUARIO, AccountStatus.ACTIVA, null);
        user.setCreatedAt(monthsAgo(13));
        return userRepository.saveAndFlush(user);
    }

    private User newUser(Role role, AccountStatus status, Instant lastLogin) {
        User user = new User();
        user.setName("Usuario de prueba");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setRole(role);
        user.setAdultConfirmed(true);
        user.setPrivacyAccepted(true);
        user.setContactAuthorized(false);
        user.setDataAnonymized(false);
        user.setAccountStatus(status);
        user.setLastLogin(lastLogin);

        User saved = userRepository.saveAndFlush(user);

        if (lastLogin != null && lastLogin.isBefore(NOW.minus(1, ChronoUnit.DAYS))) {
            // beforeInsert rellena Fecha_Creacion con el instante real, que para
            // estas pruebas hay que retroceder a mano.
            saved.setCreatedAt(lastLogin);
            userRepository.saveAndFlush(saved);
        }

        return saved;
    }

    private Report validReport(User owner) {
        Report report = new Report();
        report.setClientReportId(UUID.randomUUID().toString());
        report.setUser(owner);
        report.setEventAt(NOW.minus(2, ChronoUnit.DAYS));
        report.setEventType("SIGHTING");
        report.setSeverity(Severity.LOW);
        report.setCertainty(Certainty.HIGH);
        report.setDogCount(1);
        report.setSize(DogSize.MEDIUM);
        report.setColor("cafe");
        report.setColorUndetermined(false);
        report.setCollar(CollarPresence.NO);
        report.setDescription("Perro sin correa en el parque.");
        report.setLatitude(new BigDecimal("27.7800000"));
        report.setLongitude(new BigDecimal("-107.6000000"));
        report.setPolygonVersion("creel-2026-01");
        report.setConsentAccepted(true);
        report.setStatus(ReportStatus.PENDING);
        return report;
    }
}