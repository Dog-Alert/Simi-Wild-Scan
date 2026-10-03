USE dogalert;

DROP TRIGGER IF EXISTS TR_Reportes_ConservarAntesDeBorrar;
DROP INDEX IX_Reportes_Conservacion ON Reportes;

ALTER TABLE Reportes
    DROP CHECK CK_Reportes_Eliminacion,
    DROP INDEX UQ_Reportes_Idempotencia,
    DROP COLUMN Conservar_Hasta,
    DROP COLUMN Fecha_Eliminacion,
    DROP COLUMN Eliminado,
    DROP COLUMN Fecha_Actualizacion,
    DROP COLUMN Hash_Payload,
    DROP COLUMN Clave_Idempotencia;

ALTER TABLE Usuarios
    DROP COLUMN Fecha_Actualizacion,
    DROP COLUMN Estado_Cuenta,
    DROP COLUMN Fecha_Anonimizacion,
    DROP COLUMN Datos_Anonimizados,
    DROP COLUMN Ultima_Actividad,
    DROP COLUMN Ultimo_Login;