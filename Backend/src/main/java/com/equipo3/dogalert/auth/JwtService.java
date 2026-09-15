package com.equipo3.dogalert.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

import com.equipo3.dogalert.auth.dto.TokenResponse;
import com.equipo3.dogalert.user.User;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final long expirationMinutes;

    public JwtService(
            JwtEncoder jwtEncoder,
            @Value("${dogalert.jwt.expiration-minutes}")
            long expirationMinutes) {

        if (expirationMinutes <= 0) {
            throw new IllegalArgumentException(
                    "La expiración del JWT debe ser mayor que cero"
            );
        }

        this.jwtEncoder = jwtEncoder;
        this.expirationMinutes = expirationMinutes;
    }

    public TokenResponse generateToken(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(
                expirationMinutes,
                ChronoUnit.MINUTES
        );

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("dogalert-api")
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.getId().toString())
                .claim(
                        "roles",
                        List.of(user.getRole().name())
                )
                .build();

        JwsHeader header = JwsHeader
                .with(MacAlgorithm.HS256)
                .type("JWT")
                .build();

        String accessToken = jwtEncoder
                .encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();

        return new TokenResponse(
                accessToken,
                "Bearer",
                expirationMinutes * 60
        );
    }
}