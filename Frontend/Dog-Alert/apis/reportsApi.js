/**
 * Cliente HTTP del reporte (parte 2 de C2).
 *
 * Contrato: `SDD/docs/sdd/openapi.yaml:142-180` (createReport) y
 * `openapi.yaml:723-742` (sobre de error).
 *
 * RUTA
 * ----
 * El contrato canonico declara `POST /v1/reports` y el backend (DOG-29)
 * lo expone en esa ruta. La ruta queda aislada en `REPORTS_PATH`.
 *
 * PRIVACIDAD
 * ----------
 * Este modulo no registra en consola ni en logs el payload, las coordenadas, la
 * foto ni el token. Ante un fallo solo se conservan codigo, mensaje del
 * servidor y `requestId` para que el usuario pueda reportarlo a soporte.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import * as Crypto from 'expo-crypto';

import { buildReportPayload, isReportValid, validateReport } from '../domain/reportValidation';
import { OUTSIDE_CREEL_MESSAGE } from '../const/reportCatalogs';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

const REPORTS_PATH = '/v1/reports';

/** Codigo que el backend devuelve al rechazar una coordenada fuera de Creel. */
const OUTSIDE_CREEL_CODE = 'LOCATION_OUTSIDE_CREEL';

export const REPORT_ERROR_CODES = {
  validation: 'REPORT_VALIDATION',
  outsideCreel: OUTSIDE_CREEL_CODE,
  conflict: 'REPORT_CONFLICT',
  deleted: 'REPORT_DELETED',
  rateLimited: 'REPORT_RATE_LIMITED',
  unauthorized: 'REPORT_UNAUTHORIZED',
  server: 'REPORT_SERVER_ERROR',
  network: 'REPORT_NETWORK_ERROR',
};

const MESSAGES = {
  validation: 'Revisa los datos del reporte antes de enviarlo.',
  conflict: 'Este reporte ya fue registrado. No lo envíes de nuevo.',
  deleted: 'Este reporte fue eliminado y no se puede volver a enviar.',
  rateLimited: 'Demasiados reportes seguidos. Espera un momento e inténtalo de nuevo.',
  unauthorized: 'Tu sesión expiró. Inicia sesión de nuevo o envía el reporte como anónimo.',
  server: 'No se pudo guardar el reporte. Inténtalo de nuevo en un momento.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  unexpected: 'El servidor respondió de forma inesperada. Inténtalo de nuevo.',
};

/**
 * Error del envio de reportes. `message` ya viene en espanol y es seguro
 * mostrarlo; `code` permite que la UI decida que hacer sin parsear texto.
 */
export class ReportApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ReportApiError';

    this.code = options.code || REPORT_ERROR_CODES.server;
    this.status = options.status ?? null;
    this.requestId = options.requestId || null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.fieldErrors = options.fieldErrors || {};
  }

  /** El backend rechazo la ubicacion: hay que pedirla de nuevo al usuario. */
  get isOutsideCreel() {
    return this.code === REPORT_ERROR_CODES.outsideCreel;
  }
}

/**
 * Identificador del reporte en el cliente. Se usa como `clientReportId` del
 * payload y como cabecera `Idempotency-Key`.
 *
 * Genera uno al empezar a llenar el formulario y REUTILIZALO en cada reintento
 * del mismo reporte: si se generara uno nuevo en cada intento, la clave de
 * idempotencia cambiaria y el backend crearia reportes duplicados en lugar de
 * devolver el primero.
 */
export function createClientReportId() {
  return Crypto.randomUUID();
}

function buildPhotoPart(photo) {
  const mimeType = photo.mimeType || 'image/jpeg';
  const extension = mimeType.split('/')[1] || 'jpg';

  return {
    uri: photo.uri,
    name: photo.fileName || `reporte.${extension}`,
    type: mimeType,
  };
}

/**
 * Arma el multipart de `POST /reports`. La foto viaja como parte aparte y nunca
 * dentro del JSON del payload.
 */
export function buildReportFormData(draft, clientReportId) {
  const form = new FormData();

  form.append('payload', JSON.stringify(buildReportPayload(draft, clientReportId)));

  if (draft.photo && draft.photo.uri) {
    form.append('photo', buildPhotoPart(draft.photo));
  }

  return form;
}

/**
 * Lee el cuerpo de una respuesta fallida. El servidor puede responder JSON con
 * el sobre `{ error: { code, message, requestId, details } }` o con texto
 * plano (proxy, 502 de un balanceador, HTML), y ninguno de los dos casos debe
 * romper el envio.
 */
