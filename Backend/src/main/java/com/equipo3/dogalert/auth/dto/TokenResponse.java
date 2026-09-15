package com.equipo3.dogalert.auth.dto;

public record TokenResponse(
        String accessToken,
        String tokenType,
        long expiresIn
) {}