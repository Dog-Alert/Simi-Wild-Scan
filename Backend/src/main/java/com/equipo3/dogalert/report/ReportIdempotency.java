package com.equipo3.dogalert.report;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "idempotencia_reportes")
public class ReportIdempotency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Idempotencia")
    private Long id;

    @Column(name = "Llave", nullable = false, unique = true, length = 36)
    private String key;

    @Column(name = "ID_Reporte_Cliente", nullable = false, unique = true, length = 36)
    private String clientReportId;

    @Column(name = "Hash_Payload", nullable = false, length = 64)
    private String payloadHash;

    @Column(name = "ID_Usuario")
    private Long userId;

    /**
     * El borrado de un reporte debe poner esta referencia en NULL y no borrar la
     * fila de idempotencia: el UUID queda consumido y un reintento responde 410 en
     * lugar de recrear el reporte. ON DELETE SET NULL tanto en el esquema que
     * genera Hibernate para las pruebas como en el de la migracion de DOG-35.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.SET_NULL)
    @JoinColumn(name = "ID_Reporte")
    private Report report;

    @Column(name = "Respuesta_HTTP")
    private Integer responseStatus;

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

    public Integer getResponseStatus() {
        return responseStatus;
    }

    public void setResponseStatus(Integer responseStatus) {
        this.responseStatus = responseStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}