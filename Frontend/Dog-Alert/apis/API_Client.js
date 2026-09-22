const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

async function fetchJson(url, options = {}, fallbackMessage = 'Error de conexión') {
  const response = await fetch(url, options);

  if (response.status === 204) {
    return null;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data !== null && data.message) ||
      (typeof data === 'object' && data !== null && data.error) ||
      fallbackMessage;

    throw new Error(message || fallbackMessage);
  }

  return data;
}

export async function getHealthStatus() {
  return fetchJson(`${API_BASE_URL}/actuator/health`, { method: 'GET' }, 'No se pudo consultar el estado del servidor');
}

export async function getPublicInfo() {
  const response = await fetchJson(
    `${API_BASE_URL}/api/public/info`,
    { method: 'GET' },
    'No hay información pública disponible'
  );

  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (typeof response === 'object') {
    return [response];
  }

  return [];
}

export async function getPublicReports() {
  const response = await fetchJson(
    `${API_BASE_URL}/api/public/reports`,
    { method: 'GET' },
    'No hay reportes públicos disponibles'
  );

  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (typeof response === 'object') {
    return [response];
  }

  return [];
}

export async function loginUser(payload) {
  return fetchJson(
    `${API_BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    'Credenciales inválidas'
  );
}

export async function registerUser(payload) {
  return fetchJson(
    `${API_BASE_URL}/api/auth/register`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    'No se pudo crear la cuenta'
  );
}

export async function logoutUser() {
  return fetchJson(
    `${API_BASE_URL}/api/auth/logout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    'No se pudo cerrar la sesión'
  );
}
