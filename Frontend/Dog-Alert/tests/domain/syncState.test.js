import {
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  SYNC_ERROR_KINDS,
  SYNC_LEASE_MS,
  SYNC_STATES,
  applyQueuedEdit,
  canDeleteQueuedReport,
  canEditQueuedReport,
  canRetryManually,
  canSyncWithSession,
  canTransition,
  claimForSync,
  classifySyncFailure,
  computeRetryDelayMs,
  createQueuedReport,
  isDueForSync,
  isLeaseExpired,
  markReadyToSync,
  markSyncFailed,
  markSynced,
  recoverExpiredLease,
  requiresNewClientReportId,
  retryNow,
  selectNextDue,
  startSyncAttempt,
} from '../../domain/syncState';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const UUID = '6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b';
const OTHER_UUID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const MAX_RANDOM = () => 1;
const MIN_RANDOM = () => 0;

function draft(overrides = {}) {
  return {
    eventAt: new Date('2026-10-15T10:30:00.000Z'),
    eventType: 'ATTACK_PET',
    description: 'Perro que persiguió a una mascota por la calle sin correa.',
    location: { latitude: 27.75, longitude: -107.63, source: 'GPS', accuracyMeters: 10 },
    ...overrides,
  };
}

function queued(overrides = {}) {
  return {
    ...createQueuedReport({
      clientReportId: UUID,
      draft: draft(),
      ownerId: null,
      polygonVersion: 'osm-way-352907131',
      now: NOW,
    }),
    ...overrides,
  };
}

/** Lleva un elemento hasta SYNCING, como lo haria la cola. */
function syncing(overrides = {}) {
  return startSyncAttempt(markReadyToSync(queued(overrides), NOW), NOW);
}

describe('createQueuedReport', () => {
  it('nace guardado localmente, sin intentos ni envio programado', () => {
    const item = queued();

    expect(item.state).toBe(SYNC_STATES.localSaved);
    expect(item.attempts).toBe(0);
    expect(item.nextAttemptAt).toBeNull();
    expect(item.clientReportId).toBe(UUID);
    expect(item.createdAt).toBe(NOW);
  });

  it('usa el clientReportId como localId si no se indica otro', () => {
    expect(queued().localId).toBe(UUID);
  });

  it('guarda un resumen sin ubicacion ni descripcion', () => {
    const item = queued();

    expect(item.summary).toEqual({
      eventType: 'ATTACK_PET',
      eventAt: '2026-10-15T10:30:00.000Z',
    });
  });

  it('exige un clientReportId', () => {
    expect(() =>
      createQueuedReport({ clientReportId: '', draft: draft(), polygonVersion: 'v', now: NOW })
    ).toThrow();
  });
});

describe('transiciones', () => {
  it('sigue el diagrama del SDD 6.3', () => {
    expect(canTransition(SYNC_STATES.localSaved, SYNC_STATES.pending)).toBe(true);
    expect(canTransition(SYNC_STATES.pending, SYNC_STATES.syncing)).toBe(true);
    expect(canTransition(SYNC_STATES.syncing, SYNC_STATES.synced)).toBe(true);
    expect(canTransition(SYNC_STATES.syncing, SYNC_STATES.error)).toBe(true);
    expect(canTransition(SYNC_STATES.error, SYNC_STATES.pending)).toBe(true);
  });

  it('no permite saltarse el envio ni salir de SYNCED', () => {
    expect(canTransition(SYNC_STATES.localSaved, SYNC_STATES.synced)).toBe(false);
    expect(canTransition(SYNC_STATES.pending, SYNC_STATES.synced)).toBe(false);
    expect(canTransition(SYNC_STATES.synced, SYNC_STATES.pending)).toBe(false);
    expect(canTransition(SYNC_STATES.error, SYNC_STATES.syncing)).toBe(false);
  });

  it('lanza error ante una transicion no permitida', () => {
    expect(() => startSyncAttempt(queued(), NOW)).toThrow(/LOCAL_SAVED -> SYNCING/);
  });

  it('no modifica el elemento original', () => {
    const item = queued();
    markReadyToSync(item, NOW);

    expect(item.state).toBe(SYNC_STATES.localSaved);
  });
});

describe('envio', () => {
  it('markReadyToSync lo programa para ya', () => {
    const item = markReadyToSync(queued(), NOW);

    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.nextAttemptAt).toBe(NOW);
  });

  it('startSyncAttempt cuenta el intento y fija el arrendamiento', () => {
    const item = syncing();

    expect(item.state).toBe(SYNC_STATES.syncing);
    expect(item.attempts).toBe(1);
    expect(item.leaseUntil).toBe(NOW + SYNC_LEASE_MS);
  });

  it('markSynced guarda el id del servidor y borra el borrador', () => {
    const item = markSynced(syncing(), { id: 42, status: 'PENDING' }, NOW + 500);

    expect(item.state).toBe(SYNC_STATES.synced);
    expect(item.serverId).toBe(42);
    expect(item.serverStatus).toBe('PENDING');
    expect(item.draft).toBeNull();
    expect(item.syncedAt).toBe(NOW + 500);
    expect(item.clientReportId).toBe(UUID);
    expect(item.summary.eventType).toBe('ATTACK_PET');
  });
});

