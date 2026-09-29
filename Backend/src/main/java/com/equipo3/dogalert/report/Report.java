package com.equipo3.dogalert.report;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "Reportes")
public class Report {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Reporte")
    private Long id;
    @Column(name = "ID_Reporte_Cliente", nullable = false, unique = true)
    private UUID clientReportId;
    @Column(name = "ID_Usuario") private Long userId;
    @Column(name = "Fecha_Evento", nullable = false) private Instant eventAt;
    @Column(name = "Tipo_Evento", nullable = false, length = 50) private String eventType;
    @Column(nullable = false, length = 20) private String severity;
    @Column(nullable = false, length = 20) private String certainty;
    @Column(name = "Cantidad_Perros", nullable = false) private int dogCount;
    @Column(nullable = false, length = 20) private String size;
    @Column(length = 120) private String color;
    @Column(name = "Color_Indeterminado", nullable = false) private boolean colorUndetermined;
    @Column(nullable = false, length = 20) private String collar;
    @Column(nullable = false, length = 2000) private String description;
    @Column(nullable = false) private double latitude;
    @Column(nullable = false) private double longitude;
    @Column(name = "Poligono_Version", nullable = false, length = 50) private String boundaryVersion;
    @Column(name = "Tiene_Foto", nullable = false) private boolean hasPhoto;
    @Column(name = "Consentimiento_Aceptado", nullable = false) private boolean consentAccepted;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private ReportStatus status;
    @Column(name = "Fecha_Creacion", nullable = false) private Instant createdAt;

    @PrePersist
    void beforeInsert() { if (createdAt == null) createdAt = Instant.now(); }

    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public UUID getClientReportId() { return clientReportId; }
    public void setClientReportId(UUID value) { clientReportId = value; }
    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public Instant getEventAt() { return eventAt; }
    public void setEventAt(Instant value) { eventAt = value; }
    public String getEventType() { return eventType; }
    public void setEventType(String value) { eventType = value; }
    public String getSeverity() { return severity; }
    public void setSeverity(String value) { severity = value; }
    public String getCertainty() { return certainty; }
    public void setCertainty(String value) { certainty = value; }
    public int getDogCount() { return dogCount; }
    public void setDogCount(int value) { dogCount = value; }
    public String getSize() { return size; }
    public void setSize(String value) { size = value; }
    public String getColor() { return color; }
    public void setColor(String value) { color = value; }
    public boolean isColorUndetermined() { return colorUndetermined; }
    public void setColorUndetermined(boolean value) { colorUndetermined = value; }
    public String getCollar() { return collar; }
    public void setCollar(String value) { collar = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = value; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double value) { latitude = value; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double value) { longitude = value; }
    public String getBoundaryVersion() { return boundaryVersion; }
    public void setBoundaryVersion(String value) { boundaryVersion = value; }
    public boolean isHasPhoto() { return hasPhoto; }
    public void setHasPhoto(boolean value) { hasPhoto = value; }
    public boolean isConsentAccepted() { return consentAccepted; }
    public void setConsentAccepted(boolean value) { consentAccepted = value; }
    public ReportStatus getStatus() { return status; }
    public void setStatus(ReportStatus value) { status = value; }
    public Instant getCreatedAt() { return createdAt; }
}