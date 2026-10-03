-- ============================================================================
-- U1.5 · Revertir el índice de retención de cuentas
-- ============================================================================
--
-- Deshace EXACTAMENTE lo que hizo `V1.5__indice_retencion_cuentas.sql`.
--
-- Jira:      DOG-35
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA
-- ---------------------------------------------------------------------------
-- Perder este índice no pierde datos, pero degrada de inmediato el barrido de
-- anonimización: la consulta pasa a un escaneo completo de `Usuarios`.
--
-- Condicional por el mismo motivo que en V1.5 §2: si el índice nunca se creó
-- (porque faltaban columnas), este `DROP` fallaría con ERROR 1091 y dejaría la
-- reversión a medias.
--
-- Orden inverso de aplicación: U1.6 → U1.5 → U1.4 → U1.3.
--
-- Este script NO debe ejecutarse en la instancia compartida de Cloud SQL.
-- ============================================================================

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

-- ----------------------------------------------------------------------------
-- Verificación posterior
-- ----------------------------------------------------------------------------
--
-- Debe devolver 0 filas.
SELECT INDEX_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND INDEX_NAME = 'idx_usuarios_anonimizacion';