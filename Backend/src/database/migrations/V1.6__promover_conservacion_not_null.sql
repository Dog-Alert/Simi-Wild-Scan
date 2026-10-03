-- ============================================================================
-- V1.6 · Fase 2 — promover `Fecha_Conservacion_Hasta` a NOT NULL
-- ============================================================================
--
-- Spec:      SDD/docs/sdd/03_modelo_dominio_datos.md §3.6 (invariantes)
-- Jira:      DOG-35 · RF-043 (conservar 5 años)
-- Depende de: V1.3, V1.4 y V1.5 aplicadas.
--
-- ###########################################################################
-- #  NO APLICAR TODAVÍA · ESTA VERSIÓN TIENE UNA PRECONDICIÓN DE DESPLIEGUE  #
-- ###########################################################################
--
-- V1.3 añadió `Fecha_Conservacion_Hasta` como NULLable, con backfill, para que
-- la aplicación vigente siguiera funcionando: `Report.java` todavía NO mapea
-- esa columna, y con `ddl-auto=update` un INSERT de Hibernate que omita una
-- columna NOT NULL sin default falla con error 1048, con lo que la creación de
-- reportes se detendría por completo.
--
-- Esta versión cierra ese provisional. **Solo debe aplicarse cuando el backend
-- del ticket siguiente ya mapee `Fecha_Conservacion_Hasta` y la escriba en
-- cada INSERT.** Ese mapeo es el que rellena los NULL que este script exige que
-- no queden.
--
-- En una base con la aplicación antigua desplegada, las filas creadas desde
-- V1.3 tendrán la columna en NULL y este script ABORTA a propósito (ver §3).
-- Es el comportamiento correcto: es preferible no promover y seguir con la
-- Fase 1, que es funcional, a promover y romper la API.
--
-- ---------------------------------------------------------------------------
-- ALCANCE REDUCIDO
-- ---------------------------------------------------------------------------
-- Una versión anterior de este script promovía tres columnas a NOT NULL:
-- `Clave_Idempotencia`, `Hash_Payload` y `Fecha_Conservacion_Hasta`. Las dos
-- primeras ya no existen: la idempotencia vive en la tabla
-- `idempotencia_reportes` (requisito A de V1.4), donde `Hash_Payload` nace
-- NOT NULL y no necesita backfill. Ver §0 de `V1.3`.
--
-- ---------------------------------------------------------------------------
-- C3-D8 SE MANTIENE
-- ---------------------------------------------------------------------------
-- `Fecha_Conservacion_Hasta` NOT NULL no implica borrado automático. OPEN-005
-- sigue abierta y el SDD 09.5 dice que el MVP no borra al cumplir los cinco
-- años.
--
-- ---------------------------------------------------------------------------
-- OPERATIVA DE LA VERSIÓN
-- ---------------------------------------------------------------------------
--   · `MODIFY ... NOT NULL` admite `ALGORITHM=INPLACE` pero NO `LOCK=NONE`
--     (MySQL necesita bloquear para validar que no hay NULL), así que el
--     `LOCK` se deja explícitamente sin forzar. Requiere ≈2× el tamaño de
--     `Reportes` en disco libre y ventana de baja carga.
--   · La definición de la columna se repite completa y SIN default: es lo que
--     impide que una futura omisión vuelva a pasar inadvertida.
-- ============================================================================

USE dogalert;

-- ============================================================================
-- 1. Preflight · la columna debe existir
-- ============================================================================
--
-- Debe devolver 1. Si devuelve 0, falta aplicar V1.3.

SELECT COUNT(*) AS columna_presente
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME = 'Fecha_Conservacion_Hasta';

-- ============================================================================
-- 2. Diagnóstico · qué filas siguen con NULL
-- ============================================================================
--
-- Debe devolver 0 para poder continuar.

SELECT COUNT(*) AS nulos_conservacion
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL;

-- Las filas con NULL son las creadas por la aplicación antigua desde que se
-- aplicó V1.3. Se listan para dimensionar el trabajo.
SELECT ID_Reporte, ID_Reporte_Cliente, status, Fecha_Creacion
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL
ORDER BY ID_Reporte;

-- ============================================================================
-- 3. Guardia · aborta si queda algún NULL
-- ============================================================================
--
-- Se evalúa UNA sola vez, antes de tocar la tabla, en vez de promover y
-- fallar a mitad.

SET @nulos_pendientes := (
    SELECT COUNT(*)
    FROM Reportes
    WHERE Fecha_Conservacion_Hasta IS NULL
);

SET @sql := IF(
    @nulos_pendientes = 0,
    -- Rama de éxito: no-op. El ALTER real va en §4.
    'SELECT ''dog35_v6_precondicion_ok'' AS aviso',
    -- Referencia deliberada a una tabla inexistente: aborta el script con
    -- error 1146 y el nombre de la tabla aparece como motivo. Es la
    -- alternativa a SIGNAL, que MySQL solo admite dentro de programas
    -- almacenados.
    'SELECT * FROM dog35_v6_faltan_nulls_despliegue_el_backend_antes_de_promover'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 4. Promoción
-- ============================================================================

ALTER TABLE Reportes
    MODIFY COLUMN Fecha_Conservacion_Hasta DATE NOT NULL;

-- ============================================================================
-- 5. Verificación posterior
-- ============================================================================
--
-- Debe devolver `NO` en `IS_NULLABLE` y `NULL` en `COLUMN_DEFAULT`.

SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME = 'Fecha_Conservacion_Hasta';