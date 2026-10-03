USE dogalert;

SET @indice_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Usuarios'
      AND INDEX_NAME = 'idx_usuarios_anonimizacion'
);

SET @sql := IF(
    @indice_existe > 0,
    'ALTER TABLE Usuarios DROP INDEX idx_usuarios_anonimizacion, ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''DOG-35: idx_usuarios_anonimizacion no existe. Omitido.'' AS aviso'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT INDEX_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND INDEX_NAME = 'idx_usuarios_anonimizacion';