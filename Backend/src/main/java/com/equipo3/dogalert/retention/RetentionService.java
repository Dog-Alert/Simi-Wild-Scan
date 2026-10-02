package com.equipo3.dogalert.retention;

import com.equipo3.dogalert.user.User;
import com.equipo3.dogalert.user.UserRepository;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Aplica RF-044 del SRS: tras 12 meses sin un inicio de sesion exitoso se
 * eliminan los datos personales de la cuenta.
 *
 * La cuenta no se anonimiza ni se borra. La fila sobrevive porque RF-043 obliga a
 * conservar los reportes que su autor no borro, y esos reportes siguen
 * vinculados a este identificador.
 *
 * La operacion es idempotente: una cuenta ya limpiada queda fuera del criterio de
 * seleccion, asi que repetir el trabajo no vuelve a tocarla ni cambia su resultado.
 */
@Service
public class RetentionService {

    private static final Logger log = LoggerFactory.getLogger(RetentionService.class);

    private static final int PAGE_SIZE = 200;
    private static final String ANONYMOUS_DOMAIN = "@dogalert.invalid";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate transactionTemplate;
    private final long inactivityMonths;

    public RetentionService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PlatformTransactionManager transactionManager,
            @Value("${dogalert.retention.inactivity-months:12}") long inactivityMonths) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.inactivityMonths = inactivityMonths;
    }

    public RetentionResult executeRetentionPolicy() {
        Instant now = Instant.now();

        // El corte se calcula en calendario, no restando 30 dias: "12 meses sin
        // iniciar sesion" tiene que cumplirse en meses, no en 360 dias.
        Instant cutoff = ZonedDateTime.now(ZoneOffset.UTC)
                .minusMonths(inactivityMonths)
                .toInstant();

        // Un unico hash inservible para toda la tanda: nadie conoce el secreto que
        // lo genera, asi que ninguna contrasena puede satisfacerlo, y se evita el
        // coste de hashear una vez por cuenta.
        String unusableHash = passwordEncoder.encode(undisclosedSecret());

        int candidates = 0;
        int anonymized = 0;
        int failed = 0;

        while (true) {
            List<User> batch = userRepository.findAccountsDueForAnonymization(
                    cutoff,
                    PageRequest.of(0, PAGE_SIZE));

            if (batch.isEmpty()) {
                break;
            }

            candidates += batch.size();
            int anonymizedBeforeBatch = anonymized;

            for (User candidate : batch) {
                try {
                    if (anonymizeOne(candidate.getId(), cutoff, unusableHash)) {
                        anonymized++;
                    }
                } catch (RuntimeException exception) {
                    // Una cuenta que falla no puede arrastrar al resto de la tanda,
                    // por eso cada una va en su propia transaccion.
                    failed++;
                    log.error(
                            "No se pudo anonimizar la cuenta {}",
                            candidate.getId(),
                            exception);
                }
            }

            // Las cuentas ya limpiadas salen del criterio de seleccion, asi que la
            // siguiente lectura vuelve a empezar por la primera pagina: avanzar el
            // offset saltaria cuentas. Y si la tanda completa fallo, el conjunto no
            // cambia y hay que detenerse en vez de releerlo indefinidamente.
            if (batch.size() < PAGE_SIZE || anonymized == anonymizedBeforeBatch) {
                break;
            }
        }

        log.info(
                "Retencion ejecutada. Corte {}, candidatos {}, anonimizados {}, fallos {}",
                cutoff,
                candidates,
                anonymized,
                failed);

        return new RetentionResult(now, cutoff, candidates, anonymized, failed);
    }

    private boolean anonymizeOne(Long id, Instant cutoff, String unusableHash) {
        Boolean anonymized = transactionTemplate.execute(status -> {
            Optional<User> found = userRepository.findByIdForAnonymization(id);

            if (found.isEmpty()) {
                return false;
            }

            User user = found.get();

            // Se revalida dentro de la transaccion: entre la consulta y el bloqueo
            // la cuenta puede haber iniciado sesion y reiniciado su periodo.
            if (!user.isAnonymizationDue(cutoff)) {
                return false;
            }

            user.anonymizePersonalData(anonymousEmailFor(user.getId()), unusableHash);
            userRepository.save(user);

            return true;
        });

        return Boolean.TRUE.equals(anonymized);
    }

    private String anonymousEmailFor(Long id) {
        return "anonimizado+" + id + ANONYMOUS_DOMAIN;
    }

    private String undisclosedSecret() {
        return UUID.randomUUID().toString() + UUID.randomUUID();
    }
}