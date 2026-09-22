# Dog Alert

Aplicación móvil desarrollada con React Native + Expo para reportes de perros en situación de calle, con flujo de autenticación, información pública, protocolos de seguridad y consumo de servicios del backend.

## Descripción general

La app incluye:

- Pantalla de inicio
- Inicio de sesión
- Registro de usuario
- Cierre de sesión
- Pantalla de protocolos de seguridad
- Información pública consumida desde endpoints del backend
- Manejo de estados de carga, error y datos vacíos
- Navegación con React Navigation

## Tecnologías

- React Native
- Expo
- JavaScript
- React Navigation
- Jest + Testing Library React Native

## Estructura del proyecto

```bash
Frontend/
└── Dog-Alert/
    ├── App.js
    ├── .env
    ├── package.json
    ├── README.md
    ├── apis/
    │   └── API_Client.js
    ├── hooks/
    │   └── UseAuth.js
    ├── screens/
    │   ├── InicioScreen.js
    │   ├── InicioSesionScreen.js
    │   ├── CrearCuentaScreen.js
    │   ├── ProtocoloDeSeguridad.js
    │   └── PublicInfoScreen.js
    └── tests/
        └── screens/
            ├── InicioScreen.test.js
            ├── InicioSesionScreen.test.js
            ├── CrearCuentaScreen.test.js
            └── ProtocoloDeSeguridad.test.js
```

## Requisitos previos

- Node.js instalado
- npm o yarn
- Expo CLI
- Android Studio / Xcode para emulación nativa
- Backend corriendo y accesible desde la red local

## Instalación

1. Entra a la carpeta del frontend:

```bash
cd Simi-Wild-Scan/Frontend/Dog-Alert
```

2. Instala dependencias:

```bash
npm install
```

## Configuración de entorno

La app usa la variable de entorno:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8080
```

Importante:

- Debe apuntar a la IP o dominio donde corre tu backend.
- Si usas un dispositivo real, normalmente necesitas la IP de tu PC donde está el backend.
- Para emulador Android, puede usarse localhost o 10.0.2.2 dependiendo del caso.

Ejemplo:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080
```

## Ejecutar la app

### Web

```bash
npm run web
```

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

### Inicio normal

```bash
npm start
```

## Endpoints esperados del backend

La app usa estas rutas principales:

- `/actuator/health`
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/logout`
- `/api/public/info`
- `/api/public/reports`

Si tu backend usa otras rutas, solo debes ajustar la configuración y los endpoints en [apis/API_Client.js](apis/API_Client.js).

## Autenticación

La lógica principal de sesión se maneja en [hooks/UseAuth.js](hooks/UseAuth.js):

- `login(payload)`
- `register(payload)`
- `logout()`
- estado `loading`
- estado `error`
- estado `response`

## Pantallas principales

- [App.js](App.js): navega entre pantallas con React Navigation.
- [screens/InicioScreen.js](screens/InicioScreen.js): pantalla de bienvenida.
- [screens/InicioSesionScreen.js](screens/InicioSesionScreen.js): inicio de sesión.
- [screens/CrearCuentaScreen.js](screens/CrearCuentaScreen.js): registro de usuario.
- [screens/ProtocoloDeSeguridad.js](screens/ProtocoloDeSeguridad.js): protocolo recomendado para situaciones de riesgo.
- [screens/PublicInfoScreen.js](screens/PublicInfoScreen.js): estado del backend e información pública.

## Pruebas

Se configuró Jest con React Native Testing Library.

Ejecuta las pruebas con:

```bash
npm test
```

O directamente:

```bash
npx jest --runInBand --ci --verbose
```

## Buenas prácticas recomendadas

- Mantén la IP del backend actualizada en `.env`.
- En dispositivos reales, evita usar `localhost` si la app corre en un teléfono.
- Si el backend responde con otros nombres de campos en JSON, ajusta la lógica de parsing en [apis/API_Client.js](apis/API_Client.js).
- Para más seguridad, considera guardar el token en almacenamiento persistente en futuras versiones.

## Nota final

Este proyecto está preparado como base para una aplicación móvil funcional, con flujo real de autenticación, carga de información pública y navegación entre pantallas. Si el backend real tiene una API distinta, sólo hace falta mapear las rutas y los campos del JSON.