async function readErrorBody(response) {
  const contentType = response.headers?.get?.('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Traduce `details` a {campo: mensaje}.
 *
 * El contrato declara `details: array of object` sin fijar la forma
 * (`openapi.yaml:734-736`), asi que solo se toma lo que se reconoce y se ignora
 * el resto. Hay que confirmar la forma real con el backend.
 */
function extractFieldErrors(details) {
  if (!Array.isArray(details)) {
    return {};
  }

  return details.reduce((errors, item) => {
    if (!item || typeof item !== 'object') {
      return errors;
    }

    const field = item.field || item.name;

    if (typeof field === 'string' && field) {
      errors[field] = typeof item.message === 'string' ? item.message : 'Dato no valido.';
    }

    return errors;
  }, {});
}

function parseRetryAfter(response) {
  const raw = response.headers?.get?.('retry-after');
  const seconds = Number(raw);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function buildError(response, body) {
  const serverError = body && typeof body === 'object' ? body.error : null;
  const code = serverError && typeof serverError.code === 'string' ? serverError.code : null;
  const requestId =
    serverError && typeof serverError.requestId === 'string' ? serverError.requestId : null;
  const fieldErrors = extractFieldErrors(serverError ? serverError.details : null);

  if (code === OUTSIDE_CREEL_CODE) {
    return new ReportApiError(OUTSIDE_CREEL_MESSAGE, {
      code,
      status: response.status,
      requestId,
      fieldErrors,
    });
  }

  if (response.status === 401) {
    return new ReportApiError(MESSAGES.unauthorized, {
      code: REPORT_ERROR_CODES.unauthorized,
      status: response.status,
      requestId,
    });
  }

  if (response.status === 409) {
    return new ReportApiError(MESSAGES.conflict, {
      code: REPORT_ERROR_CODES.conflict,
      status: response.status,
      requestId,
    });
  }

  if (response.status === 410) {
    return new ReportApiError(MESSAGES.deleted, {
      code: REPORT_ERROR_CODES.deleted,
      status: response.status,
      requestId,
    });
  }

  if (response.status === 429) {
    return new ReportApiError(MESSAGES.rateLimited, {
      code: REPORT_ERROR_CODES.rateLimited,
      status: response.status,
      requestId,
      retryAfterSeconds: parseRetryAfter(response),
    });
  }

  if (response.status === 422) {
    return new ReportApiError(MESSAGES.validation, {
      code: REPORT_ERROR_CODES.validation,
      status: response.status,
      requestId,
      fieldErrors,
    });
  }

  // 5xx y cualquier otro estado: nunca se muestra el texto crudo del servidor.
  return new ReportApiError(MESSAGES.server, {
    code: REPORT_ERROR_CODES.server,
    status: response.status,
    requestId,
  });
}

export async function buildErrorFromResponse(response) {
  return buildError(response, await readErrorBody(response));
}

/**
 * Envia el reporte.
 *
 * @param {object} options
 * @param {object} options.draft          Borrador del formulario.
 * @param {string} options.clientReportId  UUID v4 estable entre reintentos.
 * @param {string} [options.token]        JWT propio. Sin el, el reporte es anonimo.
 * @param {boolean} [options.skipLocalValidation]  Solo para pruebas.
 * @returns {Promise<{id:number, clientReportId:string, status:string, replayed:boolean}>}
 * @throws {ReportApiError}
 */
export async function submitReport({
  draft,
  clientReportId,
  token,
  skipLocalValidation = false
} = {}) {
  if (!clientReportId) {
    throw new ReportApiError(MESSAGES.validation, { code: REPORT_ERROR_CODES.validation });
  }

  if (!skipLocalValidation && !isReportValid(draft)) {
    throw new ReportApiError(MESSAGES.validation, {
      code: REPORT_ERROR_CODES.validation,
      fieldErrors: validateReport(draft),
    });
  }

  const headers = {
    Accept: 'application/json',
    'Idempotency-Key': clientReportId,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // No se fija Content-Type: fetch debe generar el boundary del multipart.
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${REPORTS_PATH}`, {
      method: 'POST',
      headers,
      body: buildReportFormData(draft, clientReportId),
    });
  } catch {
    throw new ReportApiError(MESSAGES.network, { code: REPORT_ERROR_CODES.network });
  }

  if (!response.ok) {
    throw buildError(response, await readErrorBody(response));
  }

  let receipt;

  try {
    receipt = await response.json();
  } catch {
    throw new ReportApiError(MESSAGES.unexpected, {
      code: REPORT_ERROR_CODES.server,
      status: response.status,
    });
  }

  return {
    id: receipt.id,
    clientReportId: receipt.clientReportId || clientReportId,
    status: receipt.status,
    // 200 significa reintento idempotente; el cuerpo tambien lo declara.
    replayed: typeof receipt.replayed === 'boolean' ? receipt.replayed : response.status === 200,
  };
}
