import { REPORT_ERROR_CODES, ReportApiError } from '../../apis/reportsApi';
import { CREEL_BOUNDARY_VERSION, CREEL_CENTER } from '../../const/creelPolygon';
import { REPORT_MIN_EVENT_DATE } from '../../const/reportCatalogs';
import { createEmptyReportDraft } from '../../domain/reportValidation';
import { SYNC_ERROR_KINDS, SYNC_STATES } from '../../domain/syncState';
import { createMemoryStorage, createOutboxRepository } from '../../services/outbox/outboxRepository';
import { createOutboxService } from '../../services/outbox/outboxService';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-file-system', () => ({}));

const DAY = 24 * 60 * 60 * 1000;
const NOW = REPORT_MIN_EVENT_DATE.getTime() + 10 * DAY;
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const OUTSIDE_CREEL = { latitude: 28.6353, longitude: -106.0889 };

function validDraft(overrides = {}) {
  return {
    ...createEmptyReportDraft(),
    eventAt: new Date(NOW - DAY),
    eventType: 'ATTACK_PET',
    certainty: 'MEDIUM',
    dogCount: '2',
    size: 'MEDIUM',
    color: 'negro',
    collar: 'NO',
    description: 'Perro que persiguió a una mascota por la calle sin correa.',
    location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 10 },
    ...overrides,
  };
}

function networkError() {
  return new ReportApiError('sin red', { code: REPORT_ERROR_CODES.network });
}

function httpError(status, extra = {}) {
  return new ReportApiError('error', { code: 'X', status, ...extra });
}

