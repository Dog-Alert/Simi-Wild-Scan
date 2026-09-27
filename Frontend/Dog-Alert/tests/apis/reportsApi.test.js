import * as Crypto from 'expo-crypto';

import {
  REPORT_ERROR_CODES,
  ReportApiError,
  buildReportFormData,
  createClientReportId,
  submitReport
} from '../../apis/reportsApi';
import { REPORT_MIN_EVENT_DATE, OUTSIDE_CREEL_MESSAGE } from '../../const/reportCatalogs';
import { CREEL_CENTER } from '../../const/creelPolygon';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-15T12:00:00.000Z');
const VALID_DATE = new Date(REPORT_MIN_EVENT_DATE.getTime() + DAY);
const CLIENT_REPORT_ID = '11111111-2222-4333-8444-555555555555';

/**
 * FormData de Node solo acepta string o Blob y rechaza el objeto {uri,name,type}
 * que React Native usa para archivos. Este doble registra las partes para poder
 * inspeccionarlas sin tocar el codigo de produccion.
 */
class FormDataStub {
  constructor() {
    this.parts = [];
  }

  append(name, value) {
    this.parts.push({ name, value });
  }
}

function validDraft(overrides = {}) {
  return {
    eventAt: VALID_DATE,
    eventType: 'ATTACK_PET',
    severity: 'HIGH',
    certainty: 'MEDIUM',
    dogCount: '2',
    size: 'MEDIUM',
    color: 'negro',
    colorUndetermined: false,
    collar: 'NO',
    description: 'Perro que persiguió a una mascota por la calle sin correa.',
    location: {
      latitude: CREEL_CENTER.latitude,
      longitude: CREEL_CENTER.longitude,
      source: 'GPS',
      accuracyMeters: 10,
    },
    photo: null,
    ...overrides
  };
}

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null
    },
    json: async () => body
  };
}

function emptyResponse(status, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      throw new Error('cuerpo no json');
    }
  };
}

let originalFormData;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);

  originalFormData = global.FormData;
  global.FormData = FormDataStub;

  Crypto.randomUUID.mockReturnValue(CLIENT_REPORT_ID);
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
  global.FormData = originalFormData;
  delete global.fetch;
});

