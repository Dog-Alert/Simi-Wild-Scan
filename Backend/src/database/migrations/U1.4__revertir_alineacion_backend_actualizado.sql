USE dogalert;

-- Solo para una base desechable. Esta reversión pierde reservas de idempotencia
-- y puede fallar si ya existen cuentas anonimizadas o acciones sin administrador.
DROP TABLE idempotencia_reportes;

DROP INDEX idx_reportes_usuario_fecha ON reportes;
DROP INDEX idx_bitacora_reporte_fecha ON Bitacora_Administrativa;

ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_admin,
    MODIFY COLUMN ID_Usuario_Admin INT NOT NULL,
    ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin)
        REFERENCES Usuarios (ID_Usuario);

ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('ADMIN', 'USER', 'USUARIO') NOT NULL DEFAULT 'USER';

UPDATE Usuarios
SET Rol = 'USER'
WHERE Rol = 'USUARIO';

ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    MODIFY COLUMN Estado_Cuenta ENUM('ACTIVA', 'INACTIVA', 'SUSPENDIDA')
        NOT NULL DEFAULT 'ACTIVA',
    MODIFY COLUMN Nombre VARCHAR(150) NOT NULL,
    MODIFY COLUMN Correo VARCHAR(50) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(20) NULL,
    MODIFY COLUMN Mayor_Edad TINYINT(1) DEFAULT 1,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHANGE COLUMN Contrasena_Hash Contrasena VARCHAR(255) NOT NULL,
    CHANGE COLUMN Contacto_Autorizado Consentimiento_Contacto TINYINT(1) DEFAULT 0,
    CHANGE COLUMN Ultimo_Login Fecha_Ultimo_Acceso
        TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    DROP COLUMN Fecha_Actualizacion,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Ultima_Actividad;