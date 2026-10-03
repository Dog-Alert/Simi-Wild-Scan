USE dogalert;

-- Aplicar después de V1.3__normalizar_nombres_tablas_nuevas.sql.
-- V1.0 contiene estos nombres y tipos heredados; consultar V1.4_README.md si
-- el esquema fue creado o actualizado por Hibernate en vez de aplicar V1.0-V1.3.

ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('USUARIO', 'ADMIN', 'USER') NOT NULL DEFAULT 'USUARIO',
    MODIFY COLUMN Estado_Cuenta
        ENUM('ACTIVA', 'INACTIVA', 'SUSPENDIDA', 'BLOQUEADA', 'ANONIMIZADA')
        NOT NULL DEFAULT 'ACTIVA',
    MODIFY COLUMN Nombre VARCHAR(150) NULL,
    MODIFY COLUMN Correo VARCHAR(254) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(25) NULL,
    MODIFY COLUMN Mayor_Edad TINYINT(1) NOT NULL DEFAULT 1,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHANGE COLUMN Contrasena Contrasena_Hash VARCHAR(255) NOT NULL,
    CHANGE COLUMN Consentimiento_Contacto Contacto_Autorizado TINYINT(1)
        NOT NULL DEFAULT 0,
    CHANGE COLUMN Fecha_Ultimo_Acceso Ultimo_Login TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN Ultima_Actividad TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN Datos_Anonimizados TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP;

UPDATE Usuarios
SET Rol = 'USUARIO'
WHERE Rol = 'USER';

ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('USUARIO', 'ADMIN') NOT NULL DEFAULT 'USUARIO';

ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NULL;

ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_admin,
    ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin)
        REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL;

CREATE INDEX idx_bitacora_reporte_fecha
    ON Bitacora_Administrativa (ID_Reporte, Fecha);

CREATE INDEX idx_reportes_usuario_fecha
    ON reportes (ID_Usuario, Fecha_Evento, ID_Reporte);

CREATE TABLE idempotencia_reportes (
    ID_Idempotencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    Llave VARCHAR(36) NOT NULL,
    ID_Reporte_Cliente VARCHAR(36) NOT NULL,
    Hash_Payload VARCHAR(64) NOT NULL,
    ID_Usuario BIGINT NULL,
    ID_Reporte BIGINT NULL,
    Respuesta_HTTP SMALLINT NULL,
    Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_idempotencia_reporte (ID_Reporte),
    CONSTRAINT uq_idempotencia_llave UNIQUE (Llave),
    CONSTRAINT uq_idempotencia_reporte_cliente UNIQUE (ID_Reporte_Cliente),
    CONSTRAINT fk_idempotencia_reporte FOREIGN KEY (ID_Reporte)
        REFERENCES reportes (ID_Reporte) ON DELETE SET NULL
);
