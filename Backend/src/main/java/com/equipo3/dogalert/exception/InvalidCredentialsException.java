package com.equipo3.dogalert.exception;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Correo o contraseña incorrectos");
    }
}