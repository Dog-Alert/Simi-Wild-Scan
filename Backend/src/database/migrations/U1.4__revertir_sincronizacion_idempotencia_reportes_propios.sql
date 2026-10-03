USE dogalert;

SELECT ID_Usuario, Estado_Cuenta
FROM Usuarios
WHERE Datos_Anonimizados = TRUE;

SELECT COUNT(*) AS filas_de_idempotencia FROM idempotencia_reportes;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
ORDER BY ORDINAL_POSITION;

SET @hay_anonimizados := (
    SELECT COUNT(*) FROM Usuarios WHERE Datos_Anonimizados = TRUE
);

SET @sql := IF(
    @hay_anonimizados = 0,
    'SELECT ''dog35_u14_precondicion_ok'' AS aviso',
    'SELECT * FROM dog35_u14_no_revertir_cuentas_anonimizadas'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE idempotencia_reportes;


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


ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_admin,
    ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin)
        REFERENCES Usuarios(ID_Usuario);


ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NOT NULL DEFAULT NULL;


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


UPDATE Usuarios SET Rol = 'USER' WHERE Rol = 'USUARIO';


ALTER TABLE Usuarios
    DROP COLUMN Ultima_Actividad,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Fecha_Actualizacion,
    ALGORITHM=INPLACE, LOCK=NONE;


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


SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'idempotencia_reportes';


SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Usuarios'
ORDER BY ORDINAL_POSITION;

SELECT COLUMN_NAME, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bitacora_Administrativa'
  AND COLUMN_NAME = 'ID_Usuario_Admin';

SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Reportes'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;