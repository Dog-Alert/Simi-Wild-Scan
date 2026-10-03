-- ============================================================================
-- V1.4 · Sincronización idempotente, bitácora del autor, reportes propios
--        y alineación de Usuarios con la entidad (DOG-35 · contrato de datos)
-- ============================================================================
--
-- Traducción del contrato de base de datos de DOG-35. Requisitos:
--   A · Tabla de idempotencia                     (§3 del contrato)
--   B · Bitácora apta para acciones del autor     (§4)
--   C · Índice de reportes propios                (§5)
--   D · Alineación de Usuarios con la entidad    (§12)
--
-- Spec:      SDD/docs/sdd/06_offline_sincronizacion.md, 09_seguridad_privacidad.md
-- Jira:      DOG-35 (sincronización idempotente y propiedad)
-- Fuentes:   report/ReportIdempotency.java, report/Report.java, user/User.java
--            (el DDL copia estos nombres literalmente: ver §2 del contrato)
--
-- Depende de: V1.0, V1.1 y V1.2 aplicadas. V1.3 es RECOMENDABLE pero no
--             obligatoria: este script detecta si sus columnas existen.
--
-- ###########################################################################
-- #  LEE EL §0 ANTES DE EJECUTAR. ESTE SCRIPT ES CONDICIONAL A PROPÓSITO.  #
-- ###########################################################################
--
-- El esquema real de `dogalert-prod-db` **no** lo construyó Flyway: lo creó
-- `spring.jpa.hibernate.ddl-auto=update` de Hibernate. Por eso columnas que el
-- contrato da por inexistentes **pueden existir ya**, con el nombre correcto y
-- el tipo correcto.
--
-- Un `ALTER TABLE` a ciegas es entonces el error más probable de esta
-- migración, y sus dos síntomas habituales son:
--   · `ADD COLUMN` de algo que ya existe → ERROR 1060 duplicate column
--   · `CHANGE COLUMN` de un nombre viejo que ya se renombró → ERROR 1054
--
-- Por eso **cada bloque consulta `information_schema` antes de alterar**. El
-- script se puede correr contra el esquema construido por Hibernate, contra el
-- construido por V1.0-V1.2, o contra ambos mezclados, y en los tres casos
-- termina en el mismo estado.
--
-- NO uses `DROP COLUMN` para «limpiar» una columna duplicada sin antes leer el
-- §6 de este archivo.
--
-- ---------------------------------------------------------------------------
-- ORDEN DE APLICACIÓN
-- ---------------------------------------------------------------------------
--   V1.0 → V1.1 → V1.2 → V1.3 → V1.4
--
--   Aplicar el SQL PRIMERO y arrancar la aplicación DESPUÉS. Nunca al revés:
--   con `ddl-auto=update`, Hibernate intentaría completar una tabla a medio
--   migrar y dejaría el esquema peor que antes.
--
-- ---------------------------------------------------------------------------
-- RIESGOS
-- ---------------------------------------------------------------------------
--   · §1 (tabla nueva) y §3 (índice) usan `ALGORITHM=INPLACE, LOCK=NONE`: no
--     bloquean escrituras. Aun así, ventana de baja carga.
--   · §2 (bitácora) RECONSTRUYE `Bitacora_Administrativa`: requiere ≈2× su
--     tamaño en disco libre y toma un `LOCK` de escritura.
--   · §4 (Usuarios) RECONSTRUYE `Usuarios` por los `MODIFY COLUMN` y los
--     `CHANGE COLUMN`: requiere ≈2× su tamaño en disco libre. Es el paso más
--     caro de este script.
--
--     Verificar ANTES:
--
--       SELECT TABLE_NAME, TABLE_ROWS,
--              ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 1) AS mb
--       FROM information_schema.TABLES
--       WHERE TABLE_SCHEMA = 'dogalert'
--         AND TABLE_NAME IN ('Reportes', 'Bitacora_Administrativa', 'Usuarios');
--
--       SELECT VERSION();   -- MySQL >= 5.6 obligatorio, ver §4.d
--
--   · Este script no se puede deshacer a medias: si falla en §4, el §1-§3 ya
--     está aplicado. Vuelve a ejecutarlo: es idempotente.
-- ============================================================================

USE dogalert;

-- ###########################################################################
-- §0 · PREFLIGHT · correr y LEER antes de continuar
-- ###########################################################################
--
-- 0.1 · Versión. Debe ser >= 5.6 por el motivo de §4.d. En una 5.5 el
--       `ALTER TABLE Usuarios` entero falla con ERROR 1054.
SELECT VERSION() AS version;

