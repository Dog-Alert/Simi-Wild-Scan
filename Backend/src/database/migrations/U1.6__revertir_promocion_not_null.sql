-- ============================================================================
-- U1.6 · Revertir la promoción a NOT NULL (vuelve a la Fase 1)
-- ============================================================================
--
-- Deshace EXACTAMENTE lo que hizo `V1.6__promover_conservacion_not_null.sql`.
--
-- Jira:      DOG-35
--
-- ---------------------------------------------------------------------------
-- OPERATIVA
-- ---------------------------------------------------------------------------
-- Devuelve `Fecha_Conservacion_Hasta` al estado NULLable de V1.3. No tiene
-- precondiciones: siempre es seguro ejecutarlo.
--
-- ADVERTENCIA: requiere ≈2× el tamaño de `Reportes` en disco libre y toma un
-- `LOCK` de escritura, igual que el `ALTER` que revierte. Ventana de baja
-- carga.
--
-- ADVERTENCIA 2: revertir V1.6 NO borra datos. Solo deja de ser obligatorio
-- conocer `Fecha_Conservacion_Hasta`. Si el backend del ticket siguiente está
-- desplegado y escribe esa columna, mantenerla NOT NULL es lo correcto:
--
--   · volver a NULLable no rompe nada,
--   · pero un despliegue futuro que la vuelva a omitir volvería a fallar con
--     error 1048 en vez de ser detectado por el esquema.
--
-- Orden inverso de aplicación: U1.6 → U1.5 → U1.4 → U1.3.
--
-- Este script NO debe ejecutarse en la instancia compartida de Cloud SQL.
-- ============================================================================

USE dogalert;

ALTER TABLE Reportes
    MODIFY COLUMN Fecha_Conservacion_Hasta DATE NULL DEFAULT NULL;

-- ----------------------------------------------------------------------------
-- Verificación posterior
-- ----------------------------------------------------------------------------
--
-- Debe devolver `YES` en `IS_NULLABLE` y `NULL` en `COLUMN_DEFAULT`.

SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME = 'Fecha_Conservacion_Hasta';