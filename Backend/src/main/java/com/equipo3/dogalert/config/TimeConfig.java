package com.equipo3.dogalert.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * El tiempo del servidor se pide por bean y no con Instant.now() en cada clase.
 *
 * El caso que lo justifica es el limitador de intentos de inicio de sesion: su
 * ventana deslizante necesita poder avanzar el reloj en una prueba para no
 * esperar quince minutos de verdad.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}