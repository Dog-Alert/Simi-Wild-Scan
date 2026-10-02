package com.equipo3.dogalert.user;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /**
     * Cuentas cuyo ultimo inicio de sesion exitoso (o su fecha de creacion, si
     * nunca han entrado) precede al corte. El filtro por rol deja fuera a los
     * administradores: el trabajo de retencion no debe poder dejar al sistema
     * sin una cuenta operativa.
     *
     * Se pagina porque la retencion puedeabarcar toda la tabla y no conviene
     * cargarla de una vez.
     */
    @Query("""
            select u from User u
            where u.dataAnonymized = false
              and u.role = com.equipo3.dogalert.user.Role.USUARIO
              and coalesce(u.lastLogin, u.createdAt) < :cutoff
            order by coalesce(u.lastLogin, u.createdAt) asc
            """)
    List<User> findAccountsDueForAnonymization(
            @Param("cutoff") Instant cutoff,
            Pageable pageable);

    /**
     * Relee la cuenta con bloqueo de escritura justo antes de tocarla. Sin esto,
     * un login que coincidiera con la ejecucion del trabajo podria perder su
     * marca de ultimo acceso y ver sus credenciales borradas igualmente.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForAnonymization(@Param("id") Long id);
}