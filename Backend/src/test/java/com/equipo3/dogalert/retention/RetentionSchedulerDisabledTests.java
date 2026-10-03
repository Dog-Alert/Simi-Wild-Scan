package com.equipo3.dogalert.retention;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

/**
 * El trabajo diario tiene que estar apagado hasta que Jazmin revise la politica,
 * y apagado de verdad: sin bean no hay tarea programada que pueda dispararse.
 *
 * <p>Por eso se comprueba la ausencia del bean y no un resultado de ejecucion. Un
 * if dentro del metodo dejaria el cron activo y solo evitaria el efecto, que es
 * justo la confusion que este test busca impedir.
 */
@SpringBootTest
@ActiveProfiles("test")
class RetentionSchedulerDisabledTests {

    @Autowired private ApplicationContext applicationContext;

    @Test
    void elTrabajoNoEstaRegistradoPorDefecto() {
        assertThat(applicationContext.getBeanNamesForType(RetentionScheduler.class))
                .as("dogalert.retention.enabled debe venir en false")
                .isEmpty();
    }

    @Test
    void elServicioDeRetencionSiExisteParaPoderInvocarlo() {
        assertThat(applicationContext.getBean(RetentionService.class))
                .as("el servicio se registra siempre; lo que se apaga es la programacion")
                .isNotNull();
    }
}