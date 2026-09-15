package com.equipo3.dogalert.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(

        @Size(max = 150)
        String name,

        @NotBlank
        @Email
        @Size(max = 254)
        String email,

        @NotBlank
        @Size(min = 8, max = 128)
        String password,

        @AssertTrue(message = "Debes confirmar que eres mayor de edad")
        boolean adultConfirmed,

        @AssertTrue(message = "Debes aceptar el aviso de privacidad")
        boolean privacyAccepted

) {}