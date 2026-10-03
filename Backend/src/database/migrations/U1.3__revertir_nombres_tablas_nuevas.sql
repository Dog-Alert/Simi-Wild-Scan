USE dogalert;

-- Reversion estructural de V1.3 para una base local o desechable.
-- Recrea Registros y Fotos, restaura la relacion anterior de la bitacora y
-- revierte los nombres de las tablas nuevas.
--
-- IMPORTANTE: este script no puede recuperar filas eliminadas por V1.3.

ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_reporte;

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
        FOREIGN KEY (ID_Usuario)
        REFERENCES Usuarios(ID_Usuario)
        ON DELETE SET NULL
);

CREATE SPATIAL INDEX idx_registros_location ON Registros(Location);
CREATE INDEX idx_registros_fecha ON Registros(Fecha);
CREATE INDEX idx_registros_status ON Registros(Report_Status);

CREATE TABLE IF NOT EXISTS Fotos (
    ID_Fotos INT AUTO_INCREMENT PRIMARY KEY,
    ID_Registro INT NOT NULL,
    Foto_URL VARCHAR(255) NOT NULL,
    CONSTRAINT fk_fotos_registro
        FOREIGN KEY (ID_Registro)
        REFERENCES Registros(ID_Registro)
        ON DELETE CASCADE
);

ALTER TABLE Bitacora_Administrativa
    CHANGE COLUMN ID_Reporte ID_Registro INT NULL;

ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT fk_bitacora_registro
        FOREIGN KEY (ID_Registro)
        REFERENCES Registros(ID_Registro)
        ON DELETE SET NULL;

SET @dogalert_rename_poligonos = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'poligonos_creel'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Poligonos_Creel'
        ),
        'RENAME TABLE `poligonos_creel` TO `Poligonos_Creel`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_poligonos;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;

SET @dogalert_rename_evidencias = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'evidencias_reportes'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Evidencias_Reportes'
        ),
        'RENAME TABLE `evidencias_reportes` TO `Evidencias_Reportes`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_evidencias;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;

SET @dogalert_rename_reportes = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'reportes'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Reportes'
        ),
        'RENAME TABLE `reportes` TO `Reportes`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_reportes;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;
