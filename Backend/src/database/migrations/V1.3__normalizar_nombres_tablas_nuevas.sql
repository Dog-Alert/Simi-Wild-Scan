USE dogalert;

-- Normaliza los nombres de las tablas nuevas de DOG-30 y retira las tablas
-- heredadas Registros y Fotos, despues de redirigir la bitacora a reportes.
-- Usuarios se conserva porque continua siendo la tabla de cuentas referenciada
-- por V1.0 y V1.2.
--
-- En instalaciones con lower_case_table_names distinto de 0 (por ejemplo,
-- MySQL sobre Windows), MySQL ya conserva estos nombres en minusculas y cada
-- bloque se convierte en una operacion sin cambios.
--
-- PRECONDICION: Registros, Fotos y Bitacora_Administrativa deben estar vacias.
-- Esta condicion debe comprobarse en DBeaver antes de ejecutar la migracion.

SET @dogalert_rename_reportes = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Reportes'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'reportes'
        ),
        'RENAME TABLE `Reportes` TO `reportes`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_reportes;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;

SET @dogalert_rename_evidencias = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Evidencias_Reportes'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'evidencias_reportes'
        ),
        'RENAME TABLE `Evidencias_Reportes` TO `evidencias_reportes`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_evidencias;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;

SET @dogalert_rename_poligonos = (
    SELECT IF(
        @@lower_case_table_names = 0
        AND EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'Poligonos_Creel'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND BINARY table_name = BINARY 'poligonos_creel'
        ),
        'RENAME TABLE `Poligonos_Creel` TO `poligonos_creel`',
        'SELECT 1'
    )
);
PREPARE dogalert_stmt FROM @dogalert_rename_poligonos;
EXECUTE dogalert_stmt;
DEALLOCATE PREPARE dogalert_stmt;

-- La bitacora deja de depender del modelo heredado y pasa a relacionarse con
-- la tabla oficial de reportes.
ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_registro;

ALTER TABLE Bitacora_Administrativa
    CHANGE COLUMN ID_Registro ID_Reporte BIGINT NULL;

ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT fk_bitacora_reporte
        FOREIGN KEY (ID_Reporte)
        REFERENCES reportes(ID_Reporte)
        ON DELETE SET NULL;

-- Fotos debe eliminarse antes que Registros porque contiene su llave foranea.
DROP TABLE IF EXISTS Fotos;
DROP TABLE IF EXISTS Registros;
