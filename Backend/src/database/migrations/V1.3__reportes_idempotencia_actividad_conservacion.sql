-- ============================================================================
-- V1.3 · Actividad, conservación y trazabilidad en bitácora (C3 · capa de datos)
-- ============================================================================
--
-- Spec:      SDD/docs/sdd/06_offline_sincronizacion.md
-- Planning:  .agents/C3-PLANNING.md  §3.1, §3.2, §5
-- Jira:      SCRUM-103 (épica), SCRUM-223 (idempotencia), SCRUM-219 (HU-05),
--            SCRUM-247 (anonimización)
--
-- Decisiones aplicadas:
--   DOG-35 La idempotencia NO vive en `Reportes`. Las columnas
--          `Clave_Idempotencia` y `Hash_Payload` que esta versión preveía se
--          sustituyen por la tabla `idempotencia_reportes`, que crea V1.4.
--          Ver §0.
--   C3-D6  `Hash_Payload` en la tabla de idempotencia es NOT NULL desde su
--          creación: al no haber backfill pendiente, no hace falta ninguna
--          fase NULLable. Por eso V1.5 y V1.6 ya no lo tocan.
--   C3-D8  Solo la columna `Fecha_Conservacion_Hasta`. NO hay borrado
--          automático: OPEN-005 sigue abierta (09.5 dice «no borrar»).
--   C3-D9  El job de anonimización (SCRUM-247) usa las columnas de esta
--          versión; no se implementa ningún borrado de datos.
--   C3-D10 `ddl-auto=update` sigue activo durante C3.
--
-- PRIVACIDAD (SDD 09.4 / 09.5)
--   `Bitacora_Administrativa` NO debe recibir descripción, coordenadas,
--   correo, teléfono ni fotografía. Solo código, resultado y `requestId`.
--   `Motivo_Eliminacion` es texto redactado por el usuario, nunca la
--   descripción del reporte.
--
-- ---------------------------------------------------------------------------
-- §0 · LA IDEMPOTENCIA SE CAMBIA DE SITIO
-- ---------------------------------------------------------------------------
-- Una versión anterior de este script añadía a `Reportes` dos columnas:
-- `Clave_Idempotencia CHAR(36)` con su `uq_reportes_idempotencia UNIQUE`, y
-- `Hash_Payload CHAR(64) NULL`. Ya NO se crean.
--
-- El motivo es concreto: al borrado físico de un reporte por parte de su autor
-- (RF-026, `DELETE /v1/me/reports/{id}`) la fila de `Reportes` desaparece
-- entera. El UUID quedaría libre y un reintento posterior del cliente volvería
-- a crear el reporte, lo que rompe el criterio de aceptación «Los reintentos
-- no duplican reportes».
--
-- La llave y el hash pasan a la tabla `idempotencia_reportes`, que crea
-- `V1.4__sincronizacion_idempotencia_reportes_propios.sql` (requisito A del
-- contrato de DOG-35). Ahí la fila sobrevive al borrado con `ID_Reporte` en
-- NULL: el UUID queda consumido y el reintento responde `410 REPORT_DELETED` en
-- lugar de 200.
--
-- Lo que esta versión conserva de la idempotencia es `ID_Reporte_Cliente`, que
-- V1.2 ya creó con `UNIQUE` y que sigue siendo la garantía de no duplicar
-- mientras la tabla del requisito A no exista.
--
-- ---------------------------------------------------------------------------
-- FASE 1 DE 2 — ESTA VERSIÓN NO ROMPE LA APLICACIÓN ACTUAL
-- ---------------------------------------------------------------------------
--   `Fecha_Conservacion_Hasta` se crea NULLable y con backfill, NO como NOT
--   NULL. Motivo: `Report.java` todavía no mapea esta columna (el mapeo llega
--   con el ticket de backend). Con `ddl-auto=update`, un INSERT de Hibernate
--   que omita una columna NOT NULL sin default falla con error 1048 y
--   DETENDRÍA la creación de reportes.
--
--   La promoción a NOT NULL es la fase 2 y vive en `V1.6`. Aplicar V1.3 a
--   V1.5 es seguro con la aplicación vigente.
--
-- ---------------------------------------------------------------------------
-- ORDEN DE APLICACIÓN OBLIGATORIO (riesgo compuesto con ddl-auto=update)
-- ---------------------------------------------------------------------------
--   Orden normal:  V1.0 → V1.1 → V1.2 → V1.3 → V1.4 → V1.5 → V1.6
--   En una instancia viva: aplicar el SQL PRIMERO y arrancar la aplicación
--   DESPUÉS. Nunca al revés: Hibernate intentaría crear en una tabla a medio
--   migrar.
--
-- ---------------------------------------------------------------------------
-- RIESGOS DE ESTA VERSIÓN
-- ---------------------------------------------------------------------------
--   · Los `ADD COLUMN` usan `ALGORITHM=INPLACE, LOCK=NONE`: no bloquean
--     escrituras en curso. Aun así, ejecutar en ventana de baja carga.
--   · `MODIFY ID_Usuario_Admin` y `MODIFY Tipo_Accion` RECONSTRUYEN la tabla
--     `Bitacora_Administrativa`. Requieren ≈2× su tamaño en disco libre y
--     toman un `LOCK` de escritura. Son los pasos más delicados del script.
--     `ID_Usuario_Admin` además queda NOT NULL hasta que se aplique V1.4, que
--     lo vuelve NULLable: ver el requisito B del contrato de DOG-35.
--   · Espacio: verificar ANTES de ejecutar.
--
--       SELECT TABLE_NAME, TABLE_ROWS,
--              ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 1) AS mb
--       FROM information_schema.TABLES
--       WHERE TABLE_SCHEMA = 'dogalert'
--         AND TABLE_NAME IN ('Reportes', 'Bitacora_Administrativa');
--
--   · No se toca `Evidencias_Reportes` ni `Poligonos_Creel`.
--   · No se modifica `V1.0` ni `V1.1` (ver DATABASE.md, regla de oro).
-- ============================================================================

