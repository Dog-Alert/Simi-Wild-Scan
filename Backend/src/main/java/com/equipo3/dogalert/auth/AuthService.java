package com.equipo3.dogalert.auth;

import java.time.Instant;
import java.util.Locale;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.equipo3.dogalert.auth.dto.LoginRequest;
import com.equipo3.dogalert.auth.dto.RegisterRequest;
import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.exception.EmailAlreadyRegisteredException;
import com.equipo3.dogalert.exception.InvalidCredentialsException;
import com.equipo3.dogalert.user.AccountStatus;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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

    @Transactional
    public TokenResponse login(LoginRequest request) {
        String normalizedEmail = normalizeEmail(request.email());

        User user = userRepository
                .findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(InvalidCredentialsException::new);

        boolean validAccount =
                user.getAccountStatus() == AccountStatus.ACTIVA
                && !user.isDataAnonymized();

        boolean validPassword = passwordEncoder.matches(
                request.password(),
                user.getPasswordHash()
        );

        if (!validAccount || !validPassword) {
            throw new InvalidCredentialsException();
        }

        Instant now = Instant.now();

        user.setLastLogin(now);
        user.setLastActivity(now);

        User updatedUser = userRepository.save(user);

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