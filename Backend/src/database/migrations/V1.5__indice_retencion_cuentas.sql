USE dogalert;

SELECT COUNT(*) AS columnas_para_el_indice
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN ('Datos_Anonimizados', 'Ultimo_Login', 'Estado_Cuenta');

SET @columnas_retener := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME IN ('Datos_Anonimizados', 'Ultimo_Login', 'Estado_Cuenta')
);

SET @indice_ya_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Usuarios'
      AND INDEX_NAME = 'idx_usuarios_anonimizacion'
);

SET @sql := IF(
    @columnas_retener = 3 AND @indice_ya_existe = 0,
    'CREATE INDEX idx_usuarios_anonimizacion ON Usuarios (Datos_Anonimizados, Ultimo_Login), ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''DOG-35: idx_usuarios_anonimizacion OMITIDO. Columnas o indice inconsistentes. Aplicar V1.4 y revisar.'' AS aviso'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


SELECT COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND INDEX_NAME = 'idx_usuarios_anonimizacion'
ORDER BY SEQ_IN_INDEX;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN ('Ultimo_Login', 'Ultima_Actividad', 'Datos_Anonimizados');