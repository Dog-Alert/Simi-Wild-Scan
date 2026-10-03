const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

async function fetchJson(url, options = {}, fallbackMessage = 'Error de conexión') {
  const response = await fetch(url, options);

  if (response.status === 204) {
    return null;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const body = typeof data === 'object' && data !== null ? data : {};
    const message =
      (body.error && typeof body.error === 'object' && body.error.message) ||
      (typeof body.error === 'string' && body.error) ||
      body.message ||
      fallbackMessage;

    const error = new Error(message);
    error.details = body.error && Array.isArray(body.error.details) ? body.error.details : [];
    throw error;
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
    `${API_BASE_URL}/v1/auth/login`,
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

// Los mensajes de Bean Validation para estos campos llegan en ingles.
const REGISTER_FIELD_MESSAGES = {
  email: 'Escribe un correo electrónico válido.',
  password: 'La contraseña debe tener entre 8 y 128 caracteres.',
  name: 'El nombre no puede pasar de 150 caracteres.',
};

export function toRegisterRequest(form) {
  return {
    name: form.fullName && form.fullName.trim() ? form.fullName.trim() : null,
    email: form.email ? form.email.trim() : '',
    password: form.password || '',
    adultConfirmed: Boolean(form.adult),
    privacyAccepted: Boolean(form.terms),
  };
}

export async function registerUser(form) {
  try {
    return await fetchJson(
      `${API_BASE_URL}/v1/auth/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toRegisterRequest(form)),
      },
      'No se pudo crear la cuenta'
    );
  } catch (error) {
    if (error.details && error.details.length) {
      error.message = error.details
        .map((detail) => REGISTER_FIELD_MESSAGES[detail.field] || detail.message)
        .join('\n');
    }

    throw error;
  }
}

export async function logoutUser(token) {
  return fetchJson(
    `${API_BASE_URL}/v1/auth/logout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    'No se pudo cerrar la sesión'
  );
}
