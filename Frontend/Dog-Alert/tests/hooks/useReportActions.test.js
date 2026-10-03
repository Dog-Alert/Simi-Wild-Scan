import { act, renderHook } from '@testing-library/react-native';

import { ReportApiError } from '../../apis/reportsApi';
import { CREEL_CENTER } from '../../const/creelPolygon';
import { REPORT_MIN_EVENT_DATE } from '../../const/reportCatalogs';
import { createEmptyReportDraft } from '../../domain/reportValidation';
import { SYNC_ERROR_KINDS, SYNC_STATES } from '../../domain/syncState';
import { useReportActions } from '../../hooks/useReportActions';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = REPORT_MIN_EVENT_DATE.getTime() + 10 * DAY;

const SERVER_ENTRY = { source: 'server', report: { id: 12, clientReportId: 'uuid-12' }, item: null };
const LOCAL_ENTRY = { source: 'local', report: null, item: { localId: 'a' } };

function validDraft(overrides = {}) {
  return {
    ...createEmptyReportDraft(),
    eventAt: new Date(NOW - DAY),
    eventType: 'ATTACK_PET',
    consentAccepted: true,
    severity: 'HIGH',
    certainty: 'MEDIUM',
    dogCount: '2',
    size: 'MEDIUM',
    color: 'Negro',
    collar: 'NO',
    description: 'Perro que persiguió a una mascota por la calle sin correa.',
    location: { ...CREEL_CENTER, source: 'MANUAL', accuracyMeters: null },
    ...overrides,
  };
}

function setup() {
  const api = {
    deleteMyReport: jest.fn().mockResolvedValue(true),
    updateMyReport: jest.fn(async ({ reportId }) => ({
      id: reportId,
      clientReportId: 'uuid-12',
      status: 'PENDING',
    })),
  };
  const outbox = {
    remove: jest.fn().mockResolvedValue(undefined),
    edit: jest.fn(async (localId) => ({
      item: { localId, state: SYNC_STATES.pending },
      error: null,
    })),
  };
  const myReports = { removeServerReport: jest.fn(), replaceServerReport: jest.fn() };
  const { result } = renderHook(() =>
    useReportActions({ session: { token: 'jwt' }, outbox, myReports, api })
  );

  return { actions: result.current, api, outbox, myReports };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deleteEntry', () => {
  it('borra en el servidor con el token y lo quita de la lista', async () => {
    const { actions, api, myReports } = setup();

    await act(() => actions.deleteEntry(SERVER_ENTRY));

    expect(api.deleteMyReport).toHaveBeenCalledWith({ token: 'jwt', reportId: 12 });
    expect(myReports.removeServerReport).toHaveBeenCalledWith(12);
  });

  it('si el servidor ya no lo tiene, igual lo quita de la lista', async () => {
    const { actions, api, myReports } = setup();
    api.deleteMyReport.mockRejectedValue(new ReportApiError('x', { code: 'REPORT_NOT_FOUND', status: 404 }));

    await act(() => actions.deleteEntry(SERVER_ENTRY));

    expect(myReports.removeServerReport).toHaveBeenCalledWith(12);
  });

  it('propaga otros errores sin quitarlo', async () => {
    const { actions, api, myReports } = setup();
    api.deleteMyReport.mockRejectedValue(new ReportApiError('Sin red', { code: 'REPORT_NETWORK_ERROR' }));

    await expect(actions.deleteEntry(SERVER_ENTRY)).rejects.toThrow('Sin red');
    expect(myReports.removeServerReport).not.toHaveBeenCalled();
  });

  it('un reporte de la cola se borra del telefono', async () => {
    const { actions, api, outbox } = setup();

    await act(() => actions.deleteEntry(LOCAL_ENTRY));

    expect(outbox.remove).toHaveBeenCalledWith('a');
    expect(api.deleteMyReport).not.toHaveBeenCalled();
  });
});

describe('saveEdit', () => {
  it('valida antes de llamar al servidor', async () => {
    const { actions, api } = setup();

    const outcome = await actions.saveEdit({ source: 'server', reportId: 12 }, validDraft({ color: '' }));

    expect(outcome.error.fields.color).toBeTruthy();
    expect(api.updateMyReport).not.toHaveBeenCalled();
  });

  it('envia el PATCH y vuelve al detalle con el reporte en pendiente', async () => {
    const { actions, api, myReports } = setup();

    let outcome;
    await act(async () => {
      outcome = await actions.saveEdit({ source: 'server', reportId: 12 }, validDraft());
    });

    const { payload } = api.updateMyReport.mock.calls[0][0];
    expect(payload).not.toHaveProperty('clientReportId');
    expect(payload.description).toMatch(/Perro que persiguió/);
    expect(myReports.replaceServerReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: 12, status: 'PENDING' })
    );
    expect(outcome).toEqual({
      route: 'ReporteDetalle',
      params: { key: 'server:12', clientReportId: 'uuid-12' },
    });
  });

  it('devuelve el error del servidor para mostrarlo en el formulario', async () => {
    const { actions, api } = setup();
    api.updateMyReport.mockRejectedValue(
      new ReportApiError('Revisa', { status: 422, fieldErrors: { description: 'Muy corta' } })
    );

    const outcome = await actions.saveEdit({ source: 'server', reportId: 12 }, validDraft());

    expect(outcome.error).toEqual({ message: 'Revisa', fields: { description: 'Muy corta' } });
  });

  it('corrige un reporte de la cola y muestra su estado de envio', async () => {
    const { actions, outbox } = setup();

    const outcome = await actions.saveEdit({ source: 'local', localId: 'a' }, validDraft());

    expect(outbox.edit).toHaveBeenCalledWith('a', expect.any(Object));
    expect(outcome).toEqual({ route: 'EstadoEnvio', params: { localId: 'a' } });
  });

  it('si el servidor vuelve a rechazar la correccion, se queda en el formulario', async () => {
    const { actions, outbox } = setup();
    outbox.edit.mockResolvedValue({
      item: { localId: 'a', state: SYNC_STATES.error, errorKind: SYNC_ERROR_KINDS.needsCorrection },
      error: new ReportApiError('Fuera de Creel', { fieldErrors: { location: 'x' } }),
    });

    const outcome = await actions.saveEdit({ source: 'local', localId: 'a' }, validDraft());

    expect(outcome.error).toEqual({ message: 'Fuera de Creel', fields: { location: 'x' } });
  });

  it('avisa si el reporte de la cola ya no se puede editar', async () => {
    const { actions, outbox } = setup();
    outbox.edit.mockRejectedValue(new Error('Este reporte ya no se puede editar.'));

    const outcome = await actions.saveEdit({ source: 'local', localId: 'a' }, validDraft());

    expect(outcome.error).toEqual({ message: 'Este reporte ya no se puede editar.', fields: {} });
  });
});
