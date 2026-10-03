package com.equipo3.dogalert.retention;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Trabajo diario de anonimizacion. RNF-PRI-05 lo exige al menos una vez al dia.
 *
 * El bean completo queda condicionado a dogalert.retention.enabled, que por
 * defecto es false hasta que Jazmin revise la politica. Con la condicion puesta
 * aqui, en el bean y no en un if dentro del metodo, el apagado es total: no hay
 * tarea programada que disparar, y no cabe confundir "no se ejecuto" con "se
 * ejecuto y no encontro nada".
 */
@Component
@ConditionalOnProperty(prefix = "dogalert.retention", name = "enabled", havingValue = "true")
public class RetentionScheduler {

    private static final Logger log = LoggerFactory.getLogger(RetentionScheduler.class);

    private final RetentionService retentionService;

    public RetentionScheduler(RetentionService retentionService) {
        this.retentionService = retentionService;
    }

    @Scheduled(cron = "${dogalert.retention.anonymization-cron}")
    public void anonymizeInactiveAccounts() {
        log.info("Comienza el trabajo diario de anonimizacion");

        RetentionResult result = retentionService.executeRetentionPolicy();

        log.info(
                "Termina el trabajo diario de anonimizacion. {} cuentas anonimizadas, {} fallidas",
                result.anonymized(),
                result.failed());
    }
}