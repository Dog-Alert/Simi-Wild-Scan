package com.equipo3.dogalert.geography;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "Poligonos_Creel")
public class CreelPolygon {

    @Id
    @NotBlank
    @Size(max = 50)
    @Column(name = "Poligono_Version", length = 50)
    private String version;

    @NotBlank
    @Size(max = 120)
    @Column(name = "Nombre", nullable = false, length = 120)
    private String name;

    @NotBlank
    @Column(name = "GeoJSON", nullable = false, columnDefinition = "JSON")
    private String geoJson;

    @NotBlank
    @Pattern(regexp = "^[0-9a-fA-F]{64}$")
    @Column(name = "SHA256", nullable = false, unique = true, length = 64)
    private String sha256;

    @Column(name = "Activo", nullable = false)
    private boolean active;

    @Column(name = "Fecha_Creacion", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    public void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getGeoJson() {
        return geoJson;
    }

    public void setGeoJson(String geoJson) {
        this.geoJson = geoJson;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