describe('claimForSync', () => {
  it('toma un pendiente', () => {
    expect(claimForSync(markReadyToSync(queued(), NOW), NOW).state).toBe(SYNC_STATES.syncing);
  });

  it('toma un error reintentable pasando por pendiente', () => {
    const failed = markSyncFailed(syncing(), { status: 503 }, NOW);
    const item = claimForSync(failed, NOW);

    expect(item.state).toBe(SYNC_STATES.syncing);
    expect(item.attempts).toBe(2);
    expect(item.errorKind).toBeNull();
  });
});

describe('computeRetryDelayMs', () => {
  it('empieza en 2 s y se duplica en cada intento', () => {
    expect(computeRetryDelayMs(1, { random: MAX_RANDOM })).toBe(RETRY_BASE_DELAY_MS);
    expect(computeRetryDelayMs(2, { random: MAX_RANDOM })).toBe(2 * RETRY_BASE_DELAY_MS);
    expect(computeRetryDelayMs(3, { random: MAX_RANDOM })).toBe(4 * RETRY_BASE_DELAY_MS);
  });

  it('dispersa entre la mitad y el total del tope', () => {
    expect(computeRetryDelayMs(3, { random: MIN_RANDOM })).toBe(2 * RETRY_BASE_DELAY_MS);
  });

  it('no pasa de 15 minutos por muchos intentos que haya', () => {
    expect(computeRetryDelayMs(50, { random: MAX_RANDOM })).toBe(RETRY_MAX_DELAY_MS);
    expect(computeRetryDelayMs(1000, { random: MAX_RANDOM })).toBe(RETRY_MAX_DELAY_MS);
  });

  it('respeta Retry-After cuando viene', () => {
    expect(computeRetryDelayMs(1, { retryAfterSeconds: 120, random: MAX_RANDOM })).toBe(120000);
  });
});

describe('classifySyncFailure', () => {
  it.each([
    [{ isNetworkError: true }, SYNC_STATES.pending, null, true],
    [{ status: null }, SYNC_STATES.pending, null, true],
    [{ isLocalValidation: true }, SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false],
    [{ status: 400 }, SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false],
    [{ status: 413 }, SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false],
    [{ status: 422 }, SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false],
    [{ status: 401 }, SYNC_STATES.error, SYNC_ERROR_KINDS.needsLogin, false],
    [{ status: 408 }, SYNC_STATES.error, SYNC_ERROR_KINDS.retryable, true],
    [{ status: 429 }, SYNC_STATES.error, SYNC_ERROR_KINDS.retryable, true],
    [{ status: 500 }, SYNC_STATES.error, SYNC_ERROR_KINDS.retryable, true],
    [{ status: 503 }, SYNC_STATES.error, SYNC_ERROR_KINDS.retryable, true],
    [{ status: 409 }, SYNC_STATES.error, SYNC_ERROR_KINDS.manual, false],
    [{ status: 410 }, SYNC_STATES.error, SYNC_ERROR_KINDS.manual, false],
    [{ status: 415 }, SYNC_STATES.error, SYNC_ERROR_KINDS.manual, false],
  ])('%j -> %s / %s', (failure, state, errorKind, autoRetry) => {
    expect(classifySyncFailure(failure)).toMatchObject({ state, errorKind, autoRetry });
  });

  it('solo 429 y 503 hacen caso a Retry-After', () => {
    expect(classifySyncFailure({ status: 429 }).honorRetryAfter).toBe(true);
    expect(classifySyncFailure({ status: 503 }).honorRetryAfter).toBe(true);
    expect(classifySyncFailure({ status: 500 }).honorRetryAfter).toBe(false);
  });
});

