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

> **Nota:** Asegúrate siempre de probar tus scripts `V` y `U` en tu entorno local (aplicando y revirtiendo) antes de solicitar una revisión de código. No subas credenciales, IPs públicas ni información sensible en estos scripts.