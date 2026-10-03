package com.equipo3.dogalert.exception;

/**
 * Se lanza cuando la llave de idempotencia ya se uso con un payload distinto o
 * desde otra identidad. Seccion 6.6 del SDD: misma llave con hash distinto.
 */
public class IdempotencyConflictException extends RuntimeException {
    public IdempotencyConflictException(String message) { super(message); }
}