function setup({ submit = jest.fn(), storage = createMemoryStorage() } = {}) {
  let ids = [UUID_A, UUID_B];
  const clock = { time: NOW };
  const photos = {
    persistPhoto: jest.fn((localId, photo) =>
      photo ? { ...photo, uri: `file:///documents/outbox/photos/${localId}.jpg` } : null
    ),
    deletePhoto: jest.fn(),
  };
  const repository = createOutboxRepository(storage);
  const service = createOutboxService({
    repository,
    submit,
    photos,
    createId: () => ids.shift(),
    now: () => clock.time,
    random: () => 1,
  });

  return { service, repository, submit, photos, clock, storage };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('enqueue', () => {
  it('guarda el reporte listo para enviarse', async () => {
    const { service } = setup();

    const item = await service.enqueue({ draft: validDraft() });

    expect(item).toMatchObject({
      localId: UUID_A,
      clientReportId: UUID_A,
      state: SYNC_STATES.pending,
      nextAttemptAt: NOW,
      ownerId: null,
      polygonVersion: CREEL_BOUNDARY_VERSION,
    });
    expect(await service.list()).toHaveLength(1);
  });

  it('respeta el clientReportId generado al abrir el formulario', async () => {
    const { service } = setup();

    const item = await service.enqueue({ draft: validDraft(), clientReportId: UUID_B, ownerId: '7' });

    expect(item.clientReportId).toBe(UUID_B);
    expect(item.ownerId).toBe('7');
  });

  it('copia la foto al directorio privado', async () => {
    const { service, photos } = setup();
    const photo = { uri: 'file:///cache/a.jpg', mimeType: 'image/jpeg' };

    const item = await service.enqueue({ draft: validDraft({ photo }) });

    expect(photos.persistPhoto).toHaveBeenCalledWith(UUID_A, photo);
    expect(item.draft.photo.uri).toBe(`file:///documents/outbox/photos/${UUID_A}.jpg`);
  });

  it('no guarda un reporte fuera de Creel', async () => {
    const { service, photos } = setup();
    const draft = validDraft({ location: { ...OUTSIDE_CREEL, source: 'MANUAL' } });

    await expect(service.enqueue({ draft })).rejects.toMatchObject({
      code: REPORT_ERROR_CODES.validation,
      fieldErrors: { location: expect.any(String) },
    });
    expect(await service.list()).toEqual([]);
    expect(photos.persistPhoto).not.toHaveBeenCalled();
  });

  it('borra la copia de la foto si no se pudo guardar', async () => {
    const { service, photos } = setup();
    const photo = { uri: 'file:///cache/a.jpg' };

    await service.enqueue({ draft: validDraft(), clientReportId: UUID_A });

    await expect(service.enqueue({ draft: validDraft({ photo }), clientReportId: UUID_A })).rejects.toThrow();
    expect(photos.deletePhoto).toHaveBeenCalledWith(expect.objectContaining({ uri: expect.stringContaining(UUID_A) }));
  });
});

describe('syncPending', () => {
  it('envia y marca sincronizado, borrando la foto local', async () => {
    const submit = jest.fn().mockResolvedValue({ id: 42, status: 'PENDING', replayed: false });
    const { service, photos } = setup({ submit });
    await service.enqueue({ draft: validDraft({ photo: { uri: 'file:///cache/a.jpg' } }) });

    const result = await service.syncPending();

    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ clientReportId: UUID_A, token: undefined })
    );
    expect(result.synced[0]).toMatchObject({ state: SYNC_STATES.synced, serverId: 42, draft: null });
    expect(photos.deletePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ uri: `file:///documents/outbox/photos/${UUID_A}.jpg` })
    );
  });

  it('sin red deja el reporte pendiente y no sigue con los demas', async () => {
    const submit = jest.fn().mockRejectedValue(networkError());
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft() });
    await service.enqueue({ draft: validDraft() });

    const result = await service.syncPending();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.failed[0]).toMatchObject({ state: SYNC_STATES.pending, attempts: 1 });
  });

  it('envia en el orden en que se capturaron', async () => {
    const submit = jest.fn().mockResolvedValue({ id: 1, status: 'PENDING' });
    const { service, clock } = setup({ submit });
    await service.enqueue({ draft: validDraft() });
    clock.time += 1000;
    await service.enqueue({ draft: validDraft() });

    await service.syncPending();

    expect(submit.mock.calls.map(([options]) => options.clientReportId)).toEqual([UUID_A, UUID_B]);
  });

  it('reintenta siempre con el mismo UUID y termina en un solo envio exitoso', async () => {
    const submit = jest.fn();
    for (let attempt = 0; attempt < 9; attempt += 1) {
      submit.mockRejectedValueOnce(networkError());
    }
    submit.mockResolvedValueOnce({ id: 7, status: 'PENDING' });
    const { service, clock } = setup({ submit });
    await service.enqueue({ draft: validDraft() });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await service.syncPending();
      clock.time += 60 * 60 * 1000;
    }

    const ids = new Set(submit.mock.calls.map(([options]) => options.clientReportId));
    const [item] = await service.list();

    expect(submit).toHaveBeenCalledTimes(10);
    expect([...ids]).toEqual([UUID_A]);
    expect(item).toMatchObject({ state: SYNC_STATES.synced, attempts: 10, serverId: 7 });
  });

  it('no reintenta antes de que venza la espera', async () => {
    const submit = jest.fn().mockRejectedValue(networkError());
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft() });

    await service.syncPending();
    await service.syncPending();

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('un 5xx queda en error y se reintenta solo despues', async () => {
    const submit = jest
      .fn()
      .mockRejectedValueOnce(httpError(503, { retryAfterSeconds: 30 }))
      .mockResolvedValueOnce({ id: 9, status: 'PENDING' });
    const { service, clock } = setup({ submit });
    await service.enqueue({ draft: validDraft() });

    const first = await service.syncPending();
    expect(first.failed[0]).toMatchObject({
      state: SYNC_STATES.error,
      errorKind: SYNC_ERROR_KINDS.retryable,
      nextAttemptAt: NOW + 30000,
    });

    clock.time = NOW + 30000;
    const second = await service.syncPending();
    expect(second.synced[0].serverId).toBe(9);
  });

  it('un 422 pide correccion y no se reintenta solo', async () => {
    const submit = jest.fn().mockRejectedValue(httpError(422));
    const { service, clock } = setup({ submit });
    await service.enqueue({ draft: validDraft() });

    const result = await service.syncPending();
    clock.time += DAY;
    await service.syncPending();

    expect(result.failed[0]).toMatchObject({
      state: SYNC_STATES.error,
      errorKind: SYNC_ERROR_KINDS.needsCorrection,
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('vuelve a validar Creel antes de enviar', async () => {
    const submit = jest.fn();
    const { service, repository } = setup({ submit });
    await service.enqueue({ draft: validDraft() });
    await repository.update(UUID_A, (item) => ({
      ...item,
      draft: { ...item.draft, location: { ...OUTSIDE_CREEL, source: 'MANUAL' } },
    }));

    const result = await service.syncPending();

    expect(submit).not.toHaveBeenCalled();
    expect(result.failed[0]).toMatchObject({
      state: SYNC_STATES.error,
      errorKind: SYNC_ERROR_KINDS.needsCorrection,
    });
  });

  it('manda el token solo en reportes registrados', async () => {
    const submit = jest.fn().mockResolvedValue({ id: 1, status: 'PENDING' });
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft() });
    await service.enqueue({ draft: validDraft(), ownerId: '7' });

    await service.syncPending({ token: 'jwt', userId: '7' });

    expect(submit.mock.calls.map(([options]) => options.token)).toEqual([undefined, 'jwt']);
  });

  it('no envia reportes registrados sin la sesion de su autor', async () => {
    const submit = jest.fn().mockResolvedValue({ id: 1, status: 'PENDING' });
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft(), ownerId: '7' });

    await service.syncPending();
    await service.syncPending({ token: 'otro', userId: '8' });

    expect(submit).not.toHaveBeenCalled();
  });

  it('un 401 espera a que el autor inicie sesion', async () => {
    const submit = jest.fn().mockRejectedValue(httpError(401));
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft(), ownerId: '7' });

    const result = await service.syncPending({ token: 'vencido', userId: '7' });

    expect(result.failed[0].errorKind).toBe(SYNC_ERROR_KINDS.needsLogin);
  });

  it('las llamadas simultaneas comparten una sola sincronizacion', async () => {
    let resolveSubmit;
    const submit = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        })
    );
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft() });

    const first = service.syncPending();
    const second = service.syncPending();
    await new Promise((resolve) => setImmediate(resolve));
    resolveSubmit({ id: 1, status: 'PENDING' });

    expect(await first).toBe(await second);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('recuperacion al abrir la app', () => {
  it('un envio cortado vuelve a pendiente y se reenvia con el mismo UUID', async () => {
    const storage = createMemoryStorage();
    const never = jest.fn(() => new Promise(() => {}));
    const before = setup({ submit: never, storage });
    await before.service.enqueue({ draft: validDraft() });
    before.service.syncPending();
    await new Promise((resolve) => setImmediate(resolve));

    expect(JSON.parse(storage.state.text).items[0].state).toBe(SYNC_STATES.syncing);

    const submit = jest.fn().mockResolvedValue({ id: 5, status: 'PENDING', replayed: true });
    const after = setup({ submit, storage });
    after.clock.time = NOW + 1000;

    const [recovered] = await after.service.recoverInterrupted();
    expect(recovered.state).toBe(SYNC_STATES.pending);

    await after.service.syncPending();

    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ clientReportId: UUID_A }));
    expect((await after.service.list())[0]).toMatchObject({ state: SYNC_STATES.synced, attempts: 2 });
  });

  it('no toca los demas estados', async () => {
    const { service } = setup();
    await service.enqueue({ draft: validDraft() });

    const [item] = await service.recoverInterrupted();

    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.attempts).toBe(0);
  });
});

