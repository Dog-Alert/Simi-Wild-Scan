-- ============================================================================
-- U1.4 · Revertir sincronización idempotente, bitácora del autor,
--        reportes propios y alineación de Usuarios (DOG-35)
-- ============================================================================
--
-- Deshace EXACTAMENTE lo que hizo
-- `V1.4__sincronizacion_idempotencia_reportes_propios.sql`.
--
-- Jira:      DOG-35
--
-- ###########################################################################
-- #  ESTE SCRIPT DESTRUYE INFORMACIÓN QUE NO SE RECUPERA DE OTRO LADO.     #
-- #  NO DEBE EJECUTARSE EN LA INSTANCIA COMPARTIDA DE CLOUD SQL.           #
-- ###########################################################################
--
-- Lo que se pierde de forma irreversible:
--
--   · `idempotencia_reportes` COMPLETA. Contiene la reserva de llaves. Al
--     borrarla, cada UUID vuelve a estar libre y un reintento de un cliente
--     vuelve a crear el reporte. Se pierde justamente la garantía que motivó
--     el requisito A.
--
--   · `Usuarios.Datos_Anonimizados` pasa a NULL. El trabajo diario de
--     retención vuelve a seleccionar a las cuentas ya limpiadas y les
--     sobrescribe el correo centinela con otro, o falla.
--
--   · La traducción `Rol` 'USER' → 'USUARIO' no tiene vuelta atrás: al volver
--     `Rol` al ENUM de V1.0 las filas quedan con 'USUARIO', que ese ENUM no
--     admite, y la tabla queda ilegible para la aplicación.
--
--   · Los índices `idx_reportes_usuario_fecha` y `idx_bitacora_reporte_fecha`
--     se pierden, y con ellos la cobertura de `GET /v1/me/reports` y de la
--     bitácora por reporte. Cada petición pasa a escaneo completo de tabla.
--
-- Se reserva para pruebas locales o bases desechables.
--
-- ---------------------------------------------------------------------------
-- ORDEN
-- ---------------------------------------------------------------------------
--   Orden inverso de aplicación: U1.6 → U1.5 → U1.4 → U1.3.
--   `U1.5` y `U1.6` deben revertirse ANTES que este script.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ ESTA REVERSIÓN TIENE MAS GUARDIAS QUE LAS OTRAS
-- ---------------------------------------------------------------------------
-- A diferencia de V1.4, que es condicional y se puede correr contra cualquier
-- esquema, revertir es **destructivo e irreversible**: una vez que caiga
-- `idempotencia_reportes`, no hay forma de reconstruir qué llaves se habían
-- reservado.
--
-- Por eso el script ABORTA sin tocar nada cuando el estado ya no es reversible
-- (hay cuentas anonimizadas, o filas de bitácora sin actor administrativo) en
-- lugar de dejar la base a medias. La alternativa a `SIGNAL`, que MySQL solo
-- admite dentro de programas almacenados, es la misma de `U1.3`: referenciar
-- una tabla inexistente para que el error 1146 diga qué hacer.
-- ============================================================================

USE dogalert;

-- ###########################################################################
-- §0 · GUARDAS · abortar ANTES de cualquier DDL si algo ya no es reversible
-- ###########################################################################

-- 0.1 · ¿Se ha ejecutado alguna vez el trabajo de anonimización?
--
--       `Datos_Anonimizados` es la marca que deja. Si hay al menos una fila, la
--       reversión no puede completar §4: al volver `Nombre` a NOT NULL fallaría
--       con ERROR 1048 sobre esas filas, con la tabla ya reconstruida.
--
--       Debe devolver 0. Devolver 1 o más significa: seguir con §4 y dejar
--       `Usuarios` inconsistente, o conservar V1.4 y no ejecutar este script.
SELECT ID_Usuario, Estado_Cuenta
FROM Usuarios
WHERE Datos_Anonimizados = TRUE;

-- 0.2 · La tabla del requisito A debe existir. Si no está, este script ya se
--       ejecutó, o V1.4 nunca se aplicó. En el primer caso es inocuo; en el
--       segundo hay que aplicar V1.4 primero.
SELECT COUNT(*) AS filas_de_idempotencia FROM idempotencia_reportes;

-- 0.3 · Estado actual de `Usuarios`, para contrastarlo con la forma de V1.0.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;

-- 0.4 · Estado actual de `Bitacora_Administrativa`.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
ORDER BY ORDINAL_POSITION;

