-- ============================================================================
-- V1.5 · Índice de retención de cuentas (DOG-35 · parte 3)
-- ============================================================================
--
-- Spec:      SDD/docs/sdd/09_seguridad_privacidad.md §9.5
-- Jira:      DOG-35 · RF-044 (anonimizar PII tras 12 meses sin login exitoso)
-- Depende de: V1.4 aplicada, porque es el requisito D el que crea en
--             `Usuarios` las columnas que este índice necesita.
--
-- ---------------------------------------------------------------------------
-- 1 · POR QUÉ `(Datos_Anonimizados, Ultimo_Login)` Y NO LO QUE DECÍA EL SDD
-- ---------------------------------------------------------------------------
-- El SDD 09.5 propone `IX_Usuarios_Retencion` sobre
-- `(Datos_Anonimizados, Ultima_Actividad)`. **Ese índice no sirve para esta
-- consulta**, por dos motivos que están medidos:
--
--   1. El criterio de corte usa `COALESCE(Ultimo_Login, Fecha_Creacion)`, no
--      `Ultima_Actividad`. RF-044 habla de «inicio de sesión exitoso», y
--      `Ultima_Actividad` mediría otra cosa. Además `Ultima_Actividad` está
--      bloqueada en el login: ninguna petición la actualiza, así que sería un
--      criterio ENGAÑOSO.
--
--   2. Un índice sobre `Ultima_Actividad` no cubre una expresión con
--      `COALESCE`, así que el optimizador no lo puede usar para el rango.
--
-- Por eso este índice va sobre `(Datos_Anonimizados, Ultimo_Login)`:
-- `Datos_Anonimizados` es la condición de igualdad y `Ultimo_Login` la del
-- rango. El `COALESCE` sigue sin estar cubierto, y eso está asumido: mientras
-- el volumen de usuarios sea de MVP no urge. Si crece, el DBA debería valorar
-- un índice funcional sobre `COALESCE(Ultimo_Login, Fecha_Creacion)`.
--
-- ---------------------------------------------------------------------------
-- 2 · EL SDD MARCA ESTE ÍNDICE COMO PENDIENTE Y NO COMO EXIGENTE
-- ---------------------------------------------------------------------------
-- El índice es una mejora de rendimiento sobre una operación que ya funciona
-- con escaneo completo. Por eso se crea de forma CONDICIONAL: si faltan
-- columnas, se avisa en vez de abortar, para no dejar V1.5 aplicada a medias.
--
-- ---------------------------------------------------------------------------
-- 3 · QUÉ NO HACE ESTA VERSIÓN
-- ---------------------------------------------------------------------------
--   · No anonimiza a nadie. Solo deja el índice que necesitará el trabajo
--     programado cuando se implemente.
--   · No borra reportes por antigüedad. `dogalert.retention.min-report-years`
--     (5 años, RF-043) está declarada pero sin usar: OPEN-005 sigue abierta.
--   · No escribe en `Bitacora_Administrativa`. La parte de auditoría de
--     RNF-PRI-05 y RF-042 depende del requisito B de V1.4, y sigue pendiente.
--   · No pide llave distribuida. Cloud Run escala horizontalmente, así que el
--     cron puede dispararse en varias réplicas a la vez. Es aceptable porque la
--     operación es idempotente, pero duplica trabajo. Si las réplicas crecen,
--     hará falta quartz o shedlock.
-- ============================================================================

USE dogalert;

-- ============================================================================
-- 1. Preflight
-- ============================================================================
--
-- Debe devolver 3. Si devuelve menos, falta el requisito D de
-- `V1.4__sincronizacion_idempotencia_reportes_propios.sql` y este script no
-- debe ejecutarse.

SELECT COUNT(*) AS columnas_para_el_indice
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN ('Datos_Anonimizados', 'Ultimo_Login', 'Estado_Cuenta');
-- Debe devolver 3.

-- ============================================================================
-- 2. Índice de retención (condicional)
-- ============================================================================
--
-- `Estado_Cuenta` entra porEquality y no por rango, así que va después de
-- `Datos_Anonimizados`: el orden de las columnas de igualdad es por
-- selectividad, y `Datos_Anonimizados` tiene dos valores frente a los tres de
-- `Estado_Cuenta`.
--
-- Se omite con aviso si faltan columnas o si el índice ya existe (por ejemplo,
-- si `ddl-auto=update` lo creó desde una entidad futura).

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

-- Si la línea anterior devuelve `aviso`, el índice se crea con este comando,
-- previa reconciliación de las columnas que falten:
--
--   CREATE INDEX idx_usuarios_anonimizacion
--       ON Usuarios (Datos_Anonimizados, Ultimo_Login),
--       ALGORITHM=INPLACE, LOCK=NONE;

-- ============================================================================
-- 3. Verificación posterior
-- ============================================================================

-- Debe devolver 3 filas si el índice se creó, 0 si se omitió.
SELECT COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND INDEX_NAME = 'idx_usuarios_anonimizacion'
ORDER BY SEQ_IN_INDEX;
-- Orden esperado: Datos_Anonimizados, Ultimo_Login.

-- Recordatorio de por qué NO es `Ultima_Actividad`: `Ultima_Actividad` no la
-- actualiza ninguna petición, así que un índice sobre ella daría la impresión
-- de que el corte está medido y no lo está.
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN ('Ultimo_Login', 'Ultima_Actividad', 'Datos_Anonimizados');