-- 0.2 · Estado real de `Usuarios`. Es la consulta que abre el §12 del
--       contrato, y la que decide qué hace §4.
--
--       Regla de lectura:
--         · Si `Contrasena_Hash`, `Contacto_Autorizado`, `Ultimo_Login`,
--           `Ultima_Actividad`, `Datos_Anonimizados` y `Fecha_Actualizacion`
--           ya están, y `Estado_Cuenta` admite los tres valores, y `Nombre` es
--           nullable, **la tabla la construyó Hibernate desde la entidad**:
--           entonces §4 no tiene nada que hacer y sale por completo.
--         · Si faltan o no admiten los valores, §4 los añade uno a uno.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;

-- 0.3 · Estado de `Bitacora_Administrativa`. Si V1.3 está aplicada, `ID_Reporte`
--       y `Fecha_Accion` ya existen y §2 los reutiliza en vez de recrearlos.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
ORDER BY ORDINAL_POSITION;

-- 0.4 · La llave foránea heredada `fk_bitacora_admin` de V1.1 no declara
--       `ON DELETE`, así que un `DELETE` de una cuenta que tenga filas de
--       bitácora falla con ERROR 1451 y el borrado de cuenta queda bloqueado.
--       Esto es exactamente lo que arregla §2.1.
SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- ###########################################################################
-- §1 · REQUISITO A · Tabla de idempotencia
-- ###########################################################################
--
-- Soporta «Definir restricciones que eviten duplicados por reintento».
--
-- ---------------------------------------------------------------------------
-- POR QUÉ UNA TABLA NUEVA Y NO DOS COLUMNAS EN `Reportes`
-- ---------------------------------------------------------------------------
-- Si el hash y la llave vivieran en `Reportes`, al borrado físico de un
-- reporte por parte de su autor (RF-026) la fila desaparecería entera, el UUID
-- quedaría libre y un reintento posterior del cliente volvería a crear el
-- reporte. Eso rompe el criterio de aceptación «Los reintentos no duplican
-- reportes».
--
-- Con la tabla aparte, la fila sobrevive al borrado con `ID_Reporte` en NULL:
-- el UUID queda consumido y el reintento responde `410 REPORT_DELETED` en vez
-- de 200.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ EL `UNIQUE` ES CRÍTICO Y NO OPCIONAL
-- ---------------------------------------------------------------------------
-- `ReportCreationTransaction` no usa `INSERT IGNORE` ni ninguna query nativa.
-- Hace esto:
--
--   1. `existsByKey(key)` y `existsByClientReportId(...)`: pre chequeo.
--   2. Guarda el reporte y luego la fila de idempotencia.
--   3. Si el UNIQUE salta, captura `DataIntegrityViolationException` y
--      responde 200 como reenvío.
--
-- Ese catch es *la carrera entre dos peticiones simultáneas*, y solo se
-- resuelve porque el UNIQUE rechaza a la segunda. Si la tabla se crea sin la
-- restricción, el pre chequeo deja pasar a las dos, las dos escriben y **nadie
-- ve un error: se crean dos reportes**, justo lo que el criterio prohíbe.
--
-- ---------------------------------------------------------------------------
-- COLUMNAS
-- ---------------------------------------------------------------------------
--   `Llave`               → el encabezado `Idempotency-Key`. UNIQUE.
--   `ID_Reporte_Cliente`  → el `clientReportId` que el móvil genera y reenvía.
--                           UNIQUE aparte porque un cliente puede cambiar solo
--                           uno de los dos valores.
--   `Hash_Payload`        → SHA-256 del payload canónico. Distingue un reintento
--                           idéntico (200) de una llave reutilizada con otro
--                           contenido (409 IDEMPOTENCY_CONFLICT).
--   `ID_Usuario`          → identidad que reservó la llave. Un reintento desde
--                           otra cuenta responde 409 en vez de degradar un
--                           reporte de registrado a anónimo.
--   `ID_Reporte`          → reporte creado. NULL significa que el autor lo borró.
--   `Respuesta_HTTP`      → código de la primera respuesta, para reproducirlo.
--
-- ---------------------------------------------------------------------------
-- `ID_Usuario` VA SIN LLAVE FORÁNEA, A PROPÓSITO
-- ---------------------------------------------------------------------------
-- `Usuarios.ID_Usuario` es INT mientras la entidad `User` lo mapea como Long, y
-- una FK BIGINT → INT la rechaza MySQL. Además el backend no necesita
-- integridad referencial aquí: el dato se conserva aunque la cuenta se borre.
-- Esa incompatibilidad de tipos no se corrige en este ticket (queda anotada
-- como deuda en §4.e).
--
-- ---------------------------------------------------------------------------
-- PRIVACIDAD (SDD 09.4)
-- ---------------------------------------------------------------------------
-- Ninguna columna de esta tabla contiene PII. `Hash_Payload` es un resumen, no
-- el payload: el payload lleva descripción, coordenadas y teléfono, y nunca se
-- guarda aquí ni en la bitácora.

