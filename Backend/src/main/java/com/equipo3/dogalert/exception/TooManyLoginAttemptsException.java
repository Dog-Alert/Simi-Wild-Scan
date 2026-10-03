package com.equipo3.dogalert.exception;

/**
 * Se lanza cuando una identidad acumula demasiados intentos de inicio de sesion
 * fallidos dentro de la ventana configurada.
 *
 * Transporta los segundos que faltan para que la identidad vuelva a poder
 * autenticarse, que es lo que viaja en la cabecera Retry-After.
 */
public class TooManyLoginAttemptsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyLoginAttemptsException(long retryAfterSeconds) {
        super("Demasiados intentos de inicio de sesion. Intenta de nuevo mas tarde");
        this.retryAfterSeconds = Math.max(1L, retryAfterSeconds);
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}