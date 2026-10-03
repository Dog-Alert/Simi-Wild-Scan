package com.equipo3.dogalert.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;

import com.equipo3.dogalert.auth.dto.LoginRequest;
import com.equipo3.dogalert.auth.dto.RegisterRequest;
import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.exception.EmailAlreadyRegisteredException;
import com.equipo3.dogalert.exception.InvalidCredentialsException;
import com.equipo3.dogalert.exception.TooManyLoginAttemptsException;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

@ExtendWith(MockitoExtension.class)
class AuthServiceTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;
    private LoginAttemptLimiter loginAttemptLimiter;
    private MovableClock clock;

    @BeforeEach
    void setUp() {
        passwordEncoder =
                Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();

        clock = new MovableClock(Instant.parse("2026-01-15T12:00:00Z"));

        loginAttemptLimiter = new LoginAttemptLimiter(
                clock,
                5,
                15);

        authService = new AuthService(
                userRepository,
                passwordEncoder,
                jwtService,
                loginAttemptLimiter
        );
    }

    @Test
    void registerCreatesUserWithHashedPassword() {
        RegisterRequest request = new RegisterRequest(
                "Eliab",
                " ELIAB@example.com ",
                "ClaveSegura123!",
                true,
                true
        );

        TokenResponse expectedToken =
                new TokenResponse("token-prueba", "Bearer", 3600);

        when(userRepository.existsByEmailIgnoreCase(
                "eliab@example.com"
        )).thenReturn(false);

        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> {
                    User savedUser = invocation.getArgument(0);
                    savedUser.setId(1L);
                    return savedUser;
                });

        when(jwtService.generateToken(any(User.class)))
                .thenReturn(expectedToken);

        TokenResponse result = authService.register(request);

        ArgumentCaptor<User> userCaptor =
                ArgumentCaptor.forClass(User.class);

        verify(userRepository).save(userCaptor.capture());

        User savedUser = userCaptor.getValue();

        assertEquals("eliab@example.com", savedUser.getEmail());
        assertEquals("Eliab", savedUser.getName());
        assertEquals(Role.USUARIO, savedUser.getRole());
        assertEquals(AccountStatus.ACTIVA, savedUser.getAccountStatus());
        assertTrue(savedUser.isAdultConfirmed());
        assertTrue(savedUser.isPrivacyAccepted());

        assertNotEquals(
                request.password(),
                savedUser.getPasswordHash()
        );

        assertTrue(passwordEncoder.matches(
                request.password(),
                savedUser.getPasswordHash()
        ));

        assertEquals(expectedToken, result);
    }

    @Test
    void registerRejectsDuplicatedEmail() {
        RegisterRequest request = new RegisterRequest(
                null,
                "existente@example.com",
                "ClaveSegura123!",
                true,
                true
        );

        when(userRepository.existsByEmailIgnoreCase(
                "existente@example.com"
        )).thenReturn(true);

        assertThrows(
                EmailAlreadyRegisteredException.class,
                () -> authService.register(request)
        );

        verify(userRepository, never()).save(any(User.class));
        verifyNoInteractions(jwtService);
    }

    @Test
    void loginReturnsTokenForValidCredentials() {
        String password = "ClaveSegura123!";

        User user = createActiveUser(
                "eliab@example.com",
                password
        );

        TokenResponse expectedToken =
                new TokenResponse("token-prueba", "Bearer", 3600);

        when(userRepository.findByEmailIgnoreCase(
                "eliab@example.com"
        )).thenReturn(Optional.of(user));

        when(userRepository.save(user)).thenReturn(user);

        when(jwtService.generateToken(user))
                .thenReturn(expectedToken);

        TokenResponse result = authService.login(
                new LoginRequest(
                        "ELIAB@example.com",
                        password
                )
        );

        assertEquals(expectedToken, result);
        assertNotNull(user.getLastLogin());
        assertNotNull(user.getLastActivity());
    }

    @Test
    void loginRejectsInvalidPassword() {
        User user = createActiveUser(
                "eliab@example.com",
                "ClaveCorrecta123!"
        );

        when(userRepository.findByEmailIgnoreCase(
                "eliab@example.com"
        )).thenReturn(Optional.of(user));

        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "eliab@example.com",
                                "ClaveIncorrecta123!"
                        )
                )
        );

        verify(userRepository, never()).save(any(User.class));
        verifyNoInteractions(jwtService);
    }

    @Test
    void loginRejectsUnknownEmail() {
        when(userRepository.findByEmailIgnoreCase(
                "nadie@example.com"
        )).thenReturn(Optional.empty());

        assertThrows(
                InvalidCredentialsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "nadie@example.com",
                                "ClaveSegura123!"
                        )
                )
        );

        verifyNoInteractions(jwtService);
    }

