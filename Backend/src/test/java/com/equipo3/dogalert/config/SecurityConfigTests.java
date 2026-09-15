package com.equipo3.dogalert.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.equipo3.dogalert.auth.JwtService;
import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.user.Role;
import com.equipo3.dogalert.user.User;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

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