USE dogalert;

-- ============================================================================
-- 1. Reportes · idempotencia
-- ============================================================================
--
-- NO HAY NINGÚN DDL EN ESTA SECCIÓN, a propósito.
--
-- La llave de idempotencia y el hash del payload ya no son columnas de
-- `Reportes`: viven en la tabla `idempotencia_reportes`, que crea
-- `V1.4__sincronizacion_idempotencia_reportes_propios.sql`. Ver §0 para el
-- motivo.
--
-- Lo que cubre la idempotencia mientras tanto es `ID_Reporte_Cliente`, con su
-- `UNIQUE` de V1.2, y `report/ReportIdempotency.java` declara la tabla nueva.
--
-- ============================================================================
-- 2. Reportes · actividad
-- ============================================================================

-- DEFAULT presente: los INSERT de Hibernate que omitan la columna siguen
-- funcionando.
ALTER TABLE Reportes
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ALGORITHM=INPLACE, LOCK=NONE;

-- DEC-007: el borrado del autor es físico. Esta marca solo PRECEDE al purge
-- y no sustituye ni cancela el borrado.
ALTER TABLE Reportes
    ADD COLUMN Fecha_Eliminacion TIMESTAMP NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- Texto redactado por el usuario. Prohibido copiar aquí la descripción,
-- coordenadas, correo o teléfono (09.4 / 09.5).
ALTER TABLE Reportes
    ADD COLUMN Motivo_Eliminacion VARCHAR(200) NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- @Version de Hibernate: bloquea ediciones concurrentes con OptimisticLock.
ALTER TABLE Reportes
    ADD COLUMN Version_Registro INT NOT NULL DEFAULT 0,
    ALGORITHM=INPLACE, LOCK=NONE;

-- ============================================================================
-- 3. Reportes · conservación (C3-D8)
-- ============================================================================

-- 5 años tras la creación. NULLable en esta fase; V1.6 la vuelve NOT NULL.
ALTER TABLE Reportes
    ADD COLUMN Fecha_Conservacion_Hasta DATE NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- Cubre las filas de C1/C2. `DATE(...)` recorta antes de sumar para que el
-- resultado sea un DATE y no un DATETIME.
UPDATE Reportes
SET Fecha_Conservacion_Hasta = DATE_ADD(DATE(Fecha_Creacion), INTERVAL 5 YEAR)
WHERE Fecha_Conservacion_Hasta IS NULL;

-- ============================================================================
-- 4. Reportes · anonimización (C3-D9 / SCRUM-247)
-- ============================================================================

-- DEFAULT presente: los INSERT de Hibernate que omitan la columna siguen
-- funcionando.
ALTER TABLE Reportes
    ADD COLUMN Datos_Anonimizados BOOLEAN NOT NULL DEFAULT FALSE,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Reportes
    ADD COLUMN Fecha_Anonimizacion TIMESTAMP NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- ============================================================================
-- 5. Bitacora_Administrativa · reutilización (C3-D4)
-- ============================================================================
--
-- SDD 03.1 dice «no se agregan tablas paralelas» y DEC-004 pone el drawio como
-- fuente, así que se EXTIENDE la tabla existente en vez de crear una nueva.
--
-- Desviación documentada respecto de C3-PLANNING §3.2: el planning pide
-- `ON DELETE CASCADE`, pero §6 y §8.1 del mismo documento exigen que la
-- bitácora SOBREVIVA al borrado del reporte. Se aplica `ON DELETE SET NULL`:
-- la fila de auditoría se conserva y solo se pierde la asociación, que es
-- además el único motivo por el que la columna es NULLable. Con CASCADE, el
-- NULL sería inútil y DEC-007 (borrado físico) destruiría la trazabilidad de
-- HU-15.
--
-- La columna `Fecha` que arrastra la tabla desde V1.1 NO se usa: el mapeo de
-- C3 va a `Fecha_Accion` (SDD 03.4 pide «fecha»). `Fecha` queda como campo
-- heredado sin entidad; no la mapees junto con `Fecha_Accion`.