describe('markSyncFailed', () => {
  it('sin red vuelve a pendiente y programa el reintento', () => {
    const item = markSyncFailed(
      syncing(),
      { isNetworkError: true, errorCode: 'REPORT_NETWORK_ERROR' },
      NOW,
      { random: MAX_RANDOM }
    );

    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.errorKind).toBeNull();
    expect(item.nextAttemptAt).toBe(NOW + RETRY_BASE_DELAY_MS);
    expect(item.leaseUntil).toBeNull();
    expect(item.lastErrorCode).toBe('REPORT_NETWORK_ERROR');
  });

  it('un 5xx queda en error pero se reintenta solo', () => {
    const item = markSyncFailed(syncing(), { status: 502 }, NOW, { random: MAX_RANDOM });

    expect(item.state).toBe(SYNC_STATES.error);
    expect(item.errorKind).toBe(SYNC_ERROR_KINDS.retryable);
    expect(item.nextAttemptAt).toBe(NOW + RETRY_BASE_DELAY_MS);
  });

  it('un 429 espera lo que dice Retry-After', () => {
    const item = markSyncFailed(syncing(), { status: 429, retryAfterSeconds: 30 }, NOW, {
      random: MAX_RANDOM,
    });

    expect(item.nextAttemptAt).toBe(NOW + 30000);
  });

  it('un 500 ignora Retry-After', () => {
    const item = markSyncFailed(syncing(), { status: 500, retryAfterSeconds: 30 }, NOW, {
      random: MAX_RANDOM,
    });

    expect(item.nextAttemptAt).toBe(NOW + RETRY_BASE_DELAY_MS);
  });

  it('un 422 queda en error sin reintento programado', () => {
    const item = markSyncFailed(syncing(), { status: 422, errorCode: 'VALIDATION_ERROR' }, NOW);

    expect(item.state).toBe(SYNC_STATES.error);
    expect(item.errorKind).toBe(SYNC_ERROR_KINDS.needsCorrection);
    expect(item.nextAttemptAt).toBeNull();
  });

  it('conserva el borrador y el UUID para reintentar', () => {
    const item = markSyncFailed(syncing(), { status: 500 }, NOW);

    expect(item.draft).not.toBeNull();
    expect(item.clientReportId).toBe(UUID);
  });
});

describe('arrendamiento', () => {
  it('vence al pasar SYNC_LEASE_MS', () => {
    const item = syncing();

    expect(isLeaseExpired(item, NOW + SYNC_LEASE_MS - 1)).toBe(false);
    expect(isLeaseExpired(item, NOW + SYNC_LEASE_MS)).toBe(true);
  });

  it('solo aplica a SYNCING', () => {
    expect(isLeaseExpired(markReadyToSync(queued(), NOW), NOW + SYNC_LEASE_MS)).toBe(false);
  });

  it('al vencer vuelve a pendiente con el mismo UUID y sus intentos', () => {
    const later = NOW + SYNC_LEASE_MS;
    const item = recoverExpiredLease(syncing(), later);

    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.clientReportId).toBe(UUID);
    expect(item.attempts).toBe(1);
    expect(item.nextAttemptAt).toBe(later);
  });

  it('no toca un envio que sigue en curso', () => {
    const item = syncing();

    expect(recoverExpiredLease(item, NOW + 1000)).toBe(item);
  });
});

describe('sesion del autor', () => {
  it('un reporte anonimo se envia con o sin sesion', () => {
    const item = queued({ ownerId: null });

    expect(canSyncWithSession(item, null)).toBe(true);
    expect(canSyncWithSession(item, '7')).toBe(true);
  });

  it('un reporte registrado solo se envia con la sesion de su autor', () => {
    const item = queued({ ownerId: '7' });

    expect(canSyncWithSession(item, '7')).toBe(true);
    expect(canSyncWithSession(item, null)).toBe(false);
    expect(canSyncWithSession(item, '8')).toBe(false);
  });
});

describe('isDueForSync y selectNextDue', () => {
  it('toma pendientes cuyo intento ya vencio', () => {
    const item = markReadyToSync(queued(), NOW);

    expect(isDueForSync(item, NOW)).toBe(true);
    expect(isDueForSync({ ...item, nextAttemptAt: NOW + 1 }, NOW)).toBe(false);
  });

  it('toma errores reintentables vencidos, no los que hay que corregir', () => {
    const retryable = markSyncFailed(syncing(), { status: 500 }, NOW, { random: MIN_RANDOM });
    const correction = markSyncFailed(syncing(), { status: 422 }, NOW);
    const later = NOW + RETRY_MAX_DELAY_MS;

    expect(isDueForSync(retryable, later)).toBe(true);
    expect(isDueForSync(correction, later)).toBe(false);
  });

  it('no toma guardados sin programar, en envio ni sincronizados', () => {
    expect(isDueForSync(queued(), NOW)).toBe(false);
    expect(isDueForSync(syncing(), NOW)).toBe(false);
    expect(isDueForSync(markSynced(syncing(), { id: 1 }, NOW), NOW)).toBe(false);
  });

  it('no toma reportes de otra cuenta', () => {
    const item = markReadyToSync(queued({ ownerId: '7' }), NOW);

    expect(isDueForSync(item, NOW, null)).toBe(false);
    expect(isDueForSync(item, NOW, '7')).toBe(true);
  });

  it('elige el capturado primero', () => {
    const newer = markReadyToSync(queued({ clientReportId: OTHER_UUID, createdAt: NOW + 10 }), NOW);
    const older = markReadyToSync(queued({ createdAt: NOW }), NOW);

    expect(selectNextDue([newer, older], NOW).clientReportId).toBe(UUID);
  });

  it('devuelve null si no hay nada vencido', () => {
    expect(selectNextDue([queued()], NOW)).toBeNull();
    expect(selectNextDue([], NOW)).toBeNull();
  });
});

