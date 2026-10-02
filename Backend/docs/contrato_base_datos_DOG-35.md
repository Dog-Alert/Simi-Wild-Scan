# Contrato de base de datos para DOG-35

**Este documento NO es una migración.** No tiene nombre `V`/`U`, no debe guardarse en
`Backend/src/database/migrations/` y no se ejecuta. Es la especificación de lo que
el backend necesita de Cloud SQL para que funcione la sincronización idempotente,
la gestión de reportes propios y la base de anonimización.

Quien implemente la migración debe traducirlo a los archivos `V1.4` y `U1.4`.

### Antes de escribir nada: los scripts actuales no se ejecutan

`application.properties:19` tiene `spring.flyway.enabled=true`, pero **no define
`spring.flyway.locations`**. Flyway solo busca en `classpath:db/migration`, y los
scripts están en `Backend/src/database/migrations/`, fuera del classpath. Escribe
un `V1.4` perfecto en esa carpeta y **no se va a aplicar**, sin error visible.

Esto ya pasó: los Requisitos A, B y C están escritos en SQL desde el principio y
ninguno se aplicó. El único mecanismo que ha modificado el esquema es
`spring.jpa.hibernate.ddl-auto=update` de Hibernate, que crea tablas y columnas
pero no índices compuestos ni ajustes de tipos.

Hay que decidir, antes o junto con `V1.4`:

- mover los scripts a `src/main/resources/db/migration`, o
- fijar `spring.flyway.locations=classpath:...,filesystem:...`, o
- dejarlos donde están y aplicar el DDL a mano.

Y en algún momento hay que desactivar `ddl-auto=update`, porque en cuanto Flyway
sea el dueño del esquema, Hibernate no debe seguir alterándolo al arrancar.

- Ticket de backend: DOG-35 (sincronización idempotente y propiedad).
- Ticket de base de datos: el que cubre "Crear los campos de actividad y
  conservación en Cloud SQL" y "Definir restricciones que eviten duplicados por
  reintento".
- Requisitos de este documento: **A** tabla de idempotencia (sección 3),
  **B** bitácora apta para el autor (sección 4), **C** índice de reportes propios
  (sección 5) y **D** alineación de `Usuarios` con la entidad (sección 12).

> **Duda que hay que resolver antes de ejecutar `V1.4`.** El esquema real de
> `dogalert-prod-db` se construyó con `ddl-auto=update`, no con Flyway, así que
> muchas columnas de este contrato **pueden ya existir** y el DDL de la sección 12
> las duplicaría. La sección 12 empieza por las consultas que hay que correr para
> averiguarlo. **Ejecutar ese DDL sin verificarlas antes es el error más probable
> de esta migración.**

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
| `Llave` | El encabezado `Idempotency-Key`. Es la llave de reserva. **La restricción `UNIQUE` sobre esta columna es la que garantiza que los reintentos no dupliquen reportes**, y por eso no es opcional. |
| `ID_Reporte_Cliente` | El `clientReportId` que el móvil genera y reenvía. Unicidad aparte porque un cliente puede cambiar solo uno de los dos valores. |
| `Hash_Payload` | SHA-256 del payload canónico. Permite distinguir un reintento idéntico (`200`) de una llave reutilizada con otro contenido (`409 IDEMPOTENCY_CONFLICT`), como exige la sección 6.6 del SDD. |
| `ID_Usuario` | Identidad que reservó la llave. Un reintento desde otra cuenta responde `409` en vez de degradar un reporte de registrado a anónimo (sección 6.4.7 del SDD). |
| `ID_Reporte` | Reporta creado. `NULL` significa que el autor lo borró. |
| `Respuesta_HTTP` | Código de la primera respuesta, para reproducirla en el reenvío. |

### Cómo reserva la llave el backend, y por qué el `UNIQUE` es crítico

Una versión anterior de este documento decía que el backend inserta con
`INSERT IGNORE` y decide según si afectó 0 o 1 filas. **Es falso, y la diferencia
importa.** `ReportCreationTransaction` no usa `INSERT IGNORE` ni ninguna query
nativa. Hace esto:

1. `existsByKey(key)` y `existsByClientReportId(...)`: pre chequeo.
2. Guarda el reporte y luego la fila de idempotencia.
3. Si el `UNIQUE` salta, captura `DataIntegrityViolationException` y responde
   `200` como reenvío.

Ese `catch` es **la carrera entre dos peticiones simultáneas**, y solo se resuelve
porque el `UNIQUE` rechaza a la segunda. Si la tabla se crea sin la restricción, el
pre chequeo deja pasar a las dos, las dos escriben y **nadie ve un error: se crean
dos reportes**, justo lo que el criterio de aceptación prohíbe.

Por eso la sección 7 verifica la restricción, y no el mecanismo de inserción.

### `ID_Usuario` va sin llave foránea, a propósito

