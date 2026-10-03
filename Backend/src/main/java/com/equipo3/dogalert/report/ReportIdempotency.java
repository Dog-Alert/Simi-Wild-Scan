package com.equipo3.dogalert.report;

import java.time.Instant;

import com.equipo3.dogalert.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Reserva de una llave de idempotencia. Es la fuente de verdad del requisito A
 * del contrato de base de datos de DOG-35, y la tabla la crea
 * {@code V1.4__sincronizacion_idempotencia_reportes_propios.sql}.
 *
 * <p>Por qué esta tabla existe y no dos columnas en {@code Reportes}: al borrado
 * físico de un reporte por parte de su autor (RF-026) la fila de
 * {@code Reportes} desaparece entera, el UUID quedaría libre y un reintento
 * posterior volvería a crear el reporte. Aquí la fila sobrevive con
 * {@link #report} en {@code null}: el UUID queda consumido y el reintento
 * responde 410 REPORT_DELETED en lugar de 200.
 *
 * <p>Las dos restricciones {@code UNIQUE} ({@code Llave} e
 * {@code ID_Reporte_Cliente}) no son decorativas: son lo único que detiene la
 * carrera entre dos peticiones simultáneas con la misma llave. El pre chequeo
 * {@code existsByKey} deja pasar a las dos, las dos escriben y, sin el índice,
 * nadie ve un error.
 *
 * <p>Ninguna columna guarda dato personal. {@code Hash_Payload} es el SHA-256
 * del payload canónico, no el payload: el payload lleva descripción,
 * coordenadas y teléfono, y no se persisten aquí ni en la bitácora (SDD 09.4).
 */
@Entity
@Table(
        name = "idempotencia_reportes",
        indexes = @Index(name = "idx_idempotencia_reporte", columnList = "ID_Reporte"))
public class ReportIdempotency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Idempotencia")
    private Long id;

    /**
     * El encabezado {@code Idempotency-Key}. Es la llave de reserva y su
     * restricción UNIQUE es la garantía de que los reintentos no dupliquen
     * reportes.
     */
    @NotBlank
    @Pattern(
            regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
            message = "debe ser un UUID valido")
    @Column(name = "Llave", nullable = false, unique = true, length = 36)
    private String key;

    /**
     * El {@code clientReportId} que el móvil genera y reenvía. Unicidad aparte
     * porque un cliente puede cambiar solo uno de los dos valores.
     */
    @NotBlank
    @Size(min = 36, max = 36)
    @Column(
            name = "ID_Reporte_Cliente",
            nullable = false,
            unique = true,
            length = 36)
    private String clientReportId;

    /**
     * SHA-256 en hexadecimal del payload canónico. Permite distinguir un
     * reintento idéntico (200) de una llave reutilizada con otro contenido
     * (409 IDEMPOTENCY_CONFLICT).
     */
    @NotBlank
    @Size(min = 64, max = 64)
    @Column(name = "Hash_Payload", nullable = false, length = 64)
    private String payloadHash;

    /**
     * Identidad que reservó la llave. Un reintento desde otra cuenta responde
     * 409 en vez de degradar un reporte de registrado a anónimo.
     *
     * <p>Va como columna suelta y sin relación a propósito: {@code
     * Usuarios.ID_Usuario} es INT mientras {@link User} lo mapea como {@code
     * Long}, y una FK BIGINT → INT la rechaza MySQL. Mapearlo con {@code
     * @ManyToOne} haría que Hibernate crease esa FK al arrancar con {@code
     * ddl-auto=update}, que es justo lo que el contrato prohíbe. Además el dato
     * se conserva aunque la cuenta se borre.
     */
    @Column(name = "ID_Usuario")
    private Long userId;

    /** Reporta creado. {@code null} significa que el autor lo borró. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ID_Reporte")
    private Report report;

    /** Código de la primera respuesta, para reproducirla en el reenvío. */
    @Column(name = "Respuesta_HTTP")
    private Integer httpStatus;

    @Column(name = "Fecha_Creacion", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    public void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getClientReportId() {
        return clientReportId;
    }

    public void setClientReportId(String clientReportId) {
        this.clientReportId = clientReportId;
    }

    public String getPayloadHash() {
        return payloadHash;
    }

    public void setPayloadHash(String payloadHash) {
        this.payloadHash = payloadHash;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Report getReport() {
        return report;
    }

    public void setReport(Report report) {
        this.report = report;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public void setHttpStatus(Integer httpStatus) {
        this.httpStatus = httpStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}