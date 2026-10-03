package com.equipo3.dogalert.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.equipo3.dogalert.auth.JwtService;
import com.equipo3.dogalert.auth.LoginAttemptLimiter;
import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTests {

    private static final String CORREO_ATAQUE = "socorro@example.com";
    private static final String CORREO_BLOQUEADO = "bloqueada@example.com";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private LoginAttemptLimiter loginAttemptLimiter;

    /**
     * El contexto de Spring se cachea entre pruebas y el limitador conserva los
     * fallos, asi que se limpian las dos identidades usadas. Sin esto, el
     * resultado dependeria del orden de ejecucion.
     */
    @AfterEach
    void limpiarIntentos() {
        loginAttemptLimiter.reset(CORREO_ATAQUE);
        loginAttemptLimiter.reset(CORREO_BLOQUEADO);
    }

    @Test
    void publicProtocolsDoNotRequireToken() throws Exception {
        mockMvc.perform(get("/v1/public/protocols"))
                .andExpect(status().isOk());
    }

    @Test
    void logoutWithoutTokenIsUnauthorized() throws Exception {
        mockMvc.perform(post("/v1/auth/logout"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutWithValidTokenReturnsNoContent() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setRole(Role.USUARIO);

        TokenResponse token = jwtService.generateToken(user);

        mockMvc.perform(post("/v1/auth/logout")
                        .header(
                                HttpHeaders.AUTHORIZATION,
                                "Bearer " + token.accessToken()
                        ))
                .andExpect(status().isNoContent());
    }

    /**
 * RNF-SEG-06. Reproduce el defecto reportado: doce POST consecutivos a
 * /v1/auth/login con contrasena incorrecta contra el mismo correo respondian
 * 401 de forma indefinida. Ahora la identidad se bloquea y responde 429 con
 * Retry-After, que es lo que el openapi.yaml ya prometia para este endpoint.
 *
 * El umbral sale de dogalert.login.max-failed-attempts, que el perfil de
 * pruebas baja a 3 para no tener que agotar cinco intentos.
 */
@Test
void loginLimitaIntentosFallidosYResponde429() throws Exception {
    String correo = CORREO_ATAQUE;
    String contrasena = "ClaveCorrecta123!";

    registrar(correo, contrasena);

    for (int intento = 1; intento <= 3; intento++) {
        mockMvc.perform(post("/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credenciales(correo, "ClaveIncorrecta123!")))
                .andExpect(status().isUnauthorized());
    }

    mockMvc.perform(post("/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(credenciales(correo, "ClaveIncorrecta123!")))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
            .andExpect(jsonPath("$.error.code")
                    .value("TOO_MANY_LOGIN_ATTEMPTS"));
}

@Test
void laContrasenaCorrectaNoSeAceptaMientrasLaCuentaEstaBloqueada()
        throws Exception {

    String correo = CORREO_BLOQUEADO;
    String contrasena = "ClaveCorrecta123!";

    registrar(correo, contrasena);

    for (int intento = 1; intento <= 3; intento++) {
        login(correo, "ClaveIncorrecta123!");
    }

    mockMvc.perform(post("/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(credenciales(correo, contrasena)))
            .andExpect(status().isTooManyRequests());
}

private void registrar(String correo, String contrasena) throws Exception {
    mockMvc.perform(post("/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(String.format(
                            """
                            {
                              "name": "Persona Prueba",
                              "email": "%s",
                              "password": "%s",
                              "adultConfirmed": true,
                              "privacyAccepted": true
                            }
                            """,
                            correo,
                            contrasena)))
            .andExpect(status().isCreated());
}

private void login(String correo, String contrasena) throws Exception {
    mockMvc.perform(post("/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(credenciales(correo, contrasena)))
            .andExpect(status().isUnauthorized());
}

private String credenciales(String correo, String contrasena) {
    return String.format(
            """
            {"email": "%s", "password": "%s"}
            """,
            correo,
            contrasena);
}

@Test
    void invalidTokenIsUnauthorized() throws Exception {
        mockMvc.perform(post("/v1/auth/logout")
                        .header(
                                HttpHeaders.AUTHORIZATION,
                                "Bearer token-invalido"
                        ))
                .andExpect(status().isUnauthorized());
    }
}