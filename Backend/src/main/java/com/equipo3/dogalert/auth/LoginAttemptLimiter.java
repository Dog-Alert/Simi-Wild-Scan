package com.equipo3.dogalert.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cuenta los intentos de inicio de sesion fallidos por identidad y bloquea la
 * cuenta cuando la ventana deslizante se llena.
 *
 * La cuenta que se lleva es el correo ya normalizado, nunca la direccion IP: el
 * bloqueo por identidad es el que el SDD pide para el login, y evita que un
 * atacante pueda dejar sin acceso a un usuario jugando con su correo.
 *
 * El estado vive en memoria a proposito. Anadir columnas a Usuarios exigiria un
 * DDL nuevo, y el esquema todavia esta desalineado (ver el contrato de base de
 * datos). El precio es que el contador se reinicia al desplegar y no se comparte
 * entre instancias, asi que repartir peticiones entre varias instancias de Cloud
 * Run evade el limite. Eso es lo que OPEN-011 tiene que resolver.
 *
 * Un correo que no existe tambien cuenta, y eso no es un descuido: si solo
 * contaran los correos reales, ver que uno se bloquea seria en si mismo un
 * oraculo para enumerar quien tiene cuenta.
 */
@Component
public class LoginAttemptLimiter {

    private final ConcurrentMap<String, ConcurrentLinkedDeque<Instant>> failures =
            new ConcurrentHashMap<>();

    private final Clock clock;
    private final int maxFailures;
    private final Duration window;

    public LoginAttemptLimiter(
            Clock clock,
            @Value("${dogalert.login.max-failed-attempts}") int maxFailures,
            @Value("${dogalert.login.lockout-minutes}") long lockoutMinutes) {

        this.clock = clock;
        this.maxFailures = Math.max(1, maxFailures);
        this.window = Duration.ofMinutes(Math.max(1L, lockoutMinutes));
    }

    /**
     * Devuelve cuanto falta para que la identidad vuelva a poder autenticarse, o
     * vacio si no esta bloqueada.
     */
    public Optional<Duration> remainingLockout(String identity) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(window);
        AtomicReference<Duration> locked = new AtomicReference<>();

        failures.compute(identity, (key, attempts) -> {
            ConcurrentLinkedDeque<Instant> pruned = prune(attempts, cutoff);
            if (pruned.isEmpty()) {
                return null;
            }
            if (pruned.size() >= maxFailures) {
                Instant oldest = pruned.peekFirst();
                locked.set(Duration.between(now, oldest.plus(window)));
            }
            return pruned;
        });

        return Optional.ofNullable(locked.get());
    }

    public void recordFailure(String identity) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(window);

        failures.compute(identity, (key, attempts) -> {
            ConcurrentLinkedDeque<Instant> target =
                    attempts == null ? new ConcurrentLinkedDeque<>() : attempts;
            prune(target, cutoff);
            target.addLast(now);
            return target;
        });
    }

    public void reset(String identity) {
        failures.remove(identity);
    }

    @Scheduled(fixedDelayString = "${dogalert.login.sweep-interval-seconds:600}")
    public void discardExpired() {
        Instant cutoff = clock.instant().minus(window);
        failures.entrySet().removeIf(entry -> {
            ConcurrentLinkedDeque<Instant> attempts = entry.getValue();
            Instant newest = attempts.peekLast();
            return newest == null || !newest.isAfter(cutoff);
        });
    }

    private ConcurrentLinkedDeque<Instant> prune(
            ConcurrentLinkedDeque<Instant> attempts,
            Instant cutoff) {

        ConcurrentLinkedDeque<Instant> target =
                attempts == null ? new ConcurrentLinkedDeque<>() : attempts;

        while (true) {
            Instant oldest = target.peekFirst();
            if (oldest == null || oldest.isAfter(cutoff)) {
                return target;
            }
            target.pollFirst();
        }
    }

    long retryAfterSeconds(Duration remaining) {
        long millis = remaining.toMillis();
        return Math.max(1L, (millis + 999L) / 1000L);
    }
}