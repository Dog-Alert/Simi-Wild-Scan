import { REPORT_ERROR_CODES, ReportApiError, buildErrorFromResponse } from './reportsApi';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

const MY_REPORTS_PATH = '/v1/me/reports';

export const MY_REPORTS_ERROR_CODES = {
  notFound: 'REPORT_NOT_FOUND',
  notEditable: 'REPORT_NOT_EDITABLE',
};

const MESSAGES = {
  noSession: 'Inicia sesión para ver tus reportes.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  // El backend responde 404 tambien para reportes ajenos, a proposito.
  notFound: 'Este reporte ya no existe.',
  notEditable: 'Este reporte ya no se puede modificar.',
  unexpected: 'El servidor respondió de forma inesperada. Inténtalo de nuevo.',
};

async function request(path, { token, method = 'GET', body } = {}) {
  if (!token) {
    throw new ReportApiError(MESSAGES.noSession, { code: REPORT_ERROR_CODES.unauthorized });
  }

  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${MY_REPORTS_PATH}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ReportApiError(MESSAGES.network, { code: REPORT_ERROR_CODES.network });
  }

  if (response.status === 404) {
    throw new ReportApiError(MESSAGES.notFound, {
      code: MY_REPORTS_ERROR_CODES.notFound,
      status: 404,
    });
  }

  if (response.status === 409) {
    throw new ReportApiError(MESSAGES.notEditable, {
      code: MY_REPORTS_ERROR_CODES.notEditable,
      status: 409,
    });
  }

  if (!response.ok) {
    throw await buildErrorFromResponse(response);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    throw new ReportApiError(MESSAGES.unexpected, {
      code: REPORT_ERROR_CODES.server,
      status: response.status,
    });
  }
}

export async function listMyReports({ token, cursor = null } = {}) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const page = await request(query, { token });

  return {
    items: Array.isArray(page && page.items) ? page.items : [],
    nextCursor: (page && page.nextCursor) || null,
  };
}

export function getMyReport({ token, reportId }) {
  return request(`/${encodeURIComponent(reportId)}`, { token });
}

export function updateMyReport({ token, reportId, payload }) {
  return request(`/${encodeURIComponent(reportId)}`, { token, method: 'PATCH', body: payload });
}

export async function deleteMyReport({ token, reportId }) {
  await request(`/${encodeURIComponent(reportId)}`, { token, method: 'DELETE' });
  return true;
}
