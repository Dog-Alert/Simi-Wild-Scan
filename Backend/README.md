# DogAlert Backend

API REST de DogAlert desarrollada con Spring Boot para registrar y consultar avistamientos de perros sin responsable visible en Creel, Chihuahua.

## Tecnologías

- Java 21
- Spring Boot 4.1.1
- Spring Security
- JSON Web Tokens (JWT)
- Spring Data JPA
- MySQL
- Flyway
- Maven
- Google Cloud Run
- Google Cloud SQL

## Requisitos

- JDK 21
- Acceso a una base de datos MySQL
- Variables de entorno configuradas

El proyecto incluye Maven Wrapper, por lo que no es necesario instalar Maven globalmente.

## Variables de entorno

| Variable | Descripción | Obligatoria |
|---|---|---|
| `DB_URL` | URL JDBC de la base MySQL | Sí |
| `DB_USER` | Usuario de aplicación de MySQL | Sí |
| `DB_PASSWORD` | Contraseña del usuario de MySQL | Sí |
| `JWT_SECRET` | Secreto Base64 de al menos 32 bytes | Sí |
| `JWT_EXPIRATION_MINUTES` | Duración del JWT en minutos | No |
| `PORT` | Puerto HTTP; utiliza 8080 por defecto | No |

No se deben guardar valores reales de estas variables en GitHub, Jira, código fuente, documentación o archivos versionados.

## Generar un secreto JWT local

En Windows PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
```

Para comprobar que contiene 32 bytes sin mostrar el secreto:

```powershell
[Convert]::FromBase64String($env:JWT_SECRET).Length
```

## Configuración local

Ejemplo utilizando una instancia local de MySQL:

```powershell
$env:DB_URL = "jdbc:mysql://localhost:3306/dogalert"
$env:DB_USER = "dogalert_app"
$env:DB_PASSWORD = "contraseña-local"
$env:JWT_EXPIRATION_MINUTES = "60"
$env:PORT = "8080"
```

Los valores anteriores son ejemplos. No copies contraseñas reales al repositorio.

## Ejecutar el backend

Desde la carpeta `Backend`:

```powershell
.\mvnw.cmd spring-boot:run
```

La API estará disponible localmente en:

```text
http://localhost:8080
```

## Ejecutar las pruebas

```powershell
.\mvnw.cmd clean test
```

El perfil de pruebas utiliza una base H2 temporal y no necesita acceso a Cloud SQL.

Actualmente el backend contiene 17 pruebas automatizadas para:

- Carga del contexto de Spring Boot.
- Registro de usuarios.
- Normalización del correo.
- Detección de correos duplicados.
- Hash de contraseñas.
- Inicio de sesión con credenciales válidas.
- Rechazo de credenciales inválidas.
- Validación de solicitudes.
- Generación y validación de JWT.
- Acceso a protocolos públicos.
- Endpoint de salud.
- Protección de rutas privadas.

## Endpoints implementados

## Endpoints implementados

| Método | Ruta | Autenticación |
|---|---|---|
| `POST` | `/v1/auth/register` | Pública |
| `POST` | `/v1/auth/login` | Pública |
| `POST` | `/v1/auth/logout` | JWT |
| `GET` | `/v1/public/protocols` | Pública |
| `GET` | `/v1/health` | Pública |
| `GET` | `/actuator/health` | Pública |

## Autenticación

Las rutas protegidas reciben el JWT mediante el encabezado:

```http
Authorization: Bearer <token>
```

El JWT incluye únicamente:

- Identificador del usuario.
- Rol.
- Fecha de emisión.
- Fecha de expiración.

El JWT no contiene nombre, correo, teléfono ni contraseña.

## Roles

- `USUARIO`: cuenta registrada de uso general.
- `ADMIN`: administración y moderación.

Las rutas bajo `/v1/admin/**` requieren el rol `ADMIN`.

## Códigos HTTP principales

| Código | Significado |
|---:|---|
| `200` | Solicitud correcta |
| `201` | Cuenta creada |
| `204` | Operación correcta sin contenido |
| `400` | JSON inválido |
| `401` | Credenciales o token inválidos |
| `403` | Permisos insuficientes |
| `409` | Correo ya registrado |
| `422` | Error de validación |

## Ejemplo de registro

Solicitud:

```http
POST /v1/auth/register
Content-Type: application/json
```

```json
{
  "name": "Usuario de prueba",
  "email": "usuario@example.com",
  "password": "ClaveSegura123!",
  "adultConfirmed": true,
  "privacyAccepted": true
}
```

Respuesta correcta:

```json
{
  "accessToken": "<token>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

## Ejemplo de inicio de sesión

Solicitud:

```http
POST /v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "usuario@example.com",
  "password": "ClaveSegura123!"
}
```

## Protocolos públicos

El endpoint:

```text
GET /v1/public/protocols
```

devuelve instrucciones de seguridad disponibles sin iniciar sesión. Incluye recomendaciones para:

- No acercarse.
- No perseguir.
- No alimentar.
- No intentar capturar al animal.
- Buscar ayuda ante un peligro inmediato.

## Base de datos

La aplicación utiliza MySQL. El esquema contempla la tabla `Usuarios` con:

- Correo único.
- Contraseña almacenada como hash.
- Rol.
- Confirmación de mayoría de edad.
- Aceptación del aviso de privacidad.
- Consentimiento opcional de contacto.
- Estado de la cuenta.
- Fechas de actividad.

Flyway administra las migraciones y Hibernate valida el esquema mediante:

```properties
spring.jpa.hibernate.ddl-auto=validate
```

La aplicación no debe utilizar `ddl-auto=create` en producción.

## Seguridad

- Las contraseñas se protegen mediante PBKDF2.
- Las contraseñas originales nunca se guardan.
- Los secretos se reciben mediante variables de entorno.
- La API no mantiene sesiones en el servidor.
- Las rutas administrativas requieren el rol `ADMIN`.
- El JWT tiene una duración configurable.
- No se deben registrar contraseñas, tokens o secretos en logs.
- Toda comunicación de producción debe utilizar HTTPS.

## Cloud Run

La aplicación obtiene el puerto mediante:

```properties
server.port=${PORT:8080}
```

Cloud Run proporciona `PORT` automáticamente.

Las credenciales de MySQL y el secreto JWT se configurarán mediante las variables y secretos administrados por el entorno de despliegue.

La creación de Cloud Run, la conexión con Cloud SQL y la configuración de Secret Manager corresponden al ticket DOG-28.

## Documentación de la API

El contrato completo se encuentra en:

```text
../SDD/docs/sdd/openapi.yaml
```

Las rutas y estructuras implementadas deben mantenerse alineadas con ese documento.

## Jira

Implementación inicial correspondiente a:

```text
DOG-24 — API base, autenticación JWT y rutas públicas
```