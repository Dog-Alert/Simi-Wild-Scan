package com.equipo3.dogalert.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.equipo3.dogalert.auth.dto.LoginRequest;
import com.equipo3.dogalert.auth.dto.RegisterRequest;
import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.exception.EmailAlreadyRegisteredException;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void registerReturnsCreatedAndToken() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenReturn(new TokenResponse(
                        "token-registro",
                        "Bearer",
                        3600
                ));

        mockMvc.perform(post("/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Eliab",
                                  "email": "eliab@example.com",
                                  "password": "ClaveSegura123!",
                                  "adultConfirmed": true,
                                  "privacyAccepted": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken")
                        .value("token-registro"))
                .andExpect(jsonPath("$.tokenType")
                        .value("Bearer"))
                .andExpect(jsonPath("$.expiresIn")
                        .value(3600));
    }

    @Test
    void registerRejectsInvalidRequest() throws Exception {
        mockMvc.perform(post("/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Eliab",
                                  "email": "correo-invalido",
                                  "password": "123",
                                  "adultConfirmed": false,
                                  "privacyAccepted": false
                                }
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code")
                        .value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.requestId")
                        .exists());
    }

    @Test
    void registerRejectsDuplicatedEmail() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new EmailAlreadyRegisteredException());

        mockMvc.perform(post("/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Eliab",
                                  "email": "eliab@example.com",
                                  "password": "ClaveSegura123!",
                                  "adultConfirmed": true,
                                  "privacyAccepted": true
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code")
                        .value("EMAIL_ALREADY_REGISTERED"));
    }

    @Test
    void loginReturnsToken() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenReturn(new TokenResponse(
                        "token-login",
                        "Bearer",
                        3600
                ));

        mockMvc.perform(post("/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "eliab@example.com",
                                  "password": "ClaveSegura123!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken")
                        .value("token-login"))
                .andExpect(jsonPath("$.tokenType")
                        .value("Bearer"));
    }

    @Test
    void logoutReturnsNoContent() throws Exception {
        mockMvc.perform(post("/v1/auth/logout"))
                .andExpect(status().isNoContent());
    }
}