`Usuarios.ID_Usuario` es `INT` mientras la entidad `User` lo mapea como
`Long`. Una llave foránea `BIGINT → INT` la rechaza MySQL. Además el backend no
necesita integridad referencial aquí: el dato se conserva aunque la cuenta se
borre, y esa incompatibilidad de tipos no se corrige en este ticket (queda
anotada como deuda en el Requisito D, sección 12). Por eso
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
    ON reportes(ID_Usuario, Fecha_Evento, ID_Reporte);
```

`GET /v1/me/reports` siempre filtra por `ID_Usuario`, ordena por `Fecha_Evento` y
pagina por cursor opaco sobre `(Fecha_Evento, ID_Reporte)`. Sin este índice
compuesto cada petición recorre la tabla completa de reportes.

### Tres columnas, no dos

La primera versión de este requisito pedía `(ID_Usuario, Fecha_Evento)`. Al
contrastarlo con el query real de `ReportRepository.findOwnPage`, que termina en
`order by r.eventAt desc, r.id desc`, las dos columnas se quedaban cortas: el índice
ordenaba dentro del usuario por fecha, pero los empates de `Fecha_Evento` había que
resolverlos aparte. Con `ID_Reporte` como tercera columna el índice cubre el filtro
y el orden completo.

El orden importa: `ID_Usuario` va primero porque es la condición de igualdad, y las
otras dos siguen el orden del `ORDER BY`.

### Ya está declarado en la entidad

`Report.java` declara el índice con `@Index` y el mismo nombre
`idx_reportes_usuario_fecha`. Se hizo por una razón concreta: en este repositorio
**las migraciones no se ejecutan** (sección 6), así que un índice escrito solo en
SQL no llegaría a crearse nunca. Es el mismo motivo por el que los Requisitos A y B
siguen pendientes.

**La migración del equipo de base de datos debe usar exactamente el mismo nombre y
las mismas tres columnas.** Si el nombre difiere, quedan dos índices idénticos.

`ReportIndexSchemaTests` lee los metadatos de la tabla y falla si el índice no
existe, precisamente para que esto no vuelva a pasar en silencio.

## 6. Nota sobre el estado actual del esquema

Esto **no** es parte de DOG-35, pero afecta a la migración: `V1.0` y `V1.2`
crearon `Usuarios` y `reportes` con una definición que ya no coincide con las
entidades JPA, y el esquema real de desarrollo se ha construido por
`spring.jpa.hibernate.ddl-auto=update`, no por Flyway. Flyway no encuentra los
scripts porque viven en `Backend/src/database/migrations/`, fuera del classpath.

Diferencias detectadas. **Ninguna está registrada todavía como Error en Jira:**
hacerlo requiere acceso al proyecto y es un paso pendiente antes de cerrar
DOG-35. La lista completa está en la sección 6.1.

| Migración | Define | La entidad espera |
|---|---|---|
| V1.0 | `Contrasena` | `Contrasena_Hash` |
| V1.0 | `Rol ENUM('ADMIN','USER')` | `Rol` con valores `USUARIO`, `ADMIN` |
| V1.0 | `Fecha_Ultimo_Acceso` | `Ultimo_Login` y `Ultima_Actividad` |
| V1.0 | `Consentimiento_Contacto` | `Contacto_Autorizado` |
| V1.0 | — | `Datos_Anonimizado`, `Estado_Cuenta`, `Fecha_Actualizacion` |
| V1.2 | `reportes.ID_Usuario INT` | `Long` |

Quien implemente esta migración debe confirmar contra el esquema **real** de
`dogalert-prod-db` cuáles de estas columnas existen hoy, para no duplicarlas. El
DDL que las alinea está en el **Requisito D (sección 12)**, y empieza por las
consultas que hay que correr antes de tocar nada.

### 6.1 Defectos pendientes de registrar como Error en Jira

Detectados al trabajar este ticket. Los primeros seis bloquean a cualquiera que
intente aplicar el Requisito D.

| # | Defecto | Por qué importa | Acción sugerida |
|---|---|---|---|
| 1 | `spring.flyway.locations` sin definir y scripts fuera de `classpath:db/migration` | Flyway no ejecuta nada; el esquema real se ha construido con `ddl-auto=update`, así que el versionado es ficticio | Bug. Definir la propiedad y mover los scripts |
| 2 | `Usuarios` de `V1.0` sin `Datos_Anonimizado`, `Estado_Cuenta` ni `Fecha_Actualizacion` | La retención no puede escribir sus columnas | Bug. Requisito D |
| 3 | `Rol ENUM('ADMIN','USER')` contra `USUARIO`/`ADMIN` del código | No se puede leer ni escribir ninguna cuenta | Bug. Requisito D |
| 4 | `Estado_Cuenta ENUM` sin `BLOQUEADA` ni `ANONIMIZADA` | El trabajo diario falla por truncamiento | Bug. Requisito D |
| 5 | `Nombre VARCHAR(100) NOT NULL` | La anonimización lo deja en `NULL` y el trabajo diario revienta | Bug. Requiere admitir `NULL` |
| 6 | Deriva de nombres: `Contrasena`, `Consentimiento_Contacto`, `Fecha_Ultimo_Acceso` | El código espera `Contrasena_Hash`, `Contacto_Autorizado`, `Ultimo_Login` | Bug. Requisito D |
| 7 | `reportes.ID_Usuario INT` contra `Long` | Riesgo de desbordamiento a largo plazo | Deuda técnica, no bloqueante |
| 8 | `Bitacora_Administrativa.ID_Usuario_Admin INT NOT NULL` | No admite `NULL`, así que el autor no puede corregir ni borrar sus reportes | Bug. RF-026 |
| 9 | RF-026 sin cubrir: no se escribe bitácora | Requisito funcional abierto | Bug o fuera de alcance, decide PO |
| 10 | Geometría oficial ausente (OPEN-002) | Con el polígono aproximado se pueden rechazar reportes legítimos del borde | Bug. Depende de OPEN-002 |

Dos precisiones sobre esta lista:

- El punto 1 fusiona dos síntomas de una sola causa. Flyway está habilitado y
  no migra nada porque nunca encuentra los scripts; corregir uno de los dos lados
  no basta.
- Sobre el punto 9: si el autor ya corrigió o borró reportes en producción sin
  que quede rastro, la definición de terminado de DOG-35 pide evidencia de la
  autorización en servidor. La validación existe y tiene pruebas, pero la
  auditoría no. Si eso no entra en este ticket, conviene que el PO mueva RF-026
  explícitamente en lugar de dejarlo abierto por omisión.

## 7. Cómo verificar

```sql
-- Requisito A: las dos unicidades que sostienen la idempotencia.
-- non_unique debe ser 0 en ambas. Si no, la carrera entre dos reintentos
-- simultaneos no tiene nada que la detenga.
SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'idempotencia_reportes'
GROUP BY index_name, non_unique;

