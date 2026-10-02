package com.equipo3.dogalert.retention;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.test.context.ActiveProfiles;

/**
 * Contraparte del anterior: con la propiedad activa el bean existe y el cron queda
 * registrado. Sin esto, un error de ortografia en la propiedad dejaria el trabajo
 * apagado sin que nada lo delatara.
 */
@SpringBootTest(properties = "dogalert.retention.enabled=true")
@ActiveProfiles("test")
class RetentionSchedulerEnabledTests {

    @Autowired private ApplicationContext applicationContext;
    @Autowired private ScheduledTaskHolder scheduledTaskHolder;

    @Test
    void elTrabajoQuedaRegistradoCuandoSeActiva() {
        assertThat(applicationContext.getBeanNamesForType(RetentionScheduler.class))
                .hasSize(1);
    }

    @Test
    void elCronDiarioQuedaProgramado() {
        assertThat(scheduledTaskHolder.getScheduledTasks())
                .extracting(task -> task.getTask().getRunnable().toString())
                .anyMatch(description -> description.contains("anonymizeInactiveAccounts"));
    }
}