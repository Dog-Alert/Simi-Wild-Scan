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
**No pide ningún cambio de esquema.** Usa solo columnas que ya existen.

> Nota de numeración: el SRS llama RF-044 a la anonimización y RF-045 a los
> protocolos de seguridad, mientras que `11_pruebas_trazabilidad.md` desplaza todo
> en uno. El SRS es la fuente autoritativa y es el que se sigue aquí.

### Qué se borra y qué sobrevive

La fila de `Usuarios` **no se elimina ni se anonimiza**: se le quitan los datos
personales y se marca con `Datos_Anonimizados = true` y
`Estado_Cuenta = 'ANONIMIZADA'`.

| Columna | Qué pasa | Por qué |
|---|---|---|
| `Nombre` | a `NULL` | Es dato personal (SDD 9.4). Es nullable, no da problema. |
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