describe('retry', () => {
  it('reenvia de inmediato un reporte que esperaba su turno', async () => {
    const submit = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ id: 3, status: 'PENDING' });
    const { service } = setup({ submit });
    await service.enqueue({ draft: validDraft() });
    await service.syncPending();

    const result = await service.retry(UUID_A);

    expect(result.synced[0].serverId).toBe(3);
  });
});

describe('remove', () => {
  it('borra el reporte y su foto', async () => {
    const { service, photos } = setup();
    await service.enqueue({ draft: validDraft({ photo: { uri: 'file:///cache/a.jpg' } }) });

    expect(await service.remove(UUID_A)).toBe(true);
    expect(await service.list()).toEqual([]);
    expect(photos.deletePhoto).toHaveBeenCalled();
  });

  it('no borra mientras se envia', async () => {
    const { service, repository } = setup();
    await service.enqueue({ draft: validDraft() });
    await repository.update(UUID_A, (item) => ({ ...item, state: SYNC_STATES.syncing }));

    await expect(service.remove(UUID_A)).rejects.toThrow(/mientras se envia/);
    expect(await service.list()).toHaveLength(1);
  });

  it('devuelve false si no existe', async () => {
    const { service } = setup();

    expect(await service.remove('nada')).toBe(false);
  });
});
