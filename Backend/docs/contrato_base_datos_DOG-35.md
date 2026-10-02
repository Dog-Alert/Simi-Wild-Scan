# Contrato de base de datos para DOG-35

**Este documento NO es una migración.** No tiene nombre `V`/`U`, no debe guardarse en
`Backend/src/database/migrations/` y no se ejecuta. Es la especificación de lo que
el backend necesita de Cloud SQL para que funcione la sincronización idempotente,
la gestión de reportes propios y la base de anonimización.

Quien implemente la migración debe traducirlo a los archivos `V` y `U` que le
corresponden y numerar la versión siguiente disponible.

- Ticket de backend: DOG-35 (sincronización idempotente y propiedad).
- Ticket de base de datos: el que cubre "Crear los campos de actividad y
  conservación en Cloud SQL" y "Definir restricciones que eviten duplicados por
  reintento".

## 1. Lo que este ticket NO pide

Para no duplicar trabajo con el resto del equipo:

- Almacenamiento SQLite protegido y cifrado de la app móvil.
- Estados locales de sincronización (`LOCAL_SAVED`, `SYNC_PENDING`, `SYNCING`,
  `SYNC_ERROR`, `SYNCED`). Son locales del dispositivo, descritos en la sección 6.3
  del SDD, y no se persisten en Cloud SQL.
- La referencia técnica de HU-05.

## 2. Fuentes de verdad

Los nombres y tipos de este contrato salen literalmente de las entidades JPA, que
son lo que el backend compila y ejecuta:

| Entidad | Archivo |
|---|---|
| `ReportIdempotency` | `report/ReportIdempotency.java` |
| `Report` | `report/Report.java` |
| `User` | `user/User.java` |

Si cambia alguno de esos archivos, hay que actualizar este documento en el mismo
commit.

## 3. Requisito A — Tabla de idempotencia

Es el soporte de "Definir restricciones que eviten duplicados por reintento".

```sql
CREATE TABLE idempotencia_reportes (
    ID_Idempotencia     BIGINT AUTO_INCREMENT PRIMARY KEY,
    Llave               CHAR(36)  NOT NULL,
    ID_Reporte_Cliente  CHAR(36)  NOT NULL,
    Hash_Payload        CHAR(64)  NOT NULL,
    ID_Usuario          BIGINT    NULL,
    ID_Reporte          BIGINT    NULL,
    Respuesta_HTTP      SMALLINT  NULL,
    Fecha_Creacion      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_idempotencia_llave UNIQUE (Llave),
    CONSTRAINT uq_idempotencia_reporte_cliente UNIQUE (ID_Reporte_Cliente),
    CONSTRAINT fk_idempotencia_reporte FOREIGN KEY (ID_Reporte)
        REFERENCES reportes(ID_Reporte) ON DELETE SET NULL
);

CREATE INDEX idx_idempotencia_reporte ON idempotencia_reportes(ID_Reporte);
```

### Por qué una tabla nueva y no dos columnas en `reportes`

Si el hash y la llave vivieran en `reportes`, al borrado físico de un reporte por
parte de su autor (RF-026, `DELETE /v1/me/reports/{id}`) la fila desaparecería
entera, el UUID quedaría libre y un reintento posterior del cliente volvería a
crear el reporte. Eso rompe el criterio de aceptación "Los reintentos no
duplican reportes".

Con la tabla aparte, la fila sobrevive al borrado con `ID_Reporte` en `NULL`: el
UUID queda consumido y el reintento responde `410 REPORT_DELETED` en lugar de
`200`.

### Columnas

| Columna | Para qué la usa el backend |
|---|---|
| `Llave` | El encabezado `Idempotency-Key`. Es la llave de reserva: el backend inserta con `INSERT IGNORE` y decide según si afectó 0 o 1 filas. |
| `ID_Reporte_Cliente` | El `clientReportId` que el móvil genera y reenvía. Unicidad aparte porque un cliente puede cambiar solo uno de los dos valores. |
| `Hash_Payload` | SHA-256 del payload canónico. Permite distinguir un reintento idéntico (`200`) de una llave reutilizada con otro contenido (`409 IDEMPOTENCY_CONFLICT`), como exige la sección 6.6 del SDD. |
| `ID_Usuario` | Identidad que reservó la llave. Un reintento desde otra cuenta responde `409` en vez de degradar un reporte de registrado a anónimo (sección 6.4.7 del SDD). |
| `ID_Reporte` | Reporta creado. `NULL` significa que el autor lo borró. |
| `Respuesta_HTTP` | Código de la primera respuesta, para reproducirla en el reenvío. |

### `ID_Usuario` va sin llave foránea, a propósito

`Usuarios.ID_Usuario` es `INT` en `V1.0` mientras la entidad `User` lo mapea como
`Long`. Una llave foránea `BIGINT → INT` la rechaza MySQL. Además el backend no
necesita integridad referencial aquí: el dato se conserva aunque la cuenta se
borre, y esa incompatibilidad de tipos se corrige en un ticket aparte. Por eso
`ID_Usuario` queda como columna suelta, sin `REFERENCES`.

