package com.equipo3.dogalert.exception;

public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("El correo ya está registrado");
    }
}