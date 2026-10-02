package com.equipo3.dogalert.exception;

/**
 * El token es valido criptograficamente pero no identifica a un usuario usable:
 * falta el claim sub o no contiene un ID_Usuario numerico. No debe degradarse a
 * reporte anonimo ni responder 500.
 */
public class InvalidTokenSubjectException extends RuntimeException {

    public InvalidTokenSubjectException() {
        super("El token no identifica a un usuario");
    }
}