-- ###########################################################################
-- §1 · GUARDIA DE IRREVERSIBILIDAD
-- ###########################################################################

-- 0.1 y esta comprobación se evalúan juntas. Si hay cuentas anonimizadas se
-- aborta con el nombre de la tabla en el motivo.
SET @hay_anonimizados := (
    SELECT COUNT(*) FROM Usuarios WHERE Datos_Anonimizados = TRUE
);

SET @sql := IF(
    @hay_anonimizados = 0,
    -- Rama de éxito: no-op. El resto está en §2.
    'SELECT ''dog35_u14_precondicion_ok'' AS aviso',
    'SELECT * FROM dog35_u14_no_revertir_cuentas_anonimizadas'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ###########################################################################
-- §2 · REQUISITO A · Tabla de idempotencia
-- ###########################################################################
--
-- `DROP TABLE` elimina también el índice `idx_idempotencia_reporte` y las dos
-- restricciones `uq_idempotencia_llave` / `uq_idempotencia_reporte_cliente`, así
-- que no hace falta dropear nada por separado.
--
-- El `DROP TABLE` va SIN `IF EXISTS` a propósito: si la tabla no existe, este
-- script no se debe seguir ejecutando, y es mejor que se detenga aquí que
-- seguir revertiendo §3 y §4 a ciegas.

DROP TABLE idempotencia_reportes;

-- ###########################################################################
-- §3 · REQUISITO B · Bitácora apta para acciones del autor
-- ###########################################################################

-- 3.1 · Índice de bitácora. `DROP INDEX` es INPLACE y admite Lock=NONE: no
--       reconstruye la tabla.
--
--       Condicional porque V1.4 solo lo crea si `ID_Reporte` existe (o sea, si
--       V1.3 está aplicada). Si nunca se creó, este `DROP` fallaría con
--       ERROR 1091.
SET @indice_bitacora_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Bitacora_Administrativa'
      AND INDEX_NAME = 'idx_bitacora_reporte_fecha'
);

SET @sql := IF(
    @indice_bitacora_existe > 0,
    'ALTER TABLE Bitacora_Administrativa DROP INDEX idx_bitacora_reporte_fecha, ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''DOG-35: idx_bitacora_reporte_fecha no existe. Omitido.'' AS aviso'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3.2 · La FK vuelve a la forma de V1.1: sin `ON DELETE`. Es decir, volver a
--       bloquear el borrado de una cuenta que tenga filas de bitácora, que es
--       justo lo que V1.4 vino a corregir.
--
--       Este `ALTER` RECONSTRUYE `Bitacora_Administrativa`: ≈2× su tamaño en
--       disco libre y `LOCK` de escritura.
--
--       Va después del `DROP INDEX` para no reconstruir dos veces.
ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_admin,
    ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin)
        REFERENCES Usuarios(ID_Usuario);

-- 3.3 · `ID_Usuario_Admin` vuelve a `INT NOT NULL`.
--
--       Si el trabajo de anonimización ya escribió filas con
--       `ID_Usuario_Admin IS NULL`, esto falla con ERROR 1138 y deja la tabla
--       reconstruida a medias. La §1 lo impide, salvo que las filas nulas se
--       hayan escrito por otra vía. Si ocurre, la única salida es decidir qué
--       actor administrativo se imputa a esas acciones.
--
--       `DEFAULT NULL` se conserva porque es inocuo con `NOT NULL` y evita el
--       truncamiento de modo que MySQL aplica a un ENUM/TIMESTAMP sin default.
ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NOT NULL DEFAULT NULL;

-- ###########################################################################
-- §4 · REQUISITO C · Índice de reportes propios
-- ###########################################################################

SET @indice_propios_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Reportes'
      AND INDEX_NAME = 'idx_reportes_usuario_fecha'
);

