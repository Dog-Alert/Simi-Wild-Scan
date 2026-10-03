USE dogalert;

SELECT VERSION() AS version;


SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;


SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
ORDER BY ORDINAL_POSITION;


SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND REFERENCED_TABLE_NAME IS NOT NULL;


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


ALTER TABLE Usuarios
    MODIFY COLUMN Estado_Cuenta
        ENUM('ACTIVA', 'INACTIVA', 'SUSPENDIDA', 'BLOQUEADA', 'ANONIMIZADA')
        NOT NULL DEFAULT 'ACTIVA';



SET @filas_con_rol_viejo := (
    SELECT COUNT(*) FROM Usuarios WHERE Rol = 'USER'
);


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



ALTER TABLE Usuarios
    MODIFY COLUMN Nombre VARCHAR(150) NULL,
    MODIFY COLUMN Correo VARCHAR(254) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(25) NULL,
    MODIFY COLUMN Mayor_Edad TINYINT(1) NOT NULL DEFAULT 1,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;


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


SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'idempotencia_reportes'
GROUP BY index_name, non_unique;

SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'Reportes'
  AND index_name = 'idx_reportes_usuario_fecha'
GROUP BY index_name, non_unique;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Usuarios'
  AND COLUMN_NAME IN
      ('Nombre','Correo','Contrasena_Hash','Rol','Estado_Cuenta',
       'Contacto_Autorizado','Ultimo_Login','Ultima_Actividad',
       'Datos_Anonimizados','Fecha_Actualizacion')
ORDER BY COLUMN_NAME;

SELECT COUNT(*) AS filas_con_rol_user FROM Usuarios WHERE Rol = 'USER';

SELECT COLUMN_NAME, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Bitacora_Administrativa'
  AND column_name = 'ID_Usuario_Admin';

SELECT rc.UPDATE_RULE AS regla_de_borrado
FROM information_schema.REFERENTIAL_CONSTRAINTS rc
JOIN information_schema.KEY_COLUMN_USAGE kcu
  ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
 AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
WHERE rc.CONSTRAINT_SCHEMA = DATABASE()
  AND kcu.TABLE_NAME = 'Bitacora_Administrativa'
  AND kcu.CONSTRAINT_NAME = 'fk_bitacora_admin';

SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
  AND COLUMN_NAME IN
      ('Contrasena', 'Contrasena_Hash',
       'Consentimiento_Contacto', 'Contacto_Autorizado',
       'Fecha_Ultimo_Acceso', 'Ultimo_Login')
ORDER BY COLUMN_NAME;