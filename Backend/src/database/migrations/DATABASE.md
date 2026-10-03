# 📁 Base de Datos: Scripts de Migración (Schemas)

Esta carpeta contiene los scripts SQL que definen la estructura (esquemas, tablas, índices y restricciones) de la base de datos `dogalert`. 

Utilizamos un enfoque de **Database-as-Code (Base de datos como código)**. Esto garantiza que todos los desarrolladores del equipo trabajen sobre la misma estructura, facilita los despliegues a producción y mantiene un historial claro de cómo ha evolucionado nuestra base de datos.

---

## 🗂️ Nomenclatura de Archivos

Seguimos una convención estricta para nombrar los archivos en pares (Subida y Reversión):

* **Prefijo `V` (Version / Up):** Scripts que aplican cambios (crear tablas, agregar columnas, insertar datos base).
* **Prefijo `U` (Undo / Down):** Scripts de reversión segura. Deshacen **exactamente** lo que hizo su archivo `V` correspondiente (borrar tablas, eliminar columnas). 
* **Estructura:** `[V/U][Número_de_Versión]__[Descripción].sql`

**Ejemplo:**
* `V1.0__crear_usuarios_y_roles.sql`
* `U1.0__revertir_usuarios_y_roles.sql`

---

## 🚀 Cómo ejecutar los scripts (Para inicializar tu entorno)

Si acabas de clonar el proyecto o necesitas levantar tu entorno local/desarrollo desde cero usando DBeaver (o tu cliente SQL preferido):

1. Conéctate a tu base de datos `dogalert` por medio de DBeaver.
2. Abre los archivos `V`, copia su contenido y ejecútalos en DBeaver en **orden secuencial ascendente** (V1.0, luego V1.1, luego V1.2, etc.).
3. Si en algún momento necesitas limpiar la base de datos, ejecuta los archivos `U` en **orden inverso** (U1.1, luego U1.0). El orden inverso es **crucial para no romper las restricciones** de llaves foráneas.

---

## ⚠️ Las migraciones son MANUALES y `ddl-auto=update` sigue activo

Esto no es una preferencia del equipo, es el estado real del proyecto y conviene entenderlo antes de tocar cualquier script.

**Flyway está activado pero no ejecuta nada.** En `application.properties` figura `spring.flyway.enabled=true`, pero los scripts viven en `src/database/migrations/`, fuera del `classpath:db/migration` que Flyway inspecciona. Flyway no encuentra ningún script, no registra ninguna versión y nunca aplica una migración. Por eso el proceso real es manual: DBeaver o Cloud SQL Auth Proxy, en orden.

**`spring.jpa.hibernate.ddl-auto=update` está activo en la aplicación.** Hibernate modifica el esquema al arrancar. Esto tiene tres consecuencias que ya han causado problemas:

| Consecuencia | Qué pasó |
|---|---|
| El esquema real se desincroniza de los scripts | `Usuarios` tiene `Ultima_Actividad`, `Datos_Anonimizados`, `Contrasena_Hash`, `Contacto_Autorizado` y `Ultimo_Login`, columnas que `V1.0_crear_usuarios_y_roles.sql` **no crea**. Las agregó Hibernate en tiempo de ejecución. |
| Los scripts pueden fallar contra el esquema real | Un índice sobre una columna que solo existe por el `update` de Hibernate falla en una base construida únicamente con los scripts. |
| Un orden incorrecto rompe la aplicación | Si la aplicación arranca contra una tabla a medio migrar, Hibernate intenta completar el esquema por su cuenta. |

**Reglas que se siguen en la práctica, y el motivo de cada una:**

1. **Aplicar el SQL primero, arrancar la aplicación después.** Nunca al revés: Hibernate no debe ver una tabla a medio migrar.
2. **Cada columna nueva que no pueda tener default debe nacer NULLable.** Con `ddl-auto=update`, un `INSERT` de Hibernate omite las columnas que la entidad todavía no mapea. Si esa columna es `NOT NULL` y no tiene default, MySQL responde error 1048 y **la creación de reportes se detiene por completo**. Por eso C3 usó dos fases (ver más abajo).
3. **Verificar el espacio en disco antes de cualquier `ALTER` que reconstruya la tabla.** Un `MODIFY ... NOT NULL` o un `MODIFY` de un `ENUM` reconstruye la tabla y necesita aproximadamente el doble de su tamaño.
4. **Ejecutar las reconstrucciones en ventana de baja carga.** Toman un `LOCK` de escritura sobre toda la tabla.
5. **Al terminar, comprobar que el esquema coincide con lo aplicado.** `SHOW CREATE TABLE` sobre las tablas tocadas.

> Cambiar `ddl-auto` a `validate` está fuera del alcance actual (decisión **C3-D10**): hacerlo sobre una instancia de Cloud Run en servicio es un riesgo mayor que el beneficio en este ticket. Queda como deuda técnica a resolver junto con la reconciliación de `User.java` contra `V1.0`.

---

## 🛠️ Cómo hacer futuras modificaciones

Si estás trabajando en un nuevo ticket y necesitas modificar la base de datos (agregar una tabla, una columna, un índice), sigue estas reglas:

