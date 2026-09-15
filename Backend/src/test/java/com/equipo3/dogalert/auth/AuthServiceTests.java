package com.equipo3.dogalert.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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

    @BeforeEach
    void setUp() {
        passwordEncoder =
                Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();

        authService = new AuthService(
                userRepository,
                passwordEncoder,
                jwtService
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