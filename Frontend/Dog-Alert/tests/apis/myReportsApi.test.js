import {
  MY_REPORTS_ERROR_CODES,
  deleteMyReport,
  getMyReport,
  listMyReports,
  updateMyReport,
} from '../../apis/myReportsApi';
import { REPORT_ERROR_CODES, ReportApiError } from '../../apis/reportsApi';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => (name === 'content-type' && body ? 'application/json' : null) },
    json: async () => body,
  };
}

const OWNED = {
  id: 12,
  clientReportId: '11111111-1111-4111-8111-111111111111',
  status: 'PENDING',
  eventType: 'ATTACK_PET',
  exactLocation: { latitude: 27.75, longitude: -107.63 },
  hasPhoto: false,
};

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('listMyReports', () => {
  it('pide la primera pagina con el token', async () => {
    fetch.mockResolvedValue(response(200, { items: [OWNED], nextCursor: 'abc' }));

    const page = await listMyReports({ token: 'jwt' });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/v1\/me\/reports$/);
    expect(options.headers.Authorization).toBe('Bearer jwt');
    expect(page).toEqual({ items: [OWNED], nextCursor: 'abc' });
  });

  it('pide la siguiente pagina con el cursor', async () => {
    fetch.mockResolvedValue(response(200, { items: [] }));

    const page = await listMyReports({ token: 'jwt', cursor: 'a b' });

    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/me\/reports\?cursor=a%20b$/);
    expect(page.nextCursor).toBeNull();
  });

  it('sin sesion no llama al servidor', async () => {
    await expect(listMyReports({})).rejects.toMatchObject({ code: REPORT_ERROR_CODES.unauthorized });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('traduce el error de red', async () => {
    fetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(listMyReports({ token: 'jwt' })).rejects.toMatchObject({
      code: REPORT_ERROR_CODES.network,
    });
  });

  it('traduce un token vencido', async () => {
    fetch.mockResolvedValue(response(401, { error: { code: 'INVALID_TOKEN' } }));

    await expect(listMyReports({ token: 'jwt' })).rejects.toMatchObject({
      code: REPORT_ERROR_CODES.unauthorized,
      status: 401,
    });
  });
});

describe('getMyReport', () => {
  it('pide el detalle por id', async () => {
    fetch.mockResolvedValue(response(200, OWNED));

    expect(await getMyReport({ token: 'jwt', reportId: 12 })).toEqual(OWNED);
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/me\/reports\/12$/);
  });

  it('un reporte ajeno o inexistente es 404', async () => {
    fetch.mockResolvedValue(response(404, { error: { code: 'REPORT_NOT_FOUND' } }));

    const error = await getMyReport({ token: 'jwt', reportId: 99 }).catch((e) => e);

    expect(error).toBeInstanceOf(ReportApiError);
    expect(error.code).toBe(MY_REPORTS_ERROR_CODES.notFound);
  });
});

describe('updateMyReport', () => {
  it('envia PATCH con el cuerpo JSON', async () => {
    fetch.mockResolvedValue(response(200, OWNED));
    const payload = { description: 'Corregido con mas detalle del incidente.' };

    const updated = await updateMyReport({ token: 'jwt', reportId: 12, payload });

    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('PATCH');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual(payload);
    expect(updated.status).toBe('PENDING');
  });

  it('409 significa que ya no se puede editar', async () => {
    fetch.mockResolvedValue(response(409, { error: { code: 'REPORT_NOT_EDITABLE' } }));

    await expect(updateMyReport({ token: 'jwt', reportId: 12, payload: {} })).rejects.toMatchObject({
      code: MY_REPORTS_ERROR_CODES.notEditable,
    });
  });

  it('422 trae los errores por campo', async () => {
    fetch.mockResolvedValue(
      response(422, {
        error: { code: 'VALIDATION_ERROR', details: [{ field: 'description', message: 'Muy corta' }] },
      })
    );

    const error = await updateMyReport({ token: 'jwt', reportId: 12, payload: {} }).catch((e) => e);

    expect(error.fieldErrors).toEqual({ description: 'Muy corta' });
  });
});

describe('deleteMyReport', () => {
  it('envia DELETE y acepta 204', async () => {
    fetch.mockResolvedValue(response(204, null));

    expect(await deleteMyReport({ token: 'jwt', reportId: 12 })).toBe(true);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });
});
