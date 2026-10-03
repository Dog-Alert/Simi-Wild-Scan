-- ============================================================================
-- U1.3 · Revertir actividad, conservación y trazabilidad en bitácora
-- ============================================================================
--
-- Deshace EXACTAMENTE lo que hizo `V1.3__reportes_idempotencia_actividad_conservacion.sql`.
--
-- Spec:      SDD/docs/sdd/06_offline_sincronizacion.md
-- Planning:  .agents/C3-PLANNING.md §5 (columna «Reversión»)
--
-- ---------------------------------------------------------------------------
-- ADVERTENCIA
-- ---------------------------------------------------------------------------
-- Este script DESTRUYE datos de forma irreversible:
--   · `Motivo_Eliminacion` no es recuperable: no existe en ninguna otra tabla.
--   · `Fecha_Conservacion_Hasta` es derivable de `Fecha_Creacion` y sí puede
--     recalcularse, pero aquí se descarta.
--   · `Datos_Anonimizados` y `Fecha_Anonimizacion` marcan qué cuentas ya fueron
--     limpiadas por el trabajo de retención. Al perderlas, el trabajo vuelve a
--     seleccionar esas cuentas.
--
--   No ejecutar en la instancia compartida de Cloud SQL. Se reserva para
--   pruebas locales o bases desechables.
--
--   `U1.5` y `U1.6` deben revertirse ANTES que este script, y `U1.4` también:
--   el orden inverso de aplicación es U1.6 → U1.5 → U1.4 → U1.3.
--
-- ---------------------------------------------------------------------------
-- NO REVIERTE NADA DE IDEMPOTENCIA
-- ---------------------------------------------------------------------------
-- Este script ya no elimina `Clave_Idempotencia` ni `Hash_Payload`: la versión
-- vigente de `V1.3` no las crea (ver su §0). La idempotencia vive en la tabla
-- `idempotencia_reportes`, que crean `V1.4` y `U1.4`.
-- ============================================================================

USE dogalert;

-- ----------------------------------------------------------------------------
-- 0. Guardia · comprobar ANTES de tocar nada
-- ----------------------------------------------------------------------------
--
-- Restaura `ID_Usuario_Admin INT NOT NULL`, como estaba en `V1.1`.
--
-- V1.3 lo volvió NULLable para que el job de anonimización (SCRUM-247)
-- pudiera registrar filas sin actor administrativo. Si el job ya corrió, hay
-- filas con `ID_Usuario_Admin IS NULL` y esta reversión NO puede completarse:
-- MySQL devolvería el error 1138 (ER_BAD_NULL_ERROR) y la tabla quedaría a
-- medias, con las columnas de C3 ya eliminadas.
--
-- Por eso la comprobación va PRIMERO, antes de cualquier DDL. Si no puede
-- terminar, el script aborta sin haber modificado nada.
--
-- Las opciones, en ese caso, son (a) decidir qué actor administrativo se
-- imputa a la anonimización o (b) conservar el cambio de V1.3 y no ejecutar
-- esta reversión.

SET @bitacora_sin_actor := (
    SELECT COUNT(*) FROM Bitacora_Administrativa WHERE ID_Usuario_Admin IS NULL
);

SET @sql := IF(
    @bitacora_sin_actor = 0,
    -- Rama de éxito: no-op. El MODIFY real va en §2.
    'SELECT ''c3_u13_precondicion_ok'' AS aviso',
    -- Referencia deliberada a una tabla inexistente: aborta el script con un
    -- error 1146 cuyo texto indica qué hacer. Es la alternativa a SIGNAL,
    -- que MySQL solo admite dentro de programas almacenados.
    'SELECT * FROM c3_no_revertir_bitacora_con_actores_nulos'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------------------
-- 1. Preflight
-- ----------------------------------------------------------------------------
--
-- Debe devolver 0 filas. Si no, hay filas de bitácora escritas por el job de
-- anonimización y la reversión de §2 no puede completarse (ERROR 1138).
--
-- La comprobación tiene su propia guardia en §0, que aborta antes de tocar
-- nada. Se repite aquí para que el diagnóstico sea legible.

SELECT ID_Bitacora, Tipo_Accion, Fecha
FROM Bitacora_Administrativa
WHERE ID_Usuario_Admin IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Bitacora_Administrativa
-- ----------------------------------------------------------------------------
--
-- Orden obligatorio: primero la FK, luego las columnas. MySQL no permite
-- eliminar una columna que una FK vigente referencia.

ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_reporte,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Bitacora_Administrativa
    DROP CHECK ck_bitacora_resultado,
    ALGORITHM=INPLACE, LOCK=NONE;

-- Los dos MODIFY reconstruyen la tabla, así que van juntos: una sola
-- reconstrucción, un solo LOCK de escritura. Ninguno admite
-- `ALGORITHM=INPLACE, LOCK=NONE`; requieren ≈2× el tamaño de la tabla en
-- disco libre y ventana de baja carga.
ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NOT NULL,
    MODIFY COLUMN Tipo_Accion
        ENUM('CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO') NOT NULL;

-- DROP COLUMN es siempre INPLACE y admite Lock=NONE: no reconstruye.
ALTER TABLE Bitacora_Administrativa
    DROP COLUMN Resultado,
    DROP COLUMN Codigo_Error,
    DROP COLUMN Fecha_Accion,
    DROP COLUMN ID_Reporte,
    ALGORITHM=INPLACE, LOCK=NONE;

-- ----------------------------------------------------------------------------
-- 2. Reportes
-- ----------------------------------------------------------------------------
--
-- `DROP COLUMN` es siempre INPLACE y admite Lock=NONE: no reconstruye.

ALTER TABLE Reportes
    DROP COLUMN Fecha_Actualizacion,
    DROP COLUMN Fecha_Eliminacion,
    DROP COLUMN Motivo_Eliminacion,
    DROP COLUMN Fecha_Conservacion_Hasta,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Fecha_Anonimizacion,
    DROP COLUMN Version_Registro,
    ALGORITHM=INPLACE, LOCK=NONE;

-- ----------------------------------------------------------------------------
-- 3. Verificación posterior
-- ----------------------------------------------------------------------------
--
-- Ambas consultas deben devolver 0 filas.
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

-- `Reportes` y `Bitacora_Administrativa` deben haber vuelto al estado de V1.2.
-- Se conservan `idx_reportes_status` e `idx_reportes_fecha` (V1.2), y
-- `Bitacora_Administrativa` conserva la FK heredada `fk_bitacora_registro`
-- hacia `Registros`, que V1.3 no tocó.
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME IN ('ID_Usuario_Admin', 'Tipo_Accion');
