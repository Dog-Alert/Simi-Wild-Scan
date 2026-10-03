USE dogalert;



SELECT COUNT(*) AS columna_presente
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME = 'Fecha_Conservacion_Hasta';



SELECT COUNT(*) AS nulos_conservacion
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL;


SELECT ID_Reporte, ID_Reporte_Cliente, status, Fecha_Creacion
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL
ORDER BY ID_Reporte;



SET @nulos_pendientes := (
    SELECT COUNT(*)
    FROM Reportes
    WHERE Fecha_Conservacion_Hasta IS NULL
);

SET @sql := IF(
    @nulos_pendientes = 0,
    'SELECT ''dog35_v6_precondicion_ok'' AS aviso',

    'SELECT * FROM dog35_v6_faltan_nulls_despliegue_el_backend_antes_de_promover'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


ALTER TABLE Reportes
    MODIFY COLUMN Fecha_Conservacion_Hasta DATE NOT NULL;



SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME = 'Fecha_Conservacion_Hasta';