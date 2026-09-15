USE dogalert;

-- Tabla de Registros / Incidentes
CREATE TABLE IF NOT EXISTS Registros (
    ID_Registro INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario INT,
    Fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Location POINT NOT NULL SRID 4326,
    TipoIncidente VARCHAR(50),
    Descripcion TEXT,
    Cantidad INT DEFAULT 1,
    Tamano VARCHAR(20),
    Color VARCHAR(50),
    Presencia_de_collar TINYINT(1),
    Certeza VARCHAR(20),
    Report_Status VARCHAR(20),
    Sync_Status VARCHAR(20),
    CONSTRAINT fk_registros_usuario 
        FOREIGN KEY (ID_Usuario) REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL
);

-- Índices iniciales para optimizar consultas frecuentes
CREATE SPATIAL INDEX idx_registros_location ON Registros(Location);
CREATE INDEX idx_registros_fecha ON Registros(Fecha);
CREATE INDEX idx_registros_status ON Registros(Report_Status);

-- Tabla de Fotos
CREATE TABLE IF NOT EXISTS Fotos (
    ID_Fotos INT AUTO_INCREMENT PRIMARY KEY,
    ID_Registro INT NOT NULL,
    Foto_URL VARCHAR(255) NOT NULL,
    CONSTRAINT fk_fotos_registro 
        FOREIGN KEY (ID_Registro) REFERENCES Registros(ID_Registro) ON DELETE CASCADE
);

-- Bitacora Administrativa
CREATE TABLE IF NOT EXISTS Bitacora_Administrativa (
    ID_Bitacora INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario_Admin INT NOT NULL,
    ID_Registro INT,
    Fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Tipo_Accion ENUM('CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO') NOT NULL,
    Detalles TEXT,
    CONSTRAINT fk_bitacora_admin 
        FOREIGN KEY (ID_Usuario_Admin) REFERENCES Usuarios(ID_Usuario),
    CONSTRAINT fk_bitacora_registro 
        FOREIGN KEY (ID_Registro) REFERENCES Registros(ID_Registro) ON DELETE SET NULL
);