/**
     * Fija el comportamiento del hash senuelo. Sin esa llamada, un correo
     * inexistente respondia mucho mas rapido que uno existente y el tiempo de
     * respuesta revelaba que correos estan registrados.
     */
    @Test
    void unCorreoInexistenteIgualaElTiempoDeRespuesta() {
        CountingPasswordEncoder counting = new CountingPasswordEncoder(
                passwordEncoder);

        AuthService service = new AuthService(
                userRepository,
                counting,
                jwtService,
                loginAttemptLimiter);

        when(userRepository.findByEmailIgnoreCase(
                "nadie@example.com"
        )).thenReturn(Optional.empty());

        assertThrows(
                InvalidCredentialsException.class,
                () -> service.login(
                        new LoginRequest(
                                "nadie@example.com",
                                "ClaveSegura123!"
                        )
                )
        );

        assertEquals(1, counting.matchesCalls);
    }

    @Test
    void bloqueaTrasCincoIntentosFallidos() {
        stubExistingUser("eliab@example.com", "ClaveCorrecta123!");

        for (int intento = 1; intento <= 5; intento++) {
            assertThrows(
                    InvalidCredentialsException.class,
                    () -> authService.login(
                            new LoginRequest(
                                    "eliab@example.com",
                                    "ClaveIncorrecta123!"
                            )
                    )
        );
        }

        TooManyLoginAttemptsException tooMany = assertThrows(
                TooManyLoginAttemptsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "eliab@example.com",
                                "ClaveIncorrecta123!"
                        )
                )
        );

        assertTrue(tooMany.retryAfterSeconds() > 0);
    }

    /**
     * El limite se consulta antes que la base de datos. Si se consultara
     * despues, un atacante podria seguir occurrriendo la consulta y el PBKDF2
     * con el endpoint bloqueado.
     */
    @Test
    void unaIdentidadBloqueadaNoTocaLaBaseDeDatos() {
        stubExistingUser("eliab@example.com", "ClaveCorrecta123!");
        fillTheWindow("eliab@example.com");

        assertThrows(
                TooManyLoginAttemptsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "eliab@example.com",
                                "ClaveIncorrecta123!"
                        )
                )
        );

        verify(userRepository, times(5))
                .findByEmailIgnoreCase("eliab@example.com");
    }

    @Test
    void unLoginExitosoLimpiaElContador() {
        User user = stubExistingUser("eliab@example.com", "ClaveCorrecta123!");

        for (int intento = 1; intento <= 4; intento++) {
            assertThrows(
                    InvalidCredentialsException.class,
                    () -> authService.login(
                            new LoginRequest(
                                    "eliab@example.com",
                                    "ClaveIncorrecta123!"
                            )
                    )
        );
        }

        when(userRepository.save(user)).thenReturn(user);
        when(jwtService.generateToken(user))
                .thenReturn(new TokenResponse("token-prueba", "Bearer", 3600));

        authService.login(
                new LoginRequest("eliab@example.com", "ClaveCorrecta123!")
        );

        for (int intento = 1; intento <= 4; intento++) {
            assertThrows(
                    InvalidCredentialsException.class,
                    () -> authService.login(
                            new LoginRequest(
                                    "eliab@example.com",
                                    "ClaveIncorrecta123!"
                            )
                    )
        );
        }

        assertEquals(
                Optional.empty(),
                loginAttemptLimiter.remainingLockout("eliab@example.com"));
    }

    /**
     * Un correo que no existe tambien llena la ventana. Si no lo hiciera, ver
     * que un correo se bloquea seria en si mismo un oraculo de enumeracion.
     */
    @Test
    void unCorreoInexistenteLlenaLaVentana() {
        when(userRepository.findByEmailIgnoreCase("nadie@example.com"))
                .thenReturn(Optional.empty());

        for (int intento = 1; intento <= 5; intento++) {
            assertThrows(
                    InvalidCredentialsException.class,
                    () -> authService.login(
                            new LoginRequest(
                                    "nadie@example.com",
                                    "ClaveSegura123!"
                            )
                    )
        );
        }

        assertThrows(
                TooManyLoginAttemptsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "nadie@example.com",
                                "ClaveSegura123!"
                        )
                )
        );
    }

    @Test
    void laVentanaExpiraYDejaDeBloquear() {
        stubExistingUser("eliab@example.com", "ClaveCorrecta123!");
        fillTheWindow("eliab@example.com");

        clock.advance(Duration.ofMinutes(16));

        assertEquals(
                Optional.empty(),
                loginAttemptLimiter.remainingLockout("eliab@example.com"));
    }

    @Test
    void elBloqueoDevuelveLosSegundosQueFaltan() {
        stubExistingUser("eliab@example.com", "ClaveCorrecta123!");
        fillTheWindow("eliab@example.com");

        clock.advance(Duration.ofMinutes(4));

        TooManyLoginAttemptsException tooMany = assertThrows(
                TooManyLoginAttemptsException.class,
                () -> authService.login(
                        new LoginRequest(
                                "eliab@example.com",
                                "ClaveCorrecta123!"
                        )
                )
        );

        assertEquals(660L, tooMany.retryAfterSeconds());
    }

    private User stubExistingUser(String email, String password) {
        User user = createActiveUser(email, password);
        when(userRepository.findByEmailIgnoreCase(email))
                .thenReturn(Optional.of(user));
        return user;
    }

    private void fillTheWindow(String email) {
        for (int intento = 1; intento <= 5; intento++) {
            assertThrows(
                    InvalidCredentialsException.class,
                    () -> authService.login(
                            new LoginRequest(email, "ClaveIncorrecta123!")
                    )
        );
        }
    }

    private static final class CountingPasswordEncoder
            implements PasswordEncoder {

        private final PasswordEncoder delegate;
        private int matchesCalls;

        CountingPasswordEncoder(PasswordEncoder delegate) {
            this.delegate = delegate;
        }

        @Override
        public String encode(CharSequence rawPassword) {
            return delegate.encode(rawPassword);
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encoded) {
            matchesCalls++;
            return delegate.matches(rawPassword, encoded);
        }
    }

    private static final class MovableClock extends Clock {

        private Instant instant;

        MovableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            this.instant = this.instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return this.instant;
        }
    }

    private User createActiveUser(
            String email,
            String plainPassword) {

        User user = new User();

        user.setId(1L);
        user.setEmail(email);
        user.setPasswordHash(
                passwordEncoder.encode(plainPassword)
        );
        user.setRole(Role.USUARIO);
        user.setAdultConfirmed(true);
        user.setPrivacyAccepted(true);
        user.setAccountStatus(AccountStatus.ACTIVA);
        user.setDataAnonymized(false);

        return user;
    }
}