## 4. Requisito B — Bitácora apta para acciones del autor

Es el soporte de "Preparar migraciones para edición, eliminación y
anonimización".

```sql
ALTER TABLE Bitacora_Administrativa
    MODIFY COLUMN ID_Usuario_Admin INT NULL;

ALTER TABLE Bitacora_Administrativa
    DROP FOREIGN KEY fk_bitacora_admin,
    ADD CONSTRAINT fk_bitacora_admin FOREIGN KEY (ID_Usuario_Admin)
        REFERENCES Usuarios(ID_Usuario) ON DELETE SET NULL;

CREATE INDEX idx_bitacora_reporte_fecha
    ON Bitacora_Administrativa(ID_Reporte, Fecha);
```

### Por qué el cambio es obligatorio

Hoy la columna es `INT NOT NULL` y su llave foránea no declara `ON DELETE`. Eso
impide registrar dos acciones que este ticket implementa:

- El borrado de un reporte propio. Lo ejecuta el autor, no un administrador.
- La anonimización diaria de cuentas inactivas. La ejecuta el trabajo programado
  del sistema, no una persona.

Sin este cambio, el backend no puede cumplir RF-026, que exige conservar una
evidencia técnica mínima del borrado.

### No se piden valores nuevos de ENUM

Se reutilizan los que ya existen en `Tipo_Accion` y el matiz va en `Detalles`:

| Acción | `Tipo_Accion` | `Detalles` |
|---|---|---|
| Creación de reporte | `CREACION` | `origen=sync` o `origen=online` |
| Edición por el autor | `MODIFICACION` | `origen=autor;estado_anterior=VERIFIED;estado_nuevo=PENDING` |
| Borrado por el autor | `ELIMINACION` | `origen=autor` |
| Anonimización de cuenta | `CREACION` | `origen=sistema;accion=anonimizacion;meses_inactividad=12` |

`Detalles` **no** debe contener correo, teléfono, descripción, coordenadas, foto
ni EXIF (sección 9.4 del SDD). Solo estado y metadatos técnicos.

## 5. Requisito C — Índice de reportes propios

```sql
CREATE INDEX idx_reportes_usuario_fecha
    ON reportes(ID_Usuario, Fecha_Evento);
```

`GET /v1/me/reports` siempre filtra por `ID_Usuario`, ordena por `Fecha_Evento` y
pagina por cursor opaco sobre `(Fecha_Evento, ID_Reporte)`. Sin este índice
compuesto cada petición recorre la tabla completa de reportes.

## 6. Nota sobre el estado actual del esquema

Esto **no** es parte de DOG-35, pero afecta a la migración: `V1.0` y `V1.2`
crearon `Usuarios` y `reportes` con una definición que ya no coincide con las
entidades JPA, y el esquema real de desarrollo se ha construido por
`spring.jpa.hibernate.ddl-auto=update`, no por Flyway. Flyway no encuentra los
scripts porque viven en `Backend/src/database/migrations/`, fuera del classpath.

Diferencias detectadas, que también están registradas como Error en Jira:

| Migración | Define | La entidad espera |
|---|---|---|
| V1.0 | `Contrasena` | `Contrasena_Hash` |
| V1.0 | `Rol ENUM('ADMIN','USER')` | `Rol` con valores `USUARIO`, `ADMIN` |
| V1.0 | `Fecha_Ultimo_Acceso` | `Ultimo_Login` y `Ultima_Actividad` |
| V1.0 | `Consentimiento_Contacto` | `Contacto_Autorizado` |
| V1.0 | — | `Datos_Anonimizado`, `Estado_Cuenta`, `Fecha_Actualizacion` |
| V1.2 | `reportes.ID_Usuario INT` | `Long` |

Quien implemente esta migración debe confirmar contra el esquema **real** de
`dogalert-prod-db` cuáles de estas columnas existen hoy, para no duplicarlas.

## 7. Cómo verificar

```sql
-- Las dos unicidades que sostienen la idempotencia.
SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'idempotencia_reportes'
GROUP BY index_name, non_unique;

-- La reserva debe afectar 1 la primera vez y 0 en cualquier reintento.
INSERT IGNORE INTO idempotencia_reportes
    (Llave, ID_Reporte_Cliente, Hash_Payload)
VALUES
    ('11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
SELECT ROW_COUNT();  -- 1

INSERT IGNORE INTO idempotencia_reportes
    (Llave, ID_Reporte_Cliente, Hash_Payload)
VALUES
    ('11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
SELECT ROW_COUNT();  -- 0, la llave ya estaba reservada

DELETE FROM idempotencia_reportes
WHERE Llave = '11111111-1111-4111-8111-111111111111';
```

Para verificar la bitácora, insertar una fila con `ID_Usuario_Admin` en `NULL`.
Con la columna en `NOT NULL` el `INSERT` falla, y eso confirma que el requisito B
sigue pendiente.