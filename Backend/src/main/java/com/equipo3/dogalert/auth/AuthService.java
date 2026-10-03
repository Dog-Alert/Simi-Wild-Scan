package com.equipo3.dogalert.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttemptLimiter loginAttemptLimiter;
    private final String decoyPasswordHash;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            LoginAttemptLimiter loginAttemptLimiter) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginAttemptLimiter = loginAttemptLimiter;
        this.decoyPasswordHash = passwordEncoder.encode(
                UUID.randomUUID().toString());
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.email());

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new EmailAlreadyRegisteredException();
        }

        User user = new User();

        user.setName(normalizeOptionalText(request.name()));
        user.setEmail(normalizedEmail);
        user.setPasswordHash(
                passwordEncoder.encode(request.password())
        );
        user.setRole(Role.USUARIO);
        user.setAdultConfirmed(request.adultConfirmed());
        user.setPrivacyAccepted(request.privacyAccepted());

        // El consentimiento de contacto corresponde a HU-10.
        user.setPhone(null);
        user.setContactAuthorized(false);

        user.setAccountStatus(AccountStatus.ACTIVA);
        user.setDataAnonymized(false);
        user.setLastActivity(Instant.now());

        User savedUser = userRepository.save(user);

        return jwtService.generateToken(savedUser);
    }

/**
     * El orden de las comprobaciones no es negociable, y por eso queda escrito.
     *
     * Primero el limitador, antes de la consulta a la base de datos: una
     * identidad bloqueada no consume una lectura ni ejecuta PBKDF2, que es lo
     * que evita que un atacante convierta el endpoint publico en un quemador de
     * CPU.
     *
     * Segundo, cuando el correo no existe se ejecuta igualmente el matches
     * contra un hash senuelo. Sin esa llamada, un correo inexistente respondia en
     * milisegundos y uno existente tardaba mas de cien por el PBKDF2, asi que el
     * tiempo de respuesta revelaba que correos estan registrados aunque el
     * cuerpo del 401 fuera identico en los dos casos.
     */
@Transactional
public TokenResponse login(LoginRequest request) {
        String normalizedEmail = normalizeEmail(request.email());

        Optional<Duration> locked = loginAttemptLimiter.remainingLockout(
                normalizedEmail);

        if (locked.isPresent()) {
            throw new TooManyLoginAttemptsException(
                    loginAttemptLimiter.retryAfterSeconds(locked.get()));
        }

        User user = userRepository
                .findByEmailIgnoreCase(normalizedEmail)
                .orElse(null);

        if (user == null) {
            passwordEncoder.matches(
                    request.password(),
                    decoyPasswordHash
            );

            loginAttemptLimiter.recordFailure(normalizedEmail);

            throw new InvalidCredentialsException();
        }

        boolean validAccount =
                user.getAccountStatus() == AccountStatus.ACTIVA
                && !user.isDataAnonymized();

        boolean validPassword = passwordEncoder.matches(
                request.password(),
                user.getPasswordHash()
        );

        if (!validAccount || !validPassword) {
            loginAttemptLimiter.recordFailure(normalizedEmail);

            throw new InvalidCredentialsException();
        }

        Instant now = Instant.now();

        user.setLastLogin(now);
        user.setLastActivity(now);

        User updatedUser = userRepository.save(user);

        loginAttemptLimiter.reset(normalizedEmail);

        return jwtService.generateToken(updatedUser);
    }

    private String normalizeEmail(String email) {
        return email
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }

        String normalizedValue = value.trim();

        return normalizedValue.isEmpty()
                ? null
                : normalizedValue;
    }
}