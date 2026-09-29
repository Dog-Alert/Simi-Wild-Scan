USE dogalert;

CREATE TABLE IF NOT EXISTS Reportes (
    ID_Reporte BIGINT AUTO_INCREMENT PRIMARY KEY,
    ID_Reporte_Cliente CHAR(36) NOT NULL UNIQUE,
    ID_Usuario INT NULL,
    Fecha_Evento TIMESTAMP NOT NULL,
    Tipo_Evento VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    certainty VARCHAR(20) NOT NULL,
    Cantidad_Perros INT NOT NULL,
    size VARCHAR(20) NOT NULL,
    color VARCHAR(120),
    Color_Indeterminado BOOLEAN NOT NULL,
    collar VARCHAR(20) NOT NULL,
    Descripcion VARCHAR(2000) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    Poligono_Version VARCHAR(50) NOT NULL,
    Tiene_Foto BOOLEAN NOT NULL,
    Consentimiento_Aceptado BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL,
    Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reportes_usuario FOREIGN KEY (ID_Usuario)
        REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL
);

CREATE INDEX idx_reportes_status ON Reportes(status);
CREATE INDEX idx_reportes_fecha ON Reportes(Fecha_Evento);

CREATE TABLE IF NOT EXISTS Evidencias_Reportes (
    ID_Evidencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    ID_Reporte BIGINT NOT NULL,
    Foto LONGBLOB NOT NULL,
    Tipo_MIME VARCHAR(50) NOT NULL,
    Tamano_Bytes INT UNSIGNED NOT NULL,
    SHA256 BINARY(32) NOT NULL,
    Metadatos_Coherentes BOOLEAN NULL,
    Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_evidencias_reporte UNIQUE (ID_Reporte),
    CONSTRAINT fk_evidencias_reporte FOREIGN KEY (ID_Reporte)
        REFERENCES Reportes(ID_Reporte) ON DELETE CASCADE,
    CONSTRAINT ck_evidencias_tamano
        CHECK (Tamano_Bytes BETWEEN 1 AND 1048576),
    CONSTRAINT ck_evidencias_mime
        CHECK (Tipo_MIME IN ('image/jpeg', 'image/png', 'image/heic'))
);

CREATE INDEX idx_evidencias_sha256 ON Evidencias_Reportes(SHA256);

CREATE TABLE IF NOT EXISTS Poligonos_Creel (
    Poligono_Version VARCHAR(50) PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    GeoJSON JSON NOT NULL,
    SHA256 CHAR(64) NOT NULL UNIQUE,
    Activo BOOLEAN NOT NULL DEFAULT FALSE,
    Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