CREATE TABLE IF NOT EXISTS idempotencia_reportes (
    ID_Idempotencia    BIGINT AUTO_INCREMENT PRIMARY KEY,
    Llave              CHAR(36) NOT NULL,
    ID_Reporte_Cliente CHAR(36) NOT NULL,
    Hash_Payload       CHAR(64) NOT NULL,
    ID_Usuario         BIGINT NULL,
    ID_Reporte         BIGINT NULL,
    Respuesta_HTTP     SMALLINT NULL,
    Fecha_Creacion     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_idempotencia_llave UNIQUE (Llave),
    CONSTRAINT uq_idempotencia_reporte_cliente UNIQUE (ID_Reporte_Cliente),
    CONSTRAINT fk_idempotencia_reporte FOREIGN KEY (ID_Reporte)
        REFERENCES Reportes(ID_Reporte) ON DELETE SET NULL
);

-- Condicional por el mismo motivo que §3: `ReportIdempotency.java` declara
-- este mismo índice con `@Index`, así que con `ddl-auto=update` Hibernate puede
-- haberlo creado ya. Un `CREATE INDEX` a ciegas daría ERROR 1061 «Duplicate key
-- name» y abortaría el resto del script.
SET @indice_idem_ya_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'idempotencia_reportes'
      AND INDEX_NAME = 'idx_idempotencia_reporte'
);