describe('reintento manual', () => {
  it('adelanta un pendiente que esperaba su turno', () => {
    const waiting = { ...markReadyToSync(queued(), NOW), nextAttemptAt: NOW + 60000 };
    const item = retryNow(waiting, NOW);

    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.nextAttemptAt).toBe(NOW);
  });

  it('vuelve a pendiente un error reintentable o manual', () => {
    const manual = markSyncFailed(syncing(), { status: 409 }, NOW);

    expect(retryNow(manual, NOW).state).toBe(SYNC_STATES.pending);
  });

  it('no aplica a lo que hay que corregir ni a lo que espera sesion', () => {
    expect(canRetryManually(markSyncFailed(syncing(), { status: 422 }, NOW))).toBe(false);
    expect(canRetryManually(markSyncFailed(syncing(), { status: 401 }, NOW))).toBe(false);
    expect(() => retryNow(markSyncFailed(syncing(), { status: 422 }, NOW), NOW)).toThrow();
  });
});

describe('edicion de reportes en la cola', () => {
  it('se edita lo que nunca salio del telefono', () => {
    expect(canEditQueuedReport(queued())).toBe(true);
    expect(canEditQueuedReport(markReadyToSync(queued(), NOW))).toBe(true);
  });

  it('no se edita si un envio pudo haber llegado al servidor', () => {
    const afterNetworkError = markSyncFailed(syncing(), { isNetworkError: true }, NOW);

    expect(canEditQueuedReport(syncing())).toBe(false);
    expect(canEditQueuedReport(afterNetworkError)).toBe(false);
    expect(canEditQueuedReport(markSyncFailed(syncing(), { status: 500 }, NOW))).toBe(false);
    expect(canEditQueuedReport(markSynced(syncing(), { id: 1 }, NOW))).toBe(false);
  });

  it('se edita lo que el servidor rechazo sin guardarlo', () => {
    expect(canEditQueuedReport(markSyncFailed(syncing(), { status: 422 }, NOW))).toBe(true);
    expect(canEditQueuedReport(markSyncFailed(syncing(), { status: 401 }, NOW))).toBe(true);
  });

  it('conserva el UUID si el servidor nunca lo vio', () => {
    const item = applyQueuedEdit(
      queued(),
      { draft: draft({ eventType: 'PACK' }), polygonVersion: 'v2' },
      NOW + 100
    );

    expect(requiresNewClientReportId(queued())).toBe(false);
    expect(item.clientReportId).toBe(UUID);
    expect(item.state).toBe(SYNC_STATES.pending);
    expect(item.summary.eventType).toBe('PACK');
    expect(item.polygonVersion).toBe('v2');
    expect(item.nextAttemptAt).toBe(NOW + 100);
  });

  it('exige UUID nuevo si el servidor ya rechazo el anterior', () => {
    const rejected = markSyncFailed(syncing(), { status: 422 }, NOW);
    const changes = { draft: draft(), polygonVersion: 'v1' };

    expect(requiresNewClientReportId(rejected)).toBe(true);
    expect(() => applyQueuedEdit(rejected, changes, NOW)).toThrow(/clientReportId nuevo/);
    expect(() => applyQueuedEdit(rejected, { ...changes, clientReportId: UUID }, NOW)).toThrow();

    const item = applyQueuedEdit(rejected, { ...changes, clientReportId: OTHER_UUID }, NOW);

    expect(item.clientReportId).toBe(OTHER_UUID);
    expect(item.localId).toBe(UUID);
    expect(item.attempts).toBe(0);
    expect(item.errorKind).toBeNull();
    expect(item.lastErrorCode).toBeNull();
  });

  it('rechaza editar lo que no se puede', () => {
    expect(() => applyQueuedEdit(syncing(), { draft: draft(), polygonVersion: 'v' }, NOW)).toThrow();
  });
});

describe('borrado de la cola', () => {
  it('se puede borrar en cualquier estado salvo mientras se envia', () => {
    expect(canDeleteQueuedReport(queued())).toBe(true);
    expect(canDeleteQueuedReport(markSyncFailed(syncing(), { status: 422 }, NOW))).toBe(true);
    expect(canDeleteQueuedReport(markSynced(syncing(), { id: 1 }, NOW))).toBe(true);
    expect(canDeleteQueuedReport(syncing())).toBe(false);
  });
});
