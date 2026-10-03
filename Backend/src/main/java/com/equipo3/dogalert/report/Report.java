package com.equipo3.dogalert.report;

import java.math.BigDecimal;
import java.time.Instant;

import com.equipo3.dogalert.evidence.ReportEvidence;
import com.equipo3.dogalert.user.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Reporte de un avistamiento, anónimo o asociado a una cuenta.
 *
 * <p>{@code idx_reportes_usuario_fecha} cubre el filtro por propietario y el
 * orden {@code (Fecha_Evento, ID_Reporte)} de los reportes propios, que pagina
 * por cursor opaco. Va declarado aquí, y no solo en
 * {@code V1.4__sincronizacion_idempotencia_reportes_propios.sql}, porque en este
 * repositorio las migraciones no se ejecutan automáticamente: un índice escrito
 * solo en SQL no llegaría a crearse nunca. La migración debe usar
 * <strong>exactamente</strong> este nombre y estas tres columnas, o quedarían
 * dos índices idénticos. {@code ReportIndexSchemaTests} lee los metadatos y
 * falla si falta, para que esto no vuelva a pasar en silencio.
 */
@Entity
@Table(
        name = "Reportes",
        indexes = @Index(
                name = "idx_reportes_usuario_fecha",
                columnList = "ID_Usuario, Fecha_Evento, ID_Reporte"))
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Reporte")
    private Long id;

    @NotBlank
    @Pattern(
            regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
            message = "debe ser un UUID valido")
    @Column(name = "ID_Reporte_Cliente", nullable = false, unique = true, length = 36)
    private String clientReportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ID_Usuario")
    private User user;

    @NotNull
    @Column(name = "Fecha_Evento", nullable = false)
    private Instant eventAt;

    @NotBlank
    @Size(max = 50)
    @Column(name = "Tipo_Evento", nullable = false, length = 50)
    private String eventType;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 20)
    private Severity severity;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "certainty", nullable = false, length = 20)
    private Certainty certainty;

    @Min(1)
    @Max(999)
    @Column(name = "Cantidad_Perros", nullable = false)
    private int dogCount;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "size", nullable = false, length = 20)
    private DogSize size;

    @Size(max = 120)
    @Column(name = "color", length = 120)
    private String color;

    @Column(name = "Color_Indeterminado", nullable = false)
    private boolean colorUndetermined;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "collar", nullable = false, length = 20)
    private CollarPresence collar;

    @NotBlank
    @Size(min = 20, max = 2000)
    @Column(name = "Descripcion", nullable = false, length = 2000)
    private String description;

    @NotNull
    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    @Column(name = "latitude", nullable = false, precision = 10, scale = 7)
    private BigDecimal latitude;

    @NotNull
    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    @Column(name = "longitude", nullable = false, precision = 10, scale = 7)
    private BigDecimal longitude;

    @NotBlank
    @Size(max = 50)
    @Column(name = "Poligono_Version", nullable = false, length = 50)
    private String polygonVersion;

    @Column(name = "Tiene_Foto", nullable = false)
    private boolean hasPhoto;

    @Column(name = "Consentimiento_Aceptado", nullable = false)
    private boolean consentAccepted;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReportStatus status = ReportStatus.PENDING;

    @Column(name = "Fecha_Creacion", nullable = false, updatable = false)
    private Instant createdAt;

    @Valid
    @OneToOne(
            mappedBy = "report",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY)
    private ReportEvidence evidence;

    @PrePersist
    public void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        if (status == null) {
            status = ReportStatus.PENDING;
        }

        hasPhoto = evidence != null;
    }

    @AssertTrue(message = "el color debe indicarse o marcarse como indeterminado")
    public boolean isColorSelectionValid() {
        boolean hasDefinedColor = color != null && !color.isBlank();
        return colorUndetermined ? !hasDefinedColor : hasDefinedColor;
    }

    public void attachEvidence(ReportEvidence newEvidence) {
        if (evidence != null && evidence != newEvidence) {
            evidence.setReport(null);
        }

        evidence = newEvidence;
        hasPhoto = newEvidence != null;

        if (newEvidence != null && newEvidence.getReport() != this) {
            newEvidence.setReport(this);
        }
    }

    public void removeEvidence() {
        attachEvidence(null);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getClientReportId() {
        return clientReportId;
    }

    public void setClientReportId(String clientReportId) {
        this.clientReportId = clientReportId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Instant getEventAt() {
        return eventAt;
    }

    public void setEventAt(Instant eventAt) {
        this.eventAt = eventAt;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public Certainty getCertainty() {
        return certainty;
    }

    public void setCertainty(Certainty certainty) {
        this.certainty = certainty;
    }

    public int getDogCount() {
        return dogCount;
    }

    public void setDogCount(int dogCount) {
        this.dogCount = dogCount;
    }

    public DogSize getSize() {
        return size;
    }

    public void setSize(DogSize size) {
        this.size = size;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public boolean isColorUndetermined() {
        return colorUndetermined;
    }

    public void setColorUndetermined(boolean colorUndetermined) {
        this.colorUndetermined = colorUndetermined;
    }

    public CollarPresence getCollar() {
        return collar;
    }

    public void setCollar(CollarPresence collar) {
        this.collar = collar;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public String getPolygonVersion() {
        return polygonVersion;
    }

    public void setPolygonVersion(String polygonVersion) {
        this.polygonVersion = polygonVersion;
    }

    public boolean hasPhoto() {
        return hasPhoto;
    }

    public boolean isConsentAccepted() {
        return consentAccepted;
    }

    public void setConsentAccepted(boolean consentAccepted) {
        this.consentAccepted = consentAccepted;
    }

    public ReportStatus getStatus() {
        return status;
    }

    public void setStatus(ReportStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public ReportEvidence getEvidence() {
        return evidence;
    }
}
