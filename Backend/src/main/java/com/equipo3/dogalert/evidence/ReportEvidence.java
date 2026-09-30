package com.equipo3.dogalert.evidence;

import java.time.Instant;

import com.equipo3.dogalert.report.Report;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "Evidencias_Reportes")
public class ReportEvidence {

    public static final int MAX_PHOTO_BYTES = 1_048_576;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Evidencia")
    private Long id;

    @NotNull
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_Reporte", nullable = false, unique = true)
    private Report report;

    @NotNull
    @Size(min = 1, max = MAX_PHOTO_BYTES)
    @Lob
    @Column(name = "Foto", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] photo;

    @NotNull
    @Pattern(regexp = "image/(jpeg|png|heic)")
    @Column(name = "Tipo_MIME", nullable = false, length = 50)
    private String mimeType;

    @Min(1)
    @Max(MAX_PHOTO_BYTES)
    @Column(name = "Tamano_Bytes", nullable = false)
    private int sizeBytes;

    @NotNull
    @Size(min = 32, max = 32)
    @Column(name = "SHA256", nullable = false, columnDefinition = "BINARY(32)")
    private byte[] sha256;

    @Column(name = "Metadatos_Coherentes")
    private Boolean metadataConsistent;

    @Column(name = "Fecha_Creacion", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    public void beforeInsert() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        if (photo != null) {
            sizeBytes = photo.length;
        }
    }

    @AssertTrue(message = "el tamano declarado debe coincidir con la fotografia")
    public boolean isDeclaredSizeConsistent() {
        return photo == null || sizeBytes == photo.length;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Report getReport() {
        return report;
    }

    public void setReport(Report report) {
        this.report = report;
    }

    public byte[] getPhoto() {
        return photo == null ? null : photo.clone();
    }

    public void setPhoto(byte[] photo) {
        this.photo = photo == null ? null : photo.clone();
        this.sizeBytes = photo == null ? 0 : photo.length;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public int getSizeBytes() {
        return sizeBytes;
    }

    public byte[] getSha256() {
        return sha256 == null ? null : sha256.clone();
    }

    public void setSha256(byte[] sha256) {
        this.sha256 = sha256 == null ? null : sha256.clone();
    }

    public Boolean getMetadataConsistent() {
        return metadataConsistent;
    }

    public void setMetadataConsistent(Boolean metadataConsistent) {
        this.metadataConsistent = metadataConsistent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