describe('createClientReportId', () => {
  it('devuelve un UUID v4 de expo-crypto', () => {
    expect(createClientReportId()).toBe(CLIENT_REPORT_ID);
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
});

describe('buildReportFormData', () => {
  it('envia el payload como JSON con el clientReportId', () => {
    const form = buildReportFormData(validDraft(), CLIENT_REPORT_ID);
    const payloadPart = form.parts.find((part) => part.name === 'payload');

    expect(typeof payloadPart.value).toBe('string');

    const payload = JSON.parse(payloadPart.value);
    expect(payload.clientReportId).toBe(CLIENT_REPORT_ID);
    expect(payload.dogCount).toBe(2);
  });

  it('omite la parte photo cuando no hay foto', () => {
    const form = buildReportFormData(validDraft(), CLIENT_REPORT_ID);

    expect(form.parts.map((part) => part.name)).toEqual(['payload']);
  });

  it('adjunta la foto como parte aparte del multipart', () => {
    const photo = { uri: 'file:///tmp/foto.jpg', mimeType: 'image/jpeg', fileSize: 200000 };
    const form = buildReportFormData(validDraft({ photo }), CLIENT_REPORT_ID);
    const photoPart = form.parts.find((part) => part.name === 'photo');

    expect(photoPart.value).toEqual({
      uri: 'file:///tmp/foto.jpg',
      name: 'reporte.jpeg',
      type: 'image/jpeg'
    });
  });

  it('deriva la extension del subtipo MIME cuando no hay nombre', () => {
    const photo = { uri: 'file:///tmp/foto.heic', mimeType: 'image/heic' };
    const form = buildReportFormData(validDraft({ photo }), CLIENT_REPORT_ID);
    const photoPart = form.parts.find((part) => part.name === 'photo');

    expect(photoPart.value.name).toBe('reporte.heic');
  });

  it('respeta el nombre original del archivo cuando existe', () => {
    const photo = { uri: 'file:///tmp/a.jpg', mimeType: 'image/png', fileName: 'perro.png' };
    const form = buildReportFormData(validDraft({ photo }), CLIENT_REPORT_ID);
    const photoPart = form.parts.find((part) => part.name === 'photo');

    expect(photoPart.value.name).toBe('perro.png');
    expect(photoPart.value.type).toBe('image/png');
  });

  it('no mete la foto dentro del JSON del payload', () => {
    const photo = { uri: 'file:///tmp/foto.jpg', mimeType: 'image/jpeg' };
    const form = buildReportFormData(validDraft({ photo }), CLIENT_REPORT_ID);
    const payload = JSON.parse(form.parts.find((part) => part.name === 'payload').value);

    expect(JSON.stringify(payload)).not.toContain('file:///tmp/foto.jpg');
  });
});

describe('submitReport', () => {
  it('devuelve el acuse de un reporte creado', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(201, { id: 42, clientReportId: CLIENT_REPORT_ID, status: 'PENDING', replayed: false })
    );

    const receipt = await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });

    expect(receipt).toEqual({
      id: 42,
      clientReportId: CLIENT_REPORT_ID,
      status: 'PENDING',
      replayed: false
    });
  });

  it('marca replayed en un reintento idempotente con 200', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(200, { id: 42, clientReportId: CLIENT_REPORT_ID, status: 'PENDING' })
    );

    const receipt = await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });

    expect(receipt.replayed).toBe(true);
  });

  it('envia la cabecera Idempotency-Key con el mismo clientReportId', async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, { id: 1, status: 'PENDING', replayed: false }));

    await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Idempotency-Key']).toBe(CLIENT_REPORT_ID);
  });

  it('no fija Content-Type para que fetch arme el boundary del multipart', async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, { id: 1, status: 'PENDING', replayed: false }));

    await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('envia Authorization solo cuando hay token', async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, { id: 1, status: 'PENDING', replayed: false }));

    await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });
    const [, anonimo] = global.fetch.mock.calls[0];
    expect(anonimo.headers.Authorization).toBeUndefined();

    await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID, token: 'jwt-123' });
    const [, conToken] = global.fetch.mock.calls[1];
    expect(conToken.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('usa el metodo POST sobre /api/reports', async () => {
    global.fetch.mockResolvedValue(jsonResponse(201, { id: 1, status: 'PENDING', replayed: false }));

    await submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/reports$/);
    expect(options.method).toBe('POST');
  });

  it('no llama al backend si el borrador es invalido', async () => {
    await expect(
      submitReport({ draft: validDraft({ dogCount: '0' }), clientReportId: CLIENT_REPORT_ID })
    ).rejects.toMatchObject({ code: REPORT_ERROR_CODES.validation });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('incluye los errores por campo del borrador', async () => {
    const error = await submitReport({
      draft: validDraft({ description: 'corto' }),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.fieldErrors.description).toBeDefined();
  });

  it('exige clientReportId', async () => {
    await expect(submitReport({ draft: validDraft() })).rejects.toBeInstanceOf(ReportApiError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('traduce el rechazo de ubicacion fuera de Creel', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(
        422,
        {
          error: {
            code: 'REPORT_LOCATION_OUTSIDE_CREEL',
            message: 'Outside polygon',
            requestId: 'req-1'
          }
        },
        { 'content-type': 'application/json' }
      )
    );

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ReportApiError);
    expect(error.isOutsideCreel).toBe(true);
    expect(error.message).toBe(OUTSIDE_CREEL_MESSAGE);
    expect(error.status).toBe(422);
    expect(error.requestId).toBe('req-1');
  });

  it('extrae los errores por campo de un 422', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(
        422,
        {
          error: {
            code: 'REPORT_VALIDATION',
            message: 'Invalid',
            requestId: 'req-2',
            details: [
              { field: 'description', message: 'Muy corta' },
              { field: 'description', message: 'No sirve' }
            ]
          }
        },
        { 'content-type': 'application/json' }
      )
    );

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.code).toBe(REPORT_ERROR_CODES.validation);
    expect(error.fieldErrors).toEqual({ description: 'No sirve' });
  });

  it('identifica conflicto de idempotencia con 409', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(409, { error: { code: 'X', message: 'dup', requestId: 'r' } }, {
        'content-type': 'application/json'
      })
    );

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.code).toBe(REPORT_ERROR_CODES.conflict);
    expect(error.status).toBe(409);
  });

  it('identifica limite de tasa con 429 y lee Retry-After', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(429, { error: { code: 'X', message: 'slow', requestId: 'r' } }, {
        'content-type': 'application/json',
        'retry-after': '30'
      })
    );

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.code).toBe(REPORT_ERROR_CODES.rateLimited);
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('identifica sesion expirada con 401', async () => {
    global.fetch.mockResolvedValue(emptyResponse(401));

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.code).toBe(REPORT_ERROR_CODES.unauthorized);
  });

  it('no filtra el texto del servidor ante un 500', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse(500, { error: { code: 'X', message: 'stack trace interno', requestId: 'r' } }, {
        'content-type': 'application/json'
      })
    );

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.message).not.toContain('stack trace');
    expect(error.code).toBe(REPORT_ERROR_CODES.server);
  });

  it('aguanta un cuerpo no json de un proxy', async () => {
    global.fetch.mockResolvedValue(emptyResponse(502, { 'content-type': 'text/html' }));

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ReportApiError);
    expect(error.code).toBe(REPORT_ERROR_CODES.server);
  });

  it('traduce un fallo de red', async () => {
    global.fetch.mockRejectedValue(new TypeError('Network request failed'));

    const error = await submitReport({
      draft: validDraft(),
      clientReportId: CLIENT_REPORT_ID
    }).catch((e) => e);

    expect(error.code).toBe(REPORT_ERROR_CODES.network);
  });

  it('reporta cuerpo ilegible en un 201', async () => {
    global.fetch.mockResolvedValue(emptyResponse(201));

    await expect(
      submitReport({ draft: validDraft(), clientReportId: CLIENT_REPORT_ID })
    ).rejects.toBeInstanceOf(ReportApiError);
  });
});