-- Los dos MODIFY de abajo RECONSTRUYEN la tabla, así que van juntos en un solo
-- ALTER: MySQL reconstruye una vez en lugar de dos, y eso significa un solo
-- LOCK de escritura sobre `Bitacora_Administrativa`.
--
--   a) `ID_Usuario_Admin` pasa a NULLable. C3-D4 + SCRUM-247: las filas de
--      ANONIMIZACION las escribe el job, que no tiene actor administrativo.
--      Sin este cambio, `ID_Usuario_Admin NOT NULL` impediría registrar la
--      anonimización.
--   b) `Tipo_Accion` amplía el ENUM con SINCRONIZACION y ANONIMIZACION. Es el
--      ALTER más delicado de C3.
--
-- Ninguno admite `ALGORITHM=INPLACE, LOCK=NONE`: ambos reconstruyen. Requieren
-- ≈2× el tamaño de la tabla en disco libre y ventana de baja carga.
ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NULL DEFAULT NULL,
    MODIFY COLUMN Tipo_Accion
        ENUM('CREACION', 'MODIFICACION', 'ELIMINACION', 'CAMBIO_ESTADO',
             'SINCRONIZACION', 'ANONIMIZACION') NOT NULL;

-- SDD 03.4 pide «resultado».
ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Resultado VARCHAR(20) NOT NULL DEFAULT 'OK',
    ALGORITHM=INPLACE, LOCK=NONE;

-- El CHECK impide que entre un estado fuera del vocabulario cerrado. En un
-- ALTER aparte porque MySQL exige que todas las cláusulas de una sentencia
-- compartan algoritmo, y este no necesita reconstruír la tabla.
ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT ck_bitacora_resultado
        CHECK (Resultado IN ('OK', 'RECHAZADO', 'ERROR')),
    ALGORITHM=INPLACE, LOCK=NONE;

-- Código de error, NUNCA el mensaje: el mensaje puede contener detalle del
-- reporte (09.4).
ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Codigo_Error VARCHAR(60) NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- SDD 03.4 pide «fecha». Ver la nota sobre la columna heredada `Fecha` arriba.
ALTER TABLE Bitacora_Administrativa
    ADD COLUMN Fecha_Accion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ALGORITHM=INPLACE, LOCK=NONE;

-- Asociación opcional con el reporte. BIGINT porque `Reportes.ID_Reporte` es
-- BIGINT. NULL en las filas heredadas de V1.1.
ALTER TABLE Bitacora_Administrativa
    ADD COLUMN ID_Reporte BIGINT NULL DEFAULT NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE Bitacora_Administrativa
    ADD CONSTRAINT fk_bitacora_reporte
        FOREIGN KEY (ID_Reporte) REFERENCES Reportes(ID_Reporte)
        ON DELETE SET NULL,
    ALGORITHM=INPLACE, LOCK=NONE;

-- ============================================================================
-- 6. Verificación posterior
-- ============================================================================

-- Debe devolver 0 en `nulos`: el backfill de conservación cubrió todas las filas.
SELECT COUNT(*) AS nulos
FROM Reportes
WHERE Fecha_Conservacion_Hasta IS NULL;

-- Deben existir las 9 columnas que esta versión añade. `Clave_Idempotencia` y
-- `Hash_Payload` NO están en la lista a propósito: las sustituye
-- `idempotencia_reportes` (V1.4, requisito A). Ver §0.
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME IN (
      'Fecha_Actualizacion', 'Fecha_Eliminacion', 'Motivo_Eliminacion',
      'Fecha_Conservacion_Hasta', 'Datos_Anonimizados', 'Fecha_Anonimizacion',
      'Version_Registro'
  );

-- No debe quedar ninguna columna de idempotencia heredada de esta versión. Si
-- hay alguna, es que se aplicó una versión antigua de V1.3 y hay que
-- retirarlas a mano: dejarlas daría dos mecanismos de idempotencia, que es
-- justo lo que DOG-35 vino a evitar.
SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Reportes'
  AND COLUMN_NAME IN ('Clave_Idempotencia', 'Hash_Payload');
-- Debe devolver 0 filas.

-- El ENUM debe listar los 6 valores.
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'dogalert'
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME = 'Tipo_Accion';
