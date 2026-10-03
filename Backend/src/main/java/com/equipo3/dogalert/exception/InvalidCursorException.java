package com.equipo3.dogalert.exception;

/**
 * El cursor de paginacion no es un valor emitido por la API. Responde 400 y no
 * 500, y no se tenta adivinar una pagina.
 */
public class InvalidCursorException extends RuntimeException {

    public InvalidCursorException() {
        super("El cursor de paginación no es válido");
    }
}