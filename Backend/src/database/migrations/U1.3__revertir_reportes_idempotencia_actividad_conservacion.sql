USE dogalert;



SET @bitacora_sin_actor := (
    SELECT COUNT(*) FROM Bitacora_Administrativa WHERE ID_Usuario_Admin IS NULL
);

SET @sql := IF(
    @bitacora_sin_actor = 0,
    'SELECT ''c3_u13_precondicion_ok'' AS aviso',
    'SELECT * FROM c3_no_revertir_bitacora_con_actores_nulos'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;



SELECT ID_Bitacora, Tipo_Accion, Fecha
FROM Bitacora_Administrativa
WHERE ID_Usuario_Admin IS NULL;



ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_reporte,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Bitacora_Administrativa
    DROP CHECK ck_bitacora_resultado,
    ALGORITHM=INPLACE, LOCK=NONE;


ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NOT NULL,
    MODIFY COLUMN Tipo_Accion
        ENUM('CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO') NOT NULL;


ALTER TABLE Bitacora_Administrativa
    DROP COLUMN Resultado,
    DROP COLUMN Codigo_Error,
    DROP COLUMN Fecha_Accion,
    DROP COLUMN ID_Reporte,
    ALGORITHM=INPLACE, LOCK=NONE;



ALTER TABLE Reportes
    DROP COLUMN Fecha_Actualizacion,
    DROP COLUMN Fecha_Eliminacion,
    DROP COLUMN Motivo_Eliminacion,
    DROP COLUMN Fecha_Conservacion_Hasta,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Fecha_Anonimizacion,
    DROP COLUMN Version_Registro,
    ALGORITHM=INPLACE, LOCK=NONE;


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
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME IN (
      'ID_Reporte', 'Fecha_Accion', 'Resultado', 'Codigo_Error'
  );
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME IN ('ID_Usuario_Admin', 'Tipo_Accion');
