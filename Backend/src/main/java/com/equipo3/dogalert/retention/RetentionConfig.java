package com.equipo3.dogalert.retention;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Activa la infraestructura de programacion de tareas.
 *
 * Vive en su propia clase y no en DogalertApplication para que la activacion del
 * trabajo diario se pueda revisar de un vistazo. El bean del trabajo sigue
 * desligado por dogalert.retention.enabled.
 */
@Configuration
@EnableScheduling
public class RetentionConfig {
}