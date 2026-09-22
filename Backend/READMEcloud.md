# DogAlert Backend

API REST de DogAlert desarrollada con Spring Boot para registrar y consultar avistamientos de perros sin responsable visible en Creel, Chihuahua.

---

## 🛠️ Versiones y Tecnologías

* **Java:** 21
* **Framework:** Spring Boot 3.3.4
* **Base de Datos:** PostgreSQL / Cloud SQL
* **Despliegue:** Google Cloud Run
* **Contenedores:** Docker / Google Cloud Build
* **Gestión de Secretos:** Google Secret Manager

---

## 🚀 Guía de Despliegue de Backend (dogalert-api) en Google Cloud Run

Este documento contiene los pasos detallados para configurar el entorno local, aplicar migraciones en Cloud SQL y desplegar nuevas revisiones del servicio `dogalert-api` en Google Cloud Run.

### 📌 Datos de la Infraestructura

* **ID del Proyecto GCP:** `dogalert-server-26`
* **Región:** `northamerica-south1`
* **Nombre del Servicio:** `dogalert-api`
* **URL HTTPS Producción:** https://dogalert-api-230853693979.northamerica-south1.run.app
* **Manejo de Secretos:** Google Secret Manager

---

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado y configurado en tu equipo:

* Git
* Docker Desktop (ejecutándose en segundo plano)
* Google Cloud SDK (gcloud CLI)

---

## 🛠️ 1. Configuración Inicial del Entorno Local

### Paso 1.1: Actualizar el repositorio

Obtén la última versión del código desde la rama principal:

```bash
git checkout main
git pull origin main
```

### Paso 1.2: Autenticar Google Cloud SDK

Inicia sesión con tu cuenta de GCP con acceso al proyecto y autoriza a Docker:

```bash
# Iniciar sesión en GCP
gcloud auth login

# Configurar Docker para autenticarse con el registro de imágenes de GCP
gcloud auth configure-docker
```

### Paso 1.3: Seleccionar el Proyecto de Google Cloud

Establece el proyecto activo:

```bash
gcloud config set project dogalert-server-26
```

---

## 🗄️ 2. Migraciones y Base de Datos (Cloud SQL)

Dado que las migraciones y la inserción de datos se gestionan mediante scripts SQL:

1. Conéctate a la instancia de Cloud SQL (usando Cloud SQL Auth Proxy o el cliente SQL de tu preferencia con los permisos autorizados).
2. Ejecuta los scripts correspondientes para la creación/actualización de tablas e inserción de datos iniciales.
3. Comprueba que la estructura de la base de datos esté lista antes de publicar la nueva versión de la API.

---

## 📦 3. Compilación y Despliegue a Cloud Run

> **IMPORTANTE:** Para conservar la misma URL HTTPS (`https://dogalert-api-230853693979.northamerica-south1.run.app`) y la vinculación con Secret Manager, se debe desplegar obligatoriamente en la región `northamerica-south1` con el nombre de servicio `dogalert-api`.

### Despliegue Automático con Cloud Build (Recomendado)

Ejecuta los siguientes comandos desde la raíz del proyecto para compilar la imagen en la nube y publicar la nueva revisión:

```bash
# 1. Compilar y subir la imagen Docker a Artifact/Container Registry
gcloud builds submit --tag gcr.io/dogalert-server-26/dogalert-api:latest

# 2. Desplegar la nueva revisión en Cloud Run
gcloud run deploy dogalert-api \
  --image gcr.io/dogalert-server-26/dogalert-api:latest \
  --region northamerica-south1 \
  --platform managed
```

---

## 🔍 4. Verificación de Criterios de Aceptación (Jira)

Una vez completado el despliegue:

1. **Confirmar URL HTTPS:** Verifica que la terminal confirme el despliegue en: `https://dogalert-api-230853693979.northamerica-south1.run.app`
2. **Prueba End-to-End:** Ejecuta el flujo desde la aplicación móvil $\rightarrow$ Cloud Run $\rightarrow$ Cloud SQL.
3. **Revisión de Logs en Google Cloud Console:**
   * Ve a **Cloud Run** > **dogalert-api** > pestaña **Logs**.
   * Confirma que las peticiones respondan con códigos HTTP exitosos (200/201) y valida que no se estén exponiendo datos sensibles, secretos ni coordenadas exactas.
4. **Evidencia para Jira:** Toma captura de pantalla de la ejecución exitosa y los logs, y adjunta la URL HTTPS a la historia correspondiente.

---

## ⚠️ Checklist de Seguridad y Calidad

- [ ] No subir credenciales ni archivos `.env` al repositorio Git.
- [ ] Confirmar que las variables sensibles sigan vinculadas a Secret Manager.
- [ ] Garantizar que no se almacenen ni procesen reportes fuera del perímetro establecido (Creel).