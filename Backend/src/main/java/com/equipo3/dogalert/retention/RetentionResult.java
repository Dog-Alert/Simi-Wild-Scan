package com.equipo3.dogalert.retention;

import java.time.Instant;

/**
 * Evidencia tecnica de una ejecucion del trabajo de retencion.
 *
 * No contiene datos personales: solo el corte aplicado y los conteos. El SDD 10
 * pide registrar la ejecucion diaria y el conteo de fallos, y el 9.4 prohibe que
 * un registro de ese tipo lleve correo, telefono, descripcion o coordenadas.
 */
public record RetentionResult(
        Instant executedAt,
        Instant cutoff,
        int candidates,
        int anonymized,
        int failed) {
}