### ⚠️ Regla de Oro: NUNCA modifiques un script `V` existente en `main`
Una vez que un archivo (ej. `V1.0...sql`) se ha fusionado a la rama `main` y aplicado en producción o desarrollo, **queda bloqueado**. No debes editarlo para agregar nuevas columnas, ya que rompería el control de versiones.

### ✅ El proceso correcto:
1. Revisa cuál es la última versión en esta carpeta (supongamos que es la `1.1`).
2. Crea un **nuevo** par de archivos incrementando la versión (ej. `V1.2` y `U1.2`).
3. En tu archivo `V`, escribe el comando `ALTER TABLE` o `CREATE TABLE` necesario.
   * *Ejemplo V1.2: `ALTER TABLE Usuarios ADD COLUMN Direccion VARCHAR(200);`*
4. En tu archivo `U`, escribe cómo deshacer ese cambio exacto.
   * *Ejemplo U1.2: `ALTER TABLE Usuarios DROP COLUMN Direccion;`*
5. Sube tu PR con estos nuevos archivos.

---

## 📋 Estado de las versiones

| Versión | Script `V` | Contenido | Revertir con |
|---|---|---|---|
| 1.0 | `V1.0_crear_usuarios_y_roles.sql` | `Usuarios` | `U1.0__revertir_usuarios_y_roles.sql` |
| 1.1 | `V1.1__crear_contenido_publico_incidentes.sql` | `Registros`, `Fotos`, `Bitacora_Administrativa` | `U1.1__revertir_contenido_publico_incidentes.sql` |
| 1.2 | `V1.2__crear_reportes_ubicacion_evidencia.sql` | `Reportes`, `Evidencias_Reportes`, `Poligonos_Creel` | `U1.2__revertir_reportes_ubicacion_evidencia.sql` |
| 1.3 | `V1.3__reportes_idempotencia_actividad_conservacion.sql` | `Reportes`: actividad y conservación. `Bitacora_Administrativa`: extensiones para trazabilidad | `U1.3__revertir_reportes_idempotencia_actividad_conservacion.sql` |
| 1.4 | `V1.4__sincronizacion_idempotencia_reportes_propios.sql` | Tabla `idempotencia_reportes`, bitácora apta para acciones del autor, índice de reportes propios y alineación de `Usuarios` con la entidad | `U1.4__revertir_sincronizacion_idempotencia_reportes_propios.sql` |
| 1.5 | `V1.5__indice_retencion_cuentas.sql` | Índice de retención `(Datos_Anonimizados, Ultimo_Login)` | `U1.5__revertir_indice_retencion_cuentas.sql` |
| 1.6 | `V1.6__promover_conservacion_not_null.sql` | Fase 2: promoción de `Fecha_Conservacion_Hasta` a `NOT NULL` | `U1.6__revertir_promocion_not_null.sql` |

Notas de la serie 1.3-1.6 (épica Jira **103**, planning en `.agents/C3-PLANNING.md`):

- **`V1.0` usa un guion bajo y los demás dos.** Es un defecto conocido y no se corrige aquí porque la regla de oro prohíbe tocar un `V` ya aplicado.
- **La idempotencia NO vive en `Reportes`.** `V1.3` ya no crea `Clave_Idempotencia` ni `Hash_Payload` en esa tabla: la lleva `V1.4` en `idempotencia_reportes`, para que la fila sobreviva al borrado físico del reporte por su autor (RF-026) y el UUID siga consumido.
- **`V1.4` es condicional a propósito.** El esquema real lo construyó `ddl-auto=update`, así que columnas que el contrato da por inexistentes pueden existir ya. Cada bloque consulta `information_schema` antes de alterar y el script se puede correr contra el esquema de Hibernate, contra el de los scripts, o contra ambos mezclados.
- **`V1.5` es idempotente.** Crea `idx_usuarios_retencion` solo si existen `Datos_Anonimizados` y `Ultimo_Login`; si falta alguna, omite y avisa en vez de abortar.
- **`V1.6` NO se aplica todavía.** Exige que el backend del ticket siguiente ya mapee `Fecha_Conservacion_Hasta`. Si se aplica antes, aborta solo, sin tocar la tabla.
- **Por qué hay dos fases.** V1.3 crea `Fecha_Conservacion_Hasta` NULLable, en vez de `NOT NULL` como pedía el planning original. Motivo: `Report.java` no la mapea todavía, y un `INSERT` de Hibernate que omita una columna `NOT NULL` sin default falla con error 1048 y detiene la creación de reportes. La Fase 2 es la que aplica el `NOT NULL`, una vez que el backend la escriba.
- **`User.java` y `V1.0` siguen sin reconciliar.** `Usuarios.ID_Usuario` es INT mientras la entidad lo mapea como `Long`. Por eso `idempotencia_reportes.ID_Usuario` va **sin llave foránea** a propósito: una FK `BIGINT → INT` la rechaza MySQL. Deuda técnica pendiente.

---

> **Nota:** Asegúrate siempre de probar tus scripts `V` y `U` en tu entorno local (aplicando y revirtiendo) antes de solicitar una revisión de código. No subas credenciales, IPs públicas ni información sensible en estos scripts.