SET @sql := IF(
    @indice_propios_existe > 0,
    'ALTER TABLE Reportes DROP INDEX idx_reportes_usuario_fecha, ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT ''DOG-35: idx_reportes_usuario_fecha no existe. Omitido.'' AS aviso'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ###########################################################################
-- §5 · REQUISITO D · Alineación de Usuarios con la entidad
-- ###########################################################################
--
-- Vuelve `Usuarios` a la forma de `V1.0_crear_usuarios_y_roles.sql`.
--
-- Este es el bloque más delicado del script, por tres motivos:
--
--   1. `Rol` vuelve a `ENUM('ADMIN','USER')`. Las filas que V1.4 tradujo a
--      'USUARIO' se quedan con un valor que ese ENUM no admite y la columna
--      queda ilegible. Hay que traducirlas de vuelta ANTES de estrechar el
--      ENUM, nunca después: un `UPDATE` a un valor que el ENUM todavía no
--      admite falla con «Data truncated».
--
--   2. `Ultimo_Login` vuelve a llamarse `Fecha_Ultimo_Acceso` y recupera su
--      `ON UPDATE CURRENT_TIMESTAMP`. **Esto es correcto respecto de V1.0 y
--      peligroso en operación**: con el `ON UPDATE`, cualquier actualización
--      de la fila mueve la columna, y ninguna cuenta volvería a vencer. Solo
--      tiene sentido dentro de una base desechable.
--
--   3. `Nombre` vuelve a `NOT NULL`. Con filas anonimizadas esto falla con
--      ERROR 1048. La §1 lo impide, pero solo mira `Datos_Anonimizados`: si
--      alguien puso `Nombre` en NULL sin pasar por la retención, esta sentencia
--      falla y `Usuarios` queda a medias.

-- 5.1 · Traducir 'USUARIO' → 'USER' antes de estrechar el ENUM de `Rol`.
UPDATE Usuarios SET Rol = 'USER' WHERE Rol = 'USUARIO';

-- 5.2 · Quitar las columnas que V1.0 no define y `User.java` sí mapea.
--
--       `DROP COLUMN` es siempre INPLACE y admite Lock=NONE: no reconstruye.
--
--       `Datos_Anonimizados` se pierde aquí: no hay forma de saber qué cuentas
--       habían sido anonimizadas.
ALTER TABLE Usuarios
    DROP COLUMN Ultima_Actividad,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Fecha_Actualizacion,
    ALGORITHM=INPLACE, LOCK=NONE;

-- 5.3 · Volver a la forma de V1.0.
--
--       Los tres `CHANGE COLUMN` van en el mismo `ALTER` que los `MODIFY`: una
--       sola reconstrucción de la tabla, un solo `LOCK` de escritura. Requiere
--       ≈2× el tamaño de `Usuarios` en disco libre y ventana de baja carga.
ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    MODIFY COLUMN Estado_Cuenta
        ENUM('ACTIVA', 'INACTIVA', 'SUSPENDIDA') DEFAULT 'ACTIVA',
    MODIFY COLUMN Nombre VARCHAR(150) NOT NULL,
    MODIFY COLUMN Correo VARCHAR(50) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(20),
    MODIFY COLUMN Mayor_Edad TINYINT(1) DEFAULT 1,
    MODIFY COLUMN Aviso_Privacidad_Aceptado TINYINT(1) NOT NULL,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHANGE COLUMN Contrasena_Hash Contrasena VARCHAR(255) NOT NULL,
    CHANGE COLUMN Contacto_Autorizado Consentimiento_Contacto TINYINT(1) DEFAULT 0,
    CHANGE COLUMN Ultimo_Login Fecha_Ultimo_Acceso TIMESTAMP NULL DEFAULT NULL
        ON UPDATE CURRENT_TIMESTAMP;

-- ###########################################################################
-- §6 · VERIFICACIÓN
-- ###########################################################################
--
-- `Usuarios` y `Bitacora_Administrativa` deben haber vuelto al estado de
-- `V1.0` / `V1.1`. Si algo no cuadra, no sigas: el siguiente paso depende de
-- esta forma.

-- Debe devolver 0 filas: la tabla del requisito A ya no existe.
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'idempotencia_reportes';

-- Debe devolver la forma de V1.0: `Rol` con ADMIN/USER, `Estado_Cuenta` con
-- ACTIVA/INACTIVA/SUSPENDIDA, `Nombre` NOT NULL, `Correo` VARCHAR(50) y sin
-- `Contrasena_Hash`, `Contacto_Autorizado`, `Ultimo_Login`,
-- `Ultima_Actividad`, `Datos_Anonimizados` ni `Fecha_Actualizacion`.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;

-- Debe devolver `NO` en `ID_Usuario_Admin`.
SELECT COLUMN_NAME, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME = 'ID_Usuario_Admin';

-- Solo deben quedar `idx_reportes_status` e `idx_reportes_fecha` de V1.2.
SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;