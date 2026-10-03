USE dogalert;

ALTER TABLE Usuarios
    ADD COLUMN Ultimo_Login TIMESTAMP NULL,
    ADD COLUMN Ultima_Actividad TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN Datos_Anonimizados BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN Fecha_Anonimizacion TIMESTAMP NULL,
    ADD COLUMN Estado_Cuenta ENUM('ACTIVA', 'ANONIMIZADA', 'BLOQUEADA')
        NOT NULL DEFAULT 'ACTIVA',
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP;

UPDATE Usuarios
SET Ultima_Actividad = COALESCE(Fecha_Ultimo_Acceso, Fecha_Creacion, CURRENT_TIMESTAMP);

ALTER TABLE Reportes
    ADD COLUMN Clave_Idempotencia CHAR(36)
        GENERATED ALWAYS AS (ID_Reporte_Cliente) STORED,
    ADD COLUMN Hash_Payload BINARY(32) NULL,
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN Eliminado BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN Fecha_Eliminacion TIMESTAMP NULL,
    ADD COLUMN Conservar_Hasta TIMESTAMP NULL;

UPDATE Reportes
SET Conservar_Hasta = DATE_ADD(Fecha_Creacion, INTERVAL 5 YEAR);

ALTER TABLE Reportes
    MODIFY COLUMN Conservar_Hasta TIMESTAMP NOT NULL,
    ADD CONSTRAINT UQ_Reportes_Idempotencia UNIQUE (Clave_Idempotencia),
    ADD CONSTRAINT CK_Reportes_Eliminacion CHECK (
        (Eliminado = FALSE AND Fecha_Eliminacion IS NULL)
        OR (Eliminado = TRUE AND Fecha_Eliminacion IS NOT NULL)
    );

CREATE INDEX IX_Reportes_Conservacion
    ON Reportes (Eliminado, Conservar_Hasta);

DELIMITER $$
CREATE TRIGGER TR_Reportes_ConservarAntesDeBorrar
BEFORE DELETE ON Reportes
FOR EACH ROW
BEGIN
    IF OLD.Conservar_Hasta > CURRENT_TIMESTAMP THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El reporte aún está dentro del plazo mínimo de conservación';
    END IF;
END$$
DELIMITER ;