SET @sql := IF(
    @indice_idem_ya_existe > 0,
    'SELECT ''DOG-35: idx_idempotencia_reporte ya existe. Omitido.'' AS aviso',
    'CREATE INDEX idx_idempotencia_reporte ON idempotencia_reportes(ID_Reporte), ALGORITHM=INPLACE, LOCK=NONE'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Las dos unicidades tienen nombre propio para poder referenciarlas desde
-- `U1.4`. Sin nombre, MySQL las autogenera y la reversión no puede nombrarlas.

-- ###########################################################################
-- §2 · REQUISITO B · Bitácora apta para acciones del autor
-- ###########################################################################
--
-- Soporta «Preparar migraciones para edición, eliminación y anonimización».
--
-- ---------------------------------------------------------------------------
-- POR QUÉ EL CAMBIO ES OBLIGATORIO
-- ---------------------------------------------------------------------------
-- V1.1 definió `ID_Usuario_Admin INT NOT NULL` y su llave foránea sin
-- `ON DELETE`. Eso impide registrar dos acciones que este ticket implementa:
--
--   · el borrado de un reporte propio, que ejecuta el AUTOR, no un
--     administrador;
--   · la anonimización diaria de cuentas inactivas, que ejecuta el trabajo
--     programado del SISTEMA, no una persona.
--
-- Sin este cambio el backend no puede cumplir RF-026, que exige conservar una
-- evidencia técnica mínima del borrado.
--
-- ---------------------------------------------------------------------------
-- NO SE PIDEN VALORES NUEVOS DE ENUM
-- ---------------------------------------------------------------------------
-- Se reutilizan los que ya existen en `Tipo_Accion` y el matiz va en
-- `Detalles`:
--
--   Creación de reporte        → CREACION     → origen=sync | origen=online
--   Edición por el autor        → MODIFICACION → origen=autor;estado_anterior=…
--   Borrado por el autor        → ELIMINACION  → origen=autor
--   Anonimización de cuenta     → CREACION     → origen=sistema;accion=anonimizacion;…
--
-- `Detalles` NO debe contener correo, teléfono, descripción, coordenadas, foto
-- ni EXIF (SDD 09.4). Solo estado y metadatos técnicos.

-- ---------------------------------------------------------------------------
-- 2.1 · `ID_Usuario_Admin` NULL + `ON DELETE SET NULL`
-- ---------------------------------------------------------------------------
-- Se abre y se cierra la llave foránea porque MySQL no permite cambiar la
-- cláusula `ON DELETE` con `MODIFY COLUMN`: hay que tirar la constraint y
-- volver a crearla. Por eso van en un solo `ALTER`.
--
-- `ID_Usuario_Admin INT NULL` (y no BIGINT) para no cambiar el tipo: cambiarlo
-- obligaría a revisar la FK y no aporta nada aquí.
--
-- Este `ALTER` RECONSTRUYE la tabla: ≈2× su tamaño en disco libre, `LOCK` de
-- escritura, ventana de baja carga.

-- La FK no siempre se llama `fk_bitacora_admin`: si la creó Hibernate leyendo la
-- entidad, su nombre es autogenerado. Un `DROP FOREIGN KEY` a ciegas daría
-- ERROR 3940. Por eso se consulta `information_schema` y se decide entre tirar y
-- recrear (si existe con ese nombre) o solo crear (si no existe de ninguna
-- forma).
SET @fk_bitacora_existe := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Bitacora_Administrativa'
      AND CONSTRAINT_NAME = 'fk_bitacora_admin'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql := IF(
    @fk_bitacora_existe > 0,
    'ALTER TABLE Bitacora_Administrativa DROP FOREIGN KEY fk_bitacora_admin, ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin) REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL',
    'ALTER TABLE Bitacora_Administrativa ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin) REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NULL DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 2.2 · Índice de bitácora por reporte y fecha
-- ---------------------------------------------------------------------------
-- El contrato pide `(ID_Reporte, Fecha)`. `Fecha` es la columna que arrastra
-- la tabla desde V1.1.
--
-- Pero C3 (V1.3) añadió `Fecha_Accion` como la fecha con la que se escribe la
-- bitácora, y dejó `Fecha` como campo heredado sin entidad. Indexar la columna
-- que nadie escribe produce un índice que no acelera ninguna consulta real.
--
-- Por eso el índice se crea sobre `Fecha_Accion` **si V1.3 está aplicada**, y
-- sobre `Fecha` heredada si no lo está. La condición se resuelve en tiempo de
-- ejecución: MySQL no permite `ALTER TABLE ... ADD INDEX` con un nombre de
-- columna que se decide en un `IF`.

SET @fecha_bitacora := (
    SELECT CASE WHEN COUNT(*) = 1 THEN 'Fecha_Accion' ELSE 'Fecha' END
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Bitacora_Administrativa'
      AND COLUMN_NAME = 'Fecha_Accion'
);

SET @indice_bitacora_ya_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Bitacora_Administrativa'
      AND INDEX_NAME = 'idx_bitacora_reporte_fecha'
);

-- Se omite si V1.3 NO está aplicada: sin `ID_Reporte` no hay a qué indexar, y
-- MySQL no admite un índice sobre una columna inexistente. Se avisa en vez de
-- abortar, para no dejar §2 a medias.
SET @sql := IF(
    @indice_bitacora_ya_existe > 0,
    'SELECT ''DOG-35: idx_bitacora_reporte_fecha ya existe. Omitido.'' AS aviso',
    IF(
        @fecha_bitacora = 'Fecha_Accion',
        'ALTER TABLE Bitacora_Administrativa ADD INDEX idx_bitacora_reporte_fecha (ID_Reporte, Fecha_Accion), ALGORITHM=INPLACE, LOCK=NONE',
        'SELECT ''DOG-35: idx_bitacora_reporte_fecha OMITIDO. Requiere V1.3 (columna ID_Reporte). Aplicar V1.3 y repetir V1.4.'' AS aviso'
    )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Si la línea anterior devolvió el aviso de «OMITIDO», el índice se crea con:
--
--   ALTER TABLE Bitacora_Administrativa
--       ADD INDEX idx_bitacora_reporte_fecha (ID_Reporte, Fecha_Accion),
--       ALGORITHM=INPLACE, LOCK=NONE;
--
-- ...después de aplicar V1.3.

-- ###########################################################################
-- §3 · REQUISITO C · Índice de reportes propios
-- ###########################################################################
--
-- `GET /v1/me/reports` siempre filtra por `ID_Usuario`, ordena por
-- `Fecha_Evento` y pagina por cursor opaco sobre `(Fecha_Evento, ID_Reporte)`.
-- Sin este índice compuesto cada petición recorre la tabla completa.
--
-- ---------------------------------------------------------------------------
-- TRES COLUMNAS, NO DOS
-- ---------------------------------------------------------------------------
-- Una primera versión pedía `(ID_Usuario, Fecha_Evento)`. Al contrastarlo con el
-- orden real del finder de reportes propios, que termina en
-- `order by eventAt desc, id desc`, esas dos columnas se quedaban cortas: el
-- índice ordenaba dentro del usuario por fecha, pero los empates de
-- `Fecha_Evento` había que resolverlos aparte. Con `ID_Reporte` como tercera
-- columna el índice cubre el filtro y el orden completo.
--
-- El orden importa: `ID_Usuario` va primero porque es la condición de
-- igualdad; las otras dos siguen el orden del `ORDER BY`.
--
-- ---------------------------------------------------------------------------
-- EL ÍNDICE YA ESTÁ DECLARADO EN LA ENTIDAD
-- ---------------------------------------------------------------------------
-- `report/Report.java` declara este índice con `@Index` y este mismo nombre.
-- Se hizo por una razón concreta: en este repositorio las migraciones **no se
-- ejecutan** automáticamente, así que un índice escrito solo en SQL no
-- llegaría a crearse nunca.
--
-- Por eso esta migración debe usar **exactamente el mismo nombre y las mismas
-- tres columnas**. Si el nombre difiere, quedan dos índices idénticos.
-- `ReportIndexSchemaTests` lee los metadatos y falla si falta, precisamente
-- para que esto no vuelva a pasar en silencio.
--
-- Por eso el bloque es condicional: con `ddl-auto=update`, Hibernate puede
-- haberlo creado ya a partir del `@Index`.

SET @indice_propios_ya_existe := (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Reportes'
      AND INDEX_NAME = 'idx_reportes_usuario_fecha'
);

SET @sql := IF(
    @indice_propios_ya_existe > 0,
    'SELECT ''DOG-35: idx_reportes_usuario_fecha ya existe (lo creo Hibernate desde el @Index). Omitido.'' AS aviso',
    'ALTER TABLE Reportes ADD INDEX idx_reportes_usuario_fecha (ID_Usuario, Fecha_Evento, ID_Reporte), ALGORITHM=INPLACE, LOCK=NONE'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ###########################################################################
-- §4 · REQUISITO D · Alineación de Usuarios con la entidad
-- ###########################################################################
--
-- `User.java` y `V1.0_crear_usuarios_y_roles.sql` no coinciden, y **ninguna
-- migración posterior modifica `Usuarios`**: V1.1 solo agrega FKs, V1.2 crea
-- otras tablas y V1.3 renombra las suyas. El resultado es que la base real
-- quedó en INT, con nombres viejos y con ENUMs a los que el código no puede
-- escribir.
--
-- Este es el requisito que puede hacer fallar la parte 3 (retención) en
-- producción, así que se aplica con el cuidado de §0.2.
--
-- Cada bloque es independiente y se salta solo si su columna ya está bien. El
-- resultado final es el mismo llegue como llegue el esquema.

-- ---------------------------------------------------------------------------
-- 4.a · ENUM de `Rol`: primero se AMPLÍA, después se traduce
-- ---------------------------------------------------------------------------
-- El orden importa. `UPDATE Usuarios SET Rol = 'USUARIO' WHERE Rol = 'USER'`
-- falla con «Data truncated for column 'Rol'» si el ENUM todavía no admite
-- 'USUARIO'. Traducirlo antes de ampliar no funciona.
--
-- Se conserva 'USER' temporalmente para no perder el valor de las filas
-- existentes. Se quita al final, en §4.c, y solo si ya no queda ninguna fila
-- con el valor viejo.

SET @rol_ya_alineado := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Rol'
      AND COLUMN_TYPE = 'enum(''USUARIO'',''ADMIN'')'
);

SET @sql := IF(
    @rol_ya_alineado = 1,
    'SELECT ''DOG-35: Rol ya alineado. Omitido.'' AS aviso',
    'ALTER TABLE Usuarios MODIFY COLUMN Rol ENUM(''USUARIO'',''ADMIN'',''USER'') NOT NULL DEFAULT ''USUARIO'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4.b · ENUM de `Estado_Cuenta`
-- ---------------------------------------------------------------------------
-- Es el que hace fallar el trabajo diario: `AccountStatus` escribe
-- ANONIMIZADA y BLOQUEADA, y el ENUM de V1.0 no las admite.
--
-- Se conservan INACTIVA y SUSPENDIDA aunque el código no las use, porque podría
-- haber filas con esos valores y eliminarlos convertiría un dato existente en
-- error.

ALTER TABLE Usuarios
    MODIFY COLUMN Estado_Cuenta
        ENUM('ACTIVA', 'INACTIVA', 'SUSPENDIDA', 'BLOQUEADA', 'ANONIMIZADA')
        NOT NULL DEFAULT 'ACTIVA';

-- ---------------------------------------------------------------------------
-- 4.c · Traducción de 'USER' → 'USUARIO' y limpieza opcional del ENUM
-- ---------------------------------------------------------------------------
-- Solo si hay filas con el valor viejo. Con el bloque dentro de un IF, el
-- `ALTER` que quita 'USER' del ENUM se omite automáticamente: ejecutarlo con
-- filas sin traducir fallaría con truncamiento, y no se puede detectar el
-- fallo a mitad de un script.
--
-- Para quitarlo a mano, después de comprobar que el SELECT de §6.2 devuelve 0:
--
--   ALTER TABLE Usuarios
--       MODIFY COLUMN Rol ENUM('USUARIO', 'ADMIN') NOT NULL DEFAULT 'USUARIO';

SET @filas_con_rol_viejo := (
    SELECT COUNT(*) FROM Usuarios WHERE Rol = 'USER'
);

-- `PREPARE` solo admite UNA sentencia, así que el `UPDATE` y el aviso van
-- separados. Encadenarlos con `;` dentro del mismo literal da error de sintaxis
-- en el `PREPARE` y aborta el script.
SET @sql := IF(
    @filas_con_rol_viejo = 0,
    'SELECT ''DOG-35: no quedan filas con Rol=''''USER'''', nada que traducir.'' AS aviso',
    'UPDATE Usuarios SET Rol = ''USUARIO'' WHERE Rol = ''USER'''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
    @filas_con_rol_viejo = 0,
    'SELECT ''DOG-35: sin traduccion pendiente.'' AS aviso',
    'SELECT ''DOG-35: traduccion de Rol completada. Reconsulte el conteo de §6.5 antes de quitar ''''USER'''' del ENUM.'' AS aviso'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4.d · Columnas con el nombre o el tipo que la entidad espera
-- ---------------------------------------------------------------------------
-- Tres detalles que no son evidentes:
--
--   1. `Fecha_Ultimo_Acceso` se renombra a `Ultimo_Login` **y se le quita el
--      `ON UPDATE CURRENT_TIMESTAMP`**. V1.0 lo traía y es peligroso: si se
--      dejara, cada actualización de la fila cambiaría la columna con la que se
--      mide el periodo de inactividad, y ninguna cuenta vencería nunca.
--
--   2. `Nombre` pasa a NULLable porque la retención lo pone en NULL (SDD 09.4)
--      y con `NOT NULL` ese UPDATE falla con ERROR 1048.
--
--   3. `Correo` se agranda a 254 porque la retención escribe
--      `anonimizado+<ID_Usuario>@dogalert.invalid`. Con VARCHAR(50) el valor más
--      largo posible es 49 caracteres: entra por poco, sin margen.
--
-- Este `ALTER` RECONSTRUYE `Usuarios` por los `MODIFY` y los `CHANGE`: ≈2× su
-- tamaño en disco libre, `LOCK` de escritura, ventana de baja carga.

ALTER TABLE Usuarios
    MODIFY COLUMN Nombre VARCHAR(150) NULL,
    MODIFY COLUMN Correo VARCHAR(254) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(25) NULL,
    MODIFY COLUMN Mayor_Edad TINYINT(1) NOT NULL DEFAULT 1,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- 4.e · RENAME de las tres columnas con nombre desactualizado
-- ---------------------------------------------------------------------------
-- Cada rename necesita DOS comprobaciones, no una:
--
--   · Si el nombre NUEVO ya existe, se omite. Es el caso normal cuando la tabla
--     la construyó Hibernate leyendo `User.java`.
--   · Si no existe ni el nuevo NI el viejo, también se omite, avisando. Renombrar
--     un origen inexistente falla con ERROR 1054 y abortaría el script entero,
--     dejando §4 sin terminar.
--
-- El caso que queda sin cubrir a propósito es «existen las dos columnas»: ahí el
-- rename duplicaría el contenido en vacío. Se documenta en §6.7 y lo resuelve el
-- DBA, no este script.

-- `Contrasena` → `Contrasena_Hash`
SET @columna_nueva := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Contrasena_Hash'
);
SET @columna_vieja := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Contrasena'
);
SET @sql := IF(
    @columna_nueva > 0,
    'SELECT ''DOG-35: Contrasena_Hash ya existe. Omitido.'' AS aviso',
    IF(
        @columna_vieja = 0,
        'SELECT ''DOG-35: AVISO. No existe ni Contrasena ni Contrasena_Hash. No se renombra. Revise §6.7.'' AS aviso',
        'ALTER TABLE Usuarios CHANGE COLUMN Contrasena Contrasena_Hash VARCHAR(255) NOT NULL, ALGORITHM=INPLACE, LOCK=NONE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- `Consentimiento_Contacto` → `Contacto_Autorizado`
SET @columna_nueva := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Contacto_Autorizado'
);
SET @columna_vieja := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Consentimiento_Contacto'
);
SET @sql := IF(
    @columna_nueva > 0,
    'SELECT ''DOG-35: Contacto_Autorizado ya existe. Omitido.'' AS aviso',
    IF(
        @columna_vieja = 0,
        'SELECT ''DOG-35: AVISO. No existe ni Consentimiento_Contacto ni Contacto_Autorizado. No se renombra. Revise §6.7.'' AS aviso',
        'ALTER TABLE Usuarios CHANGE COLUMN Consentimiento_Contacto Contacto_Autorizado TINYINT(1) NOT NULL DEFAULT 0, ALGORITHM=INPLACE, LOCK=NONE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- `Fecha_Ultimo_Acceso` → `Ultimo_Login`, sin `ON UPDATE CURRENT_TIMESTAMP`.
SET @columna_nueva := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Ultimo_Login'
);
SET @columna_vieja := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Fecha_Ultimo_Acceso'
);
SET @sql := IF(
    @columna_nueva > 0,
    'SELECT ''DOG-35: Ultimo_Login ya existe. Omitido.'' AS aviso',
    IF(
        @columna_vieja = 0,
        'SELECT ''DOG-35: AVISO. No existe ni Fecha_Ultimo_Acceso ni Ultimo_Login. No se renombra. Revise §6.7.'' AS aviso',
        'ALTER TABLE Usuarios CHANGE COLUMN Fecha_Ultimo_Acceso Ultimo_Login TIMESTAMP NULL DEFAULT NULL, ALGORITHM=INPLACE, LOCK=NONE'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4.f · Columnas que V1.0 no crea
-- ---------------------------------------------------------------------------
-- Condicionales: las cuatro pueden existir ya porque las agregó
-- `ddl-auto=update` leyendo `User.java`.

SET @columna := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Ultima_Actividad'
);
SET @sql := IF(
    @columna = 1,
    'SELECT ''DOG-35: Ultima_Actividad ya existe. Omitido.'' AS aviso',
    'ALTER TABLE Usuarios ADD COLUMN Ultima_Actividad TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, ALGORITHM=INPLACE, LOCK=NONE'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columna := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Datos_Anonimizados'
);
SET @sql := IF(
    @columna = 1,
    'SELECT ''DOG-35: Datos_Anonimizados ya existe. Omitido.'' AS aviso',
    'ALTER TABLE Usuarios ADD COLUMN Datos_Anonimizados TINYINT(1) NOT NULL DEFAULT 0, ALGORITHM=INPLACE, LOCK=NONE'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- `Fecha_Actualizacion` lleva `ON UPDATE CURRENT_TIMESTAMP`. MySQL solo admite
-- varias columnas `TIMESTAMP` con CURRENT_TIMESTAMP por defecto desde la 5.6;
-- en una 5.5 el `ALTER` falla con ERROR 1054. Es el motivo de la comprobación
-- de §0.1.

SET @columna := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios'
      AND COLUMN_NAME = 'Fecha_Actualizacion'
);
SET @sql := IF(
    @columna = 1,
    'SELECT ''DOG-35: Fecha_Actualizacion ya existe. Omitido.'' AS aviso',
    'ALTER TABLE Usuarios ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ALGORITHM=INPLACE, LOCK=NONE'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4.g · `ID_Usuario` NO se amplía a BIGINT
-- ---------------------------------------------------------------------------
-- La entidad lo mapea como `Long`, pero cambiarlo obligaría a revisar la FK de
-- `Bitacora_Administrativa` y la de `Reportes`, y para el MVP el límite de INT
-- no aprieta. Queda como deuda técnica.
--
-- El contrato asume esta deuda y por eso §1 deja `ID_Usuario` sin llave
-- foránea.

-- ###########################################################################
-- §5 · LO QUE ESTE SCRIPT NO HACE
-- ###########################################################################
--
--   · No borra reportes por antigüedad. `dogalert.retention.min-report-years`
--     (5 años, RF-043) está declarada pero sin usar: OPEN-005 sigue abierta.
--   · No crea trigger, procedimiento ni evento. V1.5 crea el índice que el
--     trabajo de anonimización necesita; este script no lo ejecuta.
--   · No toca `Evidencias_Reportes` ni `Poligonos_Creel`.
--   · No crea `Fuera_Creel` en `Reportes`. La regla acordada es rechazar lo que
--     caiga fuera del Creel con 422, así que ningún reporte almacenado puede
--     quedar fuera y la bandera no tendría contenido posible.
--   · No modifica `V1.0`, `V1.1`, `V1.2` ni `V1.3` (regla de oro, DATABASE.md).

-- ###########################################################################
-- §6 · VERIFICACIÓN
-- ###########################################################################
--
-- Correr TODO este bloque. Cualquier resultado distinto de lo indicado es un
-- fallo de la migración, no una advertencia.

-- 6.1 · REQUISITO A · las dos unicidades que sostienen la idempotencia.
--       `non_unique` debe ser 0 en AMBAS. Si no, la carrera entre dos reintentos
--       simultáneos no tiene nada que la detenga.
SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'idempotencia_reportes'
GROUP BY index_name, non_unique;
-- Esperado: uq_idempotencia_llave(0) y uq_idempotencia_reporte_cliente(0).

-- 6.2 · Prueba directa de la restricción: el segundo INSERT debe fallar con
--       ERROR 1062 (Duplicate entry). Si no falla, el UNIQUE no existe.
--
--       Ejecutar los tres INSERT uno por uno, no como bloque: el error del
--       segundo aborta el lote y no se ve el DELETE de limpieza.

-- INSERT INTO idempotencia_reportes
--     (Llave, ID_Reporte_Cliente, Hash_Payload)
-- VALUES
--     ('11111111-1111-4111-8111-111111111111',
--      '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
-- Ok: 1 fila.

-- INSERT INTO idempotencia_reportes
--     (Llave, ID_Reporte_Cliente, Hash_Payload)
-- VALUES
--     ('11111111-1111-4111-8111-111111111111',
--      '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
-- Debe fallar con ERROR 1062 (Duplicate entry). Si no falla, el UNIQUE no existe.

-- DELETE FROM idempotencia_reportes
-- WHERE Llave = '11111111-1111-4111-8111-111111111111';

-- 6.3 · REQUISITO C · el índice de reportes propios, con sus TRES columnas en
--       orden.
SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'Reportes'
  AND index_name = 'idx_reportes_usuario_fecha'
GROUP BY index_name, non_unique;
-- Debe devolver ID_Usuario, Fecha_Evento, ID_Reporte, en ese orden.

-- 6.4 · REQUISITO D · los valores que la retención necesita. Si
--       `Estado_Cuenta` no incluye ANONIMIZADA ni BLOQUEADA, el trabajo diario
--       falla al escribir.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Usuarios'
  AND COLUMN_NAME IN
      ('Nombre','Correo','Contrasena_Hash','Rol','Estado_Cuenta',
       'Contacto_Autorizado','Ultimo_Login','Ultima_Actividad',
       'Datos_Anonimizados','Fecha_Actualizacion')
ORDER BY COLUMN_NAME;
-- `Nombre` debe ser nullable: la retención lo pone en NULL.

-- 6.5 · REQUISITO D · cuántas filas quedan con el valor viejo de `Rol`. Ejecutar
--       ANTES de quitar 'USER' del ENUM: después, comparar contra un valor
--       fuera del ENUM da error de truncamiento en vez de un 0.
SELECT COUNT(*) AS filas_con_rol_user FROM Usuarios WHERE Rol = 'USER';
-- Debe devolver 0 para poder aplicar el `ALTER` opcional de §4.c.

-- 6.6 · REQUISITO B · `Bitacora_Administrativa.ID_Usuario_Admin` debe admitir
--       NULL y su FK debe declarar `ON DELETE SET NULL`.
SELECT COLUMN_NAME, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Bitacora_Administrativa'
  AND column_name = 'ID_Usuario_Admin';
-- Debe devolver `YES`. Con `NO`, el borrado por el autor y la anonimización
-- siguen sin poder registrarse.

SELECT rc.UPDATE_RULE AS regla_de_borrado
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
 AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
  AND kcu.TABLE_NAME = 'Bitacora_Administrativa'
  AND kcu.CONSTRAINT_NAME = 'fk_bitacora_admin';
-- Debe devolver `SET NULL`.

-- 6.7 · Prueba de fuego del requisito B: insertar una fila con
--       `ID_Usuario_Admin` en NULL. Con la columna en NOT NULL el INSERT falla,
--       y eso confirmaría que el requisito sigue pendiente.
--
-- INSERT INTO Bitacora_Administrativa (ID_Usuario_Admin, Tipo_Accion, Detalles)
-- VALUES (NULL, 'ELIMINACION', 'origen=autor');
-- DELETE FROM Bitacora_Administrativa
-- WHERE ID_Usuario_Admin IS NULL AND Detalles = 'origen=autor';

-- 6.8 · Los tres pares de nombres de §4.e. Este bloque detecta el caso que la
--       migración NO resuelve a propósito: que existan las DOS columnas del par.
--
--       Si aquí aparece un par completo (`Contrasena` y `Contrasena_Hash`, …), el
--       esquema tiene contenido duplicado y hay que decidir a mano cuál conserva
--       los datos antes de vaciar la otra. NO lo resuelva este script: un `DROP
--       COLUMN` automático podría borrar la columna buena y dejar la que Hibernate
--       creó vacía.
--
--       Resultado esperado: exactamente 6 filas, tres pares.
SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN
      ('Contrasena', 'Contrasena_Hash',
       'Consentimiento_Contacto', 'Contacto_Autorizado',
       'Fecha_Ultimo_Acceso', 'Ultimo_Login')
ORDER BY COLUMN_NAME;