-- Prueba directa de la restricción: el segundo INSERT debe fallar por
-- duplicado, no por nada más.
INSERT INTO idempotencia_reportes
    (Llave, ID_Reporte_Cliente, Hash_Payload)
VALUES
    ('11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
-- Ok: 1 fila.

INSERT INTO idempotencia_reportes
    (Llave, ID_Reporte_Cliente, Hash_Payload)
VALUES
    ('11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222', REPEAT('a', 64));
-- Debe fallar con ERROR 1062 (Duplicate entry). Si no falla, el UNIQUE no existe.

DELETE FROM idempotencia_reportes
WHERE Llave = '11111111-1111-4111-8111-111111111111';

-- Requisito C: el indice de reportes propios, con sus tres columnas en orden.
SELECT index_name, non_unique,
       GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'reportes'
  AND index_name = 'idx_reportes_usuario_fecha'
GROUP BY index_name, non_unique;
-- Debe devolver ID_Usuario, Fecha_Evento, ID_Reporte, en ese orden.

-- Requisito D: los valores que la retencion necesita. Si Estado_Cuenta no
-- incluye ANONIMIZADA ni BLOQUEADA, el trabajo diario falla al escribir.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Usuarios'
  AND COLUMN_NAME IN
      ('Nombre','Correo','Contrasena_Hash','Rol','Estado_Cuenta',
       'Contacto_Autorizado','Ultimo_Login','Ultima_Actividad',
       'Datos_Anonimizados','Fecha_Actualizacion')
ORDER BY COLUMN_NAME;
-- Nombre debe ser nullable: la retencion lo pone en NULL.
```

Para verificar la bitácora, insertar una fila con `ID_Usuario_Admin` en `NULL`.
Con la columna en `NOT NULL` el `INSERT` falla, y eso confirma que el requisito B
sigue pendiente.

## 8. Estado de la parte 2 (reportes propios)

La parte 2 del ticket implementa `GET /v1/me/reports`, `GET/PATCH/DELETE
/v1/me/reports/{id}` sin pedir **ningún** cambio de esquema adicional. Requiere
solo lo ya descrito en las secciones 4 y 5.

### Lo que queda sin cubrir: RF-026

RF-026 exige conservar «una entrada técnica mínima que indique que ocurrió una
eliminación». El backend **no escribe en `Bitacora_Administrativa`**, y por lo
miento **RF-026 no está cubierto**. El motivo es el Requisito B de la sección 4:
la columna `ID_Usuario_Admin` es `INT NOT NULL` y el borrado lo ejecuta el autor,
no un administrador, así que no existe un valor admisible que guardar. Además su
columna `ID_Registro` apunta a `Registros`, tabla que ya no existe tras el
renombrado de `V1.3`/`U1.3`.

Cuando se aplique el Requisito B, faltarán la entidad y las escrituras de
`MODIFICACION` y `ELIMINACION` con `origen=autor` (sección 4).

### Desviación consciente del SDD 8.4:35

El SDD 8.4 dice que al crear o editar «se evalúa el punto y guarda
`Fuera_Creel`». La decisión del equipo fue **no aceptar reportes fuera del
polígono**: tanto `POST /v1/reports` como `PATCH /v1/me/reports/{id}` responden
`422 LOCATION_OUTSIDE_CREEL`.

Consecuencias:

- `reportes` **no** necesita columna `Fuera_Creel`; no se pide nada nuevo.
- Por invariante, ningún reporte puede quedar fuera del Creel, así que las
  consultas públicas futuras no necesitan filtrar por esa bandera.
- Cuando exista la geometría oficial aprobada (pendiente bloqueante del propio
  SDD 8.4), esta regla deberá revisarse: hoy el polígono es una configuración
  aproximada y podría rechazar reportes legítimos de la fringe.

## 9. Estado de la parte 3 (retención de cuentas)

La parte 3 implementa el trabajo diario que aplica **RF-044 del SRS**: eliminar
los datos personales de una cuenta tras 12 meses sin un inicio de sesión exitoso.

> **Corrección: esta parte sí necesita un cambio de esquema, y está en la
> sección 12 (Requisito D).** Una versión anterior de este documento decía que no
> pedía nada porque "usa solo columnas que ya existen". Es falso: **`V1.0` no define
> `Datos_Anonimizados`, `Ultimo_Login`, `Ultima_Actividad` ni `Fecha_Actualizacion`**,
> llama `Contrasena` a `Contrasena_Hash` y `Consentimiento_Contacto` a
> `Contacto_Autorizado`, y su `Estado_Cuenta` es un ENUM que **no incluye
> `ANONIMIZADA` ni `BLOQUEADA`**, que son los valores que escribe el código.
> Además `V1.2_README.md:26` dice que `Usuarios` se conserva sin cambios, así que
> ninguna migración posterior lo arregla.

Si el esquema real se construyó con `ddl-auto=update`, algunas de esas columnas
pueden existir ya. La sección 12 empieza por comprobarlo, porque un `ALTER` a ciegas
las duplicaría o fallaría.

> Nota de numeración: el SRS llama RF-044 a la anonimización y RF-045 a los
> protocolos de seguridad, mientras que `11_pruebas_trazabilidad.md` desplaza todo
> en uno. El SRS es la fuente autoritativa y es el que se sigue aquí.

### Qué se borra y qué sobrevive

La fila de `Usuarios` **no se elimina ni se anonimiza**: se le quitan los datos
personales y se marca con `Datos_Anonimizados = true` y
`Estado_Cuenta = 'ANONIMIZADA'`.

| Columna | Qué pasa | Por qué |
|---|---|---|
| `Nombre` | a `NULL` | Es dato personal (SDD 9.4). La entidad lo permite nulo, pero **`V1.0` lo define `NOT NULL`**: sin el Requisito D este `UPDATE` falla. |
| `Correo` | a `anonimizado+<ID_Usuario>@dogalert.invalid` | Es dato personal y además es la llave de login. **No puede quedar `NULL`**: la columna es `NOT NULL` y `UNIQUE`. El centinela es único por cuenta y usa el TLD reservado `.invalid`, así que no es enrutable y no colisiona con un correo real. |
| `Contrasena_Hash` | a un hash inservible | Es la credencial. **No puede quedar `NULL`** por `NOT NULL`. Se genera un secreto que nadie conserva y se hashea una sola vez para toda la tanda, así que ninguna contraseña puede satisfacerlo. |
| `Telefono` | a `NULL` | Es dato personal. |
| `Mayor_Edad`, `Contacto_Autorizado`, `Aviso_Privacidad_Aceptado` | a `false` | SDD 9.5 paso 2: «borra correo/teléfono y consentimiento». |
| `Datos_Anonimizados`, `Estado_Cuenta` | a `true` / `ANONIMIZADA` | SDD 9.5 pasos 1 y 4. También bloquea el login, porque `AuthService` exige `ACTIVA` y `dataAnonymized = false`. |
| `Ultimo_Login`, `Ultima_Actividad`, `Fecha_Creacion` | **intactos** | Son la evidencia de cuándo venció el periodo y no son dato personal. |
| `Rol` | **intacto** | Los administradores quedan fuera del trabajo: no puede dejar al sistema sin cuenta operativa. |

### Los reportes siguen vinculados a la cuenta

SDD 9.5 paso 3 pide «desvincula reportes conservados». **La decisión del equipo fue
conservarlos vinculados**, porque RF-043 obliga a conservarlos y el SRS no pide
desvincular nada. Con la fila sin PII, un reporte vinculado ya no expone datos
personales, y a diferencia del `NULL` esta opción **no destruye atribución de
forma irreversible**.

Consecuencia: al anonimizarse, esos reportes dejan de aparecer en
`GET /v1/me/reports`, porque esa consulta filtra por `ID_Usuario`. Es coherente con
la anonimización, pero conviene saberlo.

### Desviación consciente del SDD 9.5: el corte se mide desde `Ultimo_Login`

SDD 9.5 dice «selecciona perfiles activos con `Ultima_Actividad < now - 12 meses»».
La implementación usa `COALESCE(Ultimo_Login, Fecha_Creacion)`, porque **RF-044
habla de «inicio de sesión exitoso»** y `Ultima_Actividad` mediría otra cosa.
`Ultima_Actividad` además está bloqueada en `AuthService.login:90-93`, así que
ninguna petición la actualiza y sería un criterio ENGÑOSO.

El `COALESCE` cubre a quien se registró pero nunca ha iniciado sesión: para esas
cuentas `Ultimo_Login` es `NULL` y el periodo se cuenta desde `Fecha_Creacion`.

Además el trabajo incluye las cuentas `BLOQUEADA` (el SDD solo menciona las
«activas»): una cuenta bloqueada también retiene datos personales y, si se
excluyeran, esa PII se quedaría indefinidamente.

### Sesiones: política elegida

SDD 9.5 paso 1 dice «invalida la cuenta y sus sesiones propias **según la política
elegida**». La política elegida es: **no se revocan los JWT ya emitidos**.

`JwtService` no consulta la base y `SecurityConfig` solo valida firma y
expiración, así que un token emitido antes de anonimizar sigue sirviendo hasta su
caducidad, que son 60 minutos (`dogalert.jwt.expiration-minutes`). Se acepta el
coste porque en ese plazo la fila ya no tiene PII y el token no da acceso a nada
nuevo. Revocar exigiría una consulta a base por petición.

### Lo que queda sin cubrir: RNF-PRI-05 y RF-042

RNF-PRI-05 pide que el trabajo diario «produzca evidencia de auditoría sin
conservar el dato eliminado», y su trazabilidad (`T-RET-003`) lo comprueba. Al no
escribir en `Bitacora_Administrativa` por el bloqueo de la sección 4, **la parte
de auditoría de RNF-PRI-05 y RF-042 no está cubierta**.

Lo que sí queda es la evidencia técnica en el log: corte aplicado y conteo de
candidatos, anonimizados y fallidos, **sin ningún dato personal**. Eso no
sustituye a la bitácora en base de datos.

### Índice recomendado (no aplicado)

La consulta del trabajo ordena y filtra por `Datos_Anonimizados` y
`COALESCE(Ultimo_Login, Fecha_Creacion)`. El índice que propone el SDD
(`IX_Usuarios_Retencion` sobre `Datos_Anonimizados, Ultima_Actividad`) **no
sirve para esta consulta**, porque usa otra columna y no cubre la expresión del
`COALESCE`. Mientras el volumen de usuarios sea de MVP no urge, pero si crece
conviene que el DBA valore un índice sobre `(Datos_Anonimizados, Ultimo_Login)`.

No se aplicó ningún DDL porque este ticket no escribe SQL.

### Dos cosas que este trabajo deliberadamente no hace

- **No borra reportes por antigüedad.** `dogalert.retention.min-report-years`
  (5 años, RF-043) está declarada pero **sin usar**: `12_decisiones_y_pendientes.md`
  deja OPEN-005 sin resolver y el SDD 9.5 dice que el MVP no borra al cumplir los
  cinco años.
- **No pide llave distribuida.** Cloud Run escala horizontalmente, así que el
  cron puede dispararse en varias réplicas a la vez. Es aceptable porque la
  operación es idempotente (una cuenta ya limpiada sale del criterio), pero se
  duplica trabajo. Si las réplicas crecen, hará falta quartz o shedlock.
- **Está apagado.** `dogalert.retention.enabled` viene en `false` hasta que Jazmín
  revise la política. El apagado es total: sin bean no hay tarea programada que
  pueda dispararse.

## 10. Estado de la parte 4 (geometría de Creel)

La parte 4 convierte `poligonos_creel` en la fuente de verdad del límite, con el
polígono de configuración como respaldo. **No pide ningún cambio de esquema.**

> Decisión del equipo que se aparta de los documentos: el SDD 8.4:35 dice que el
> polígono «se carga como configuración versionada» y no menciona la tabla. Ningún
> documento del repositorio nombra `poligonos_creel` como fuente de verdad, ni
> define un respaldo. Se eligió la tabla porque `V1.2` ya la creó para esto.

### La tabla está vacía a propósito, y eso cambia qué decide en producción

`V1.2_README.md:46-48` dice que la geometría oficial «no se inventa ni se incluye en
el repositorio» y que la fila se insertará cuando el equipo reciba el GeoJSON
aprobado. Mientras eso no ocurra, **el polígono que decide es el de configuración**.

Eso no es un detalle menor: el polígono de respaldo es un rectángulo aproximado, y
la regla acordada es rechazar lo que caiga fuera. Un punto real del borde del Creel
puede quedar fuera de un rectángulo aproximado y ser rechazado. Las métricas
oficiales tampoco deben afirmarse: el SDD 8.4 marca la geometría como **pendiente
bloqueante** y `10_despliegue_operacion.md:96` la exige antes de producción.

### SHA-256: es un identificador, no una comprobación de integridad

La columna `SHA256 CHAR(64) UNIQUE` se usa como identificador del archivo aprobado,
que es lo que implye `V1.2_README.md` («cuando el equipo reciba el GeoJSON aprobado
y pueda calcular su SHA-256»). **No se verifica al leer**, por dos razones medidas
en este ticket:

1. **`GeoJSON` es de tipo JSON.** Al guardar, el motor normaliza el documento: quita
   espacios y reformatea. Un digest calculado sobre el archivo entregado por el
   equipo no coincide con el del texto que sale de la base.
2. **Al enlazar un `String` a una columna JSON, el valor se guarda como cadena
   escapada**, no como objeto. Es decir, lo que llega a la aplicación es
   `"{\"type\":\"Polygon\",...}"`. Esto se verificó en pruebas: la raíz del nodo
   JSON resulta ser de tipo `STRING`.

Verificar el digest contra lo que sale de la base habría **descartado la geometría
oficial** y devuelto el polígono aproximado, que es justo el resultado contrario al
deseado. Por eso el código compara y **solo avisa por log**.

Quien necesite un digest reproducible debe calcularlo sobre la forma canónica
(`jq -c`), y aun así conviene verificar contra el motor real antes de fiarse.

### El parser acepta las dos formas de almacenamiento

Por el punto 2 anterior, `CreelGeometry.fromGeoJson` acepta tanto un objeto JSON
como un JSON que en realidad es una cadena con el documento escapado dentro, y lo
desenvuelve. Sin esa segunda rama, un polígono insertado por la aplicación nunca
llegaría a leerse. Hay una prueba que cubre exactamente ese caso.

También rechaza coordenadas fuera de rango con un mensaje que dice que se esperaba
`[longitud, latitud]`, porque el orden invertido produce un polígono en otro lugar
del planeta en vez de un error visible.

### Validation y sellado usan la misma evaluación

`CreelBoundary.evaluate(latitude, longitude)` devuelve a la vez si el punto está
dentro y **la versión del polígono usada**. Se cambió desde `contains()` y
`version()` por separado: si el polígono se recarga entre ambas llamadas, un
reporte podría quedar sellado con una versión que nunca se usó para aceptarlo.
`ReportService` recibe una sola evaluación y la usa para validar y para guardar
`Poligono_Version`.

### Caché y fallo de base

- La geometría se lee **una vez y se reutiliza** durante
  `dogalert.creel.cache-ttl-seconds` (3600 por defecto). Consultar la tabla en cada
  alta sería una consulta por petición para un dato que solo cambia cuando alguien
  carga una geometría nueva.
- **Un fallo de base no impide crear reportes.** Si la consulta lanza excepción, se
  avisa y se usa el respaldo, que es lo que se estaría usando igual sin la tabla.
- Un polígono activo ilegible (GeoJSON inválido) también cae al respaldo, para no
  dejar el servicio sin límite.

### Lo que sigue sin cubrirse

- `T-PUB-006` («polígono versionado y bandera») queda **sin cubrir**: la bandera
  `Fuera_Creel` no existe por decisión de la parte 2, y el filtrado del panel por
  «pertenencia o no a Creel» (RF-037) no está implementado.
- `reportes.Poligono_Version` sigue siendo un `VARCHAR(50)` **sin llave foránea** a
  `poligonos_creel`. No se propone añadirla: el respaldo tiene su propia versión y
  una FK impediría por completo ese escenario.
- La geometría oficial (OPEN-002) sigue pendiente.

## 11. Estado de la parte 6 (contrato OpenAPI)

`SDD/docs/sdd/openapi.yaml` sube a `1.2.0`. Se contrastó cada operación de reportes
contra el código antes de editarla, así que los cambios son de contrato, no de
criterio.

### `replayed` ya no viaja en las lecturas

`OwnedReport` se componía con `allOf` sobre `ReportReceipt`, y `ReportReceipt`
exige `replayed`. El efecto era que **el detalle, la edición y el listado tenían
que incluir un `replayed: false` inventado**, porque una lectura no es un reintento
idempotente. Se partió el esquema en `ReportIdentity` (id, `clientReportId`,
`status`) y `ReportReceipt` = `ReportIdentity` + `replayed`, de modo que el campo
solo aparece donde significa algo.

El campo también se borró de `OwnedReportResponse`. Nunca se leía: el único uso del
accesor es `ReportController:62`, sobre `ReportReceipt`.

### Se retiraron `externalToCreel` y su filtro

Estaban en `PublicReport`, `AdminReport`, `HeatmapCell` y como filtro de
`/admin/reports`. Tras la parte 2 **ningún reporte almacenado puede estar fuera de
Creel**, así que ese filtro solo podía devolver cero filas y el booleano solo podía
ser `false`. Se quitaron para no invitar a construir una vista que nunca tendría
contenido. Queda anotado en la descripción del propio OpenAPI como desviación de
la 08:35. Si más adelante se decide admitir reportes externos, el campo vuelve con
el `422` y no antes.

### Códigos que ya no coinciden con el código

- `Profile.role` decía `USER`; el enum `Role` es `USUARIO`.
- `Profile.status` decía `ACTIVE, ANONYMIZED, DISABLED`; `AccountStatus` es
  `ACTIVA, ANONIMIZADA, BLOQUEADA`. Se adoptó la nomenclatura de la base, que además
  es donde la retención llega a `ANONIMIZADA`.
- El envoltorio `Error` no declaraba el `timestamp` que `ApiExceptionHandler`
  siempre incluye.

### Respuestas que faltaban

Se comprobó operación por operación contra `ApiExceptionHandler`:

- Las cuatro de `/me/reports` no declaraban `401`, aunque sí exigían JWT.
- `PATCH /me/reports/{reportId}` no declaraba `404`, que es lo que devuelve cuando
  el reporte es de otro autor.
- `POST /reports` no declaraba `410 REPORT_DELETED`, `413` ni `400`.
- Faltaba el `400` de cursor inválido en el listado.

Se añadieron además los `401` que faltaban en las rutas `/admin/**` y en
`/me/contact-consent`, por el mismo motivo.

### Lo que se dejó como estaba

`Idempotency-Key` sigue declarado `required: true`. El controlador lo acepta
ausente y entonces toma el `clientReportId` como llave, pero la 04:89 lo declara
obligatorio, y un cliente que cumpla el contrato siempre lo envía. **La tolerancia
del servidor no es una razón para relajar el contrato.**

### Verificación

El archivo se comprobó con un test temporal que lo carga con snakeyaml y recorre
todos los `$ref`: 21 rutas, 27 esquemas, ninguna referencia rota. El test se borró
después; no quedó en el repositorio porque lee un archivo de fuera del módulo.

## 12. Requisito D — Alineación de `Usuarios` con la entidad

Este requisito no estaba en el contrato original. Se añadió al auditar el
documento contra `V1.0`, y **es el que puede hacer fallar la parte 3 en
producción**.

### Por qué hace falta

`V1.0` creó `Usuarios` y **ninguna migración posterior la modifica**: `V1.2` y
`V1.3` solo agregan llaves foráneas y renombran las tablas nuevas, y
`V1.2_README.md:26` dice expresamente que `Usuarios` se conserva sin cambios. La
tabla quedó en `INT` y con nombres y valores que ya no coinciden con la entidad.

| La entidad espera | `V1.0` define | Consecuencia si no se corrige |
|---|---|---|
| `Estado_Cuenta` con `ANONIMIZADA` y `BLOQUEADA` | `ENUM('ACTIVA','INACTIVA','SUSPENDIDA')` | **El trabajo diario falla** al guardar `ANONIMIZADA`: error de truncamiento. |
| `Nombre` nullable | `VARCHAR(150) NOT NULL` | **El trabajo diario falla** al ponerlo en `NULL`. |
| `Rol` con `USUARIO` | `ENUM('ADMIN','USER')` | No arranca ni con datos: leer una fila con `USER` falla al convertirla al enum del código, y guardar una cuenta nueva intenta insertar `USUARIO`, que el `ENUM` no admite. Además el `DEFAULT 'USER'` no corresponde a ningún valor del código. |
| `Contrasena_Hash` | `Contrasena` | No arranca: la columna no existe. |
| `Contacto_Autorizado` | `Consentimiento_Contacto` | No arranca: la columna no existe. |
| `Ultimo_Login` | `Fecha_Ultimo_Acceso` | No arranca, y es la columna con la que se mide el corte. |
| `Ultima_Actividad` | no existe | No arranca. |
| `Datos_Anonimizados` | no existe | No arranca: es el criterio que excluye a las cuentas ya limpiadas. |
| `Fecha_Actualizacion` | no existe | No arranca. |
| `Correo` de 254 | `VARCHAR(50)` | Un correo válido de más de 50 caracteres no entra. |
| `Telefono` de 25 | `VARCHAR(20)` | Un teléfono válido de más de 20 caracteres no entra. |
| `ID_Usuario` como `Long` | `INT` | Límite de 2 147 483 647 usuarios. Aceptable en el MVP. |

### Primero comprobar, después alterar

**El esquema real se construyó con `ddl-auto=update`, no con Flyway.** Es posible
que estas columnas ya existan con el nombre correcto, y en ese caso el `ALTER`
fallaría por columna duplicada o por nombre inexistente. Correr esto antes:

```sql
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Usuarios'
ORDER BY ORDINAL_POSITION;
```

- Si `Contrasena_Hash`, `Contacto_Autorizado`, `Ultimo_Login`, `Ultima_Actividad`,
  `Datos_Anonimizados` y `Fecha_Actualizacion` ya están, y `Estado_Cuenta` admite
  los tres valores y `Nombre` es nullable, **no hay nada que hacer**. La tabla la
  construyó Hibernate a partir de la entidad.
- Si faltan o no admiten los valores, aplicar el bloque de abajo, omitiendo las
  líneas que no correspondan.

### El DDL

```sql
-- Los dos ENUM se amplian antes de renombrar columnas, porque las filas
-- El ENUM de Rol se amplía PRIMERO, conservando 'USER' temporalmente.
-- Traducirlo antes no funciona: un UPDATE a un valor que el ENUM todavía no
-- admite falla con "Data truncated for column 'Rol'".
ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('USUARIO','ADMIN','USER') NOT NULL DEFAULT 'USUARIO',
    MODIFY COLUMN Estado_Cuenta
        ENUM('ACTIVA','INACTIVA','SUSPENDIDA','BLOQUEADA','ANONIMIZADA')
        NOT NULL DEFAULT 'ACTIVA',
    MODIFY COLUMN Nombre VARCHAR(150) NULL,
    MODIFY COLUMN Correo VARCHAR(254) NOT NULL,
    MODIFY COLUMN Telefono VARCHAR(25) NULL,
    MODIFY COLUMN Mayor_Edad TINYINT(1) NOT NULL DEFAULT 1,
    MODIFY COLUMN Fecha_Creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHANGE COLUMN Contrasena Contrasena_Hash VARCHAR(255) NOT NULL,
    CHANGE COLUMN Consentimiento_Contacto Contacto_Autorizado TINYINT(1) NOT NULL DEFAULT 0,
    CHANGE COLUMN Fecha_Ultimo_Acceso Ultimo_Login TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN Ultima_Actividad TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN Datos_Anonimizados TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN Fecha_Actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP;

-- Ahora que 'USUARIO' ya es un valor válido, se traduce el viejo.
UPDATE Usuarios SET Rol = 'USUARIO' WHERE Rol = 'USER';

-- Opcional, solo cuando el SELECT de abajo devuelva 0 filas: quitar 'USER'.
ALTER TABLE Usuarios
    MODIFY COLUMN Rol ENUM('USUARIO','ADMIN') NOT NULL DEFAULT 'USUARIO';
```

Tres detalles que no son evidentes:

- **El orden importa.** Ampliar el `ENUM` antes de traducir. Al revés, el `UPDATE`
  falla por truncamiento.
- `Fecha_Ultimo_Acceso` se renombra a `Ultimo_Login` **y se le quita el
  `ON UPDATE CURRENT_TIMESTAMP`**. `V1.0` lo traía y es peligroso: si se dejara, cada
  actualización de la fila cambiaría la columna con la que se mide el periodo de
  inactividad, y ninguna cuenta vencería nunca.
- El bloque añade dos columnas `TIMESTAMP` con `CURRENT_TIMESTAMP` por defecto,
  más la que ya traía `Fecha_Creacion`. MySQL solo permite varias así desde la 5.6;
  en una 5.5 el `ALTER` entero falla. Verificar la versión antes.

Sobre el `ENUM` de `Estado_Cuenta`: se conservan `INACTIVA` y `SUSPENDIDA` aunque
el código no los use, porque podría haber filas con esos valores y eliminarlos
convertiría un dato existente en error.

`ID_Usuario` **no** se widen a `BIGINT` aquí. La entidad lo mapea como `Long`, pero
cambiarlo obligaría a revisar la llave foránea de `Bitacora_Administrativa` y de las
tablas del Requisito B, y para el MVP el límite de `INT` no aprieta. Queda como
deuda técnica.

### Verificación

```sql
-- 1) Debe incluir ANONIMIZADA y BLOQUEADA.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'Usuarios'
  AND COLUMN_NAME IN ('Estado_Cuenta','Rol','Nombre');

-- 2) Cuantas filas quedan con el valor viejo. Ejecutar ANTES del ALTER opcional
--    que quita 'USER': despues, comparar contra un valor fuera del ENUM da error
--    de truncamiento en vez de un 0.
SELECT COUNT(*) FROM Usuarios WHERE Rol = 'USER';

-- 3) La prueba de fuego: esto es lo que hace el trabajo diario.
UPDATE Usuarios SET Estado_Cuenta = 'BLOQUEADA' WHERE ID_Usuario = -1;
-- Debe Affected rows: 0 y ningún error. Si lanza truncamiento, falta el valor.
```

Y en la aplicación, con una cuenta real de prueba: arrancar, iniciar sesión, forzar
`dogalert.retention.inactivity-months=0`, ejecutar el trabajo y comprobar que la
cuenta queda `ANONIMIZADA` con el correo centinela.

### Nota sobre el correo centinela

La retención escribe `anonimizado+<ID_Usuario>@dogalert.invalid`. Con `Correo` en
`VARCHAR(50)` el valor más largo posible es `anonimizado+` (12) + `BIGINT` (20) +
`@dogalert.invalid` (17) = 49 caracteres: entra por poco. Por eso `Correo` se
agranda a 254 en lugar de dejarlo en 50.