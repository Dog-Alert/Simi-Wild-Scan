USE dogalert;

ALTER TABLE Reportes
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Reportes
    ADD COLUMN Fecha_Eliminacion TIMESTAMP NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Reportes
    ADD COLUMN Motivo_Eliminacion VARCHAR(200) NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Reportes
    ADD COLUMN Version_Registro INT NOT NULL DEFAULT 0,
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Reportes
    ADD COLUMN Fecha_Conservacion_Hasta DATE NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;


UPDATE Reportes
SET Fecha_Conservacion_Hasta = DATE_ADD(DATE(Fecha_Creacion), INTERVAL 5 YEAR)
WHERE Fecha_Conservacion_Hasta IS NULL;


ALTER TABLE Reportes
    ADD COLUMN Datos_Anonimizados BOOLEAN NOT NULL DEFAULT FALSE,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Reportes
    ADD COLUMN Fecha_Anonimizacion TIMESTAMP NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NULL DEFAULT NULL,
    MODIFY COLUMN Tipo_Accion
        ENUM('CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO',
             'SINCRONIZACION', 'ANONIMIZACION') NOT NULL;

ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Resultado VARCHAR(20) NOT NULL DEFAULT 'OK',
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT ck_bitacora_resultado
        CHECK (Resultado IN ('OK', 'RECHAZADO', 'ERROR')),
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Codigo_Error VARCHAR(60) NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Fecha_Accion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Bitacora_Administrativa
    ADD COLUMN ID_Reporte BIGINT NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT fk_bitacora_reporte
        FOREIGN KEY (ID_Reporte) REFERENCES Reportes(ID_Reporte)
        ON DELETE SET NULL,
    ALGORITHM=INPLACE, LOCK=NONE;


SELECT COUNT(*) AS nulos
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL;


SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME IN (
      'Fecha_Actualizacion', 'Fecha_Eliminacion', 'Motivo_Eliminacion',
      'Fecha_Conservacion_Hasta', 'Datos_Anonimizados', 'Fecha_Anonimizacion',
      'Version_Registro'
  );


SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME IN ('Clave_Idempotencia', 'Hash_Payload');

SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME = 'Tipo_Accion';
