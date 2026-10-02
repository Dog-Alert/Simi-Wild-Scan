package com.equipo3.dogalert.exception;

/**
 * Senal interna de control de flujo: la llave de idempotencia ya fue reservada por
 * otra peticion, asi que esta debe responder como reenvio y no crear el reporte.
 *
 * <p>Nunca llega al cliente. El orquestador la captura fuera de la transaccion y
 * decide entre responder 200 con replayed=true, 409 por conflicto o 410 si el
 * reporte fue eliminado.
 */
public class IdempotencyKeyTakenException extends RuntimeException {
    public IdempotencyKeyTakenException() {
        super("La llave de idempotencia ya fue reservada");
    }
}