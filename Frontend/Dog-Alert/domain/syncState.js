// Maquina de estados de la cola offline (SDD 6.3-6.5). Funciones puras.

export const SYNC_STATES = {
  localSaved: 'LOCAL_SAVED',
  pending: 'SYNC_PENDING',
  syncing: 'SYNCING',
  synced: 'SYNCED',
  error: 'SYNC_ERROR',
};

export const SYNC_ERROR_KINDS = {
  retryable: 'RETRYABLE',
  needsCorrection: 'NEEDS_CORRECTION',
  needsLogin: 'NEEDS_LOGIN',
  manual: 'MANUAL',
};

const ALLOWED_TRANSITIONS = {
  [SYNC_STATES.localSaved]: [SYNC_STATES.pending],
  [SYNC_STATES.pending]: [SYNC_STATES.syncing],
  [SYNC_STATES.syncing]: [SYNC_STATES.synced, SYNC_STATES.error, SYNC_STATES.pending],
  [SYNC_STATES.error]: [SYNC_STATES.pending],
  [SYNC_STATES.synced]: [],
};

export const RETRY_BASE_DELAY_MS = 2 * 1000;
export const RETRY_MAX_DELAY_MS = 15 * 60 * 1000;

// Si la app se cierra durante SYNCING, el elemento vuelve a SYNC_PENDING al vencer.
export const SYNC_LEASE_MS = 2 * 60 * 1000;

const RETRY_AFTER_STATUSES = new Set([429, 503]);

export function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

function transition(item, to, changes, now) {
  if (!canTransition(item.state, to)) {
    throw new Error(`Transicion de sincronizacion no permitida: ${item.state} -> ${to}`);
  }

  return { ...item, ...changes, state: to, updatedAt: now };
}

function buildSummary(draft) {
  return {
    eventType: draft.eventType,
    eventAt: draft.eventAt ? new Date(draft.eventAt).toISOString() : null,
  };
}

export function createQueuedReport({
  clientReportId,
  localId = clientReportId,
  draft,
  ownerId = null,
  polygonVersion,
  now,
}) {
  if (!clientReportId) {
    throw new Error('El reporte de la cola necesita un clientReportId.');
  }

  return {
    localId,
    clientReportId,
    state: SYNC_STATES.localSaved,
    errorKind: null,
    lastErrorCode: null,
    attempts: 0,
    nextAttemptAt: null,
    leaseUntil: null,
    ownerId,
    polygonVersion,
    draft,
    summary: buildSummary(draft),
    serverId: null,
    serverStatus: null,
    createdAt: now,
    updatedAt: now,
    syncedAt: null,
  };
}

export function markReadyToSync(item, now) {
  return transition(
    item,
    SYNC_STATES.pending,
    { errorKind: null, nextAttemptAt: now, leaseUntil: null },
    now
  );
}

export function startSyncAttempt(item, now) {
  return transition(
    item,
    SYNC_STATES.syncing,
    { attempts: item.attempts + 1, leaseUntil: now + SYNC_LEASE_MS, nextAttemptAt: null },
    now
  );
}

export function claimForSync(item, now) {
  const ready = item.state === SYNC_STATES.error ? markReadyToSync(item, now) : item;
  return startSyncAttempt(ready, now);
}

export function markSynced(item, receipt, now) {
  return transition(
    item,
    SYNC_STATES.synced,
    {
      serverId: receipt.id ?? null,
      serverStatus: receipt.status ?? null,
      draft: null,
      errorKind: null,
      lastErrorCode: null,
      leaseUntil: null,
      nextAttemptAt: null,
      syncedAt: now,
    },
    now
  );
}

export function computeRetryDelayMs(attempts, { retryAfterSeconds = null, random = Math.random } = {}) {
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  const exponent = Math.max(0, attempts - 1);
  const ceiling = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);

  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export function classifySyncFailure(failure = {}) {
  const status = failure.status ?? null;

  if (failure.isLocalValidation) {
    return outcome(SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false);
  }

  if (failure.isNetworkError || status === null) {
    return outcome(SYNC_STATES.pending, null, true);
  }

  if (status === 401) {
    return outcome(SYNC_STATES.error, SYNC_ERROR_KINDS.needsLogin, false);
  }

  if (status === 400 || status === 413 || status === 422) {
    return outcome(SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, false);
  }

  if (status === 408 || status === 429 || status >= 500) {
    return {
      ...outcome(SYNC_STATES.error, SYNC_ERROR_KINDS.retryable, true),
      honorRetryAfter: RETRY_AFTER_STATUSES.has(status),
    };
  }

  return outcome(SYNC_STATES.error, SYNC_ERROR_KINDS.manual, false);
}

function outcome(state, errorKind, autoRetry) {
  return { state, errorKind, autoRetry, honorRetryAfter: false };
}

export function markSyncFailed(item, failure, now, { random = Math.random } = {}) {
  const result = classifySyncFailure(failure);

  const nextAttemptAt = result.autoRetry
    ? now +
      computeRetryDelayMs(item.attempts, {
        retryAfterSeconds: result.honorRetryAfter ? failure.retryAfterSeconds : null,
        random,
      })
    : null;

  return transition(
    item,
    result.state,
    {
      errorKind: result.errorKind,
      lastErrorCode: failure.errorCode || null,
      leaseUntil: null,
      nextAttemptAt,
    },
    now
  );
}

export function isLeaseExpired(item, now) {
  return item.state === SYNC_STATES.syncing && (item.leaseUntil === null || item.leaseUntil <= now);
}

export function recoverExpiredLease(item, now) {
  if (!isLeaseExpired(item, now)) {
    return item;
  }

  return transition(item, SYNC_STATES.pending, { leaseUntil: null, nextAttemptAt: now }, now);
}

export function canSyncWithSession(item, currentUserId) {
  return item.ownerId === null || item.ownerId === undefined || item.ownerId === currentUserId;
}

export function isDueForSync(item, now, currentUserId = null) {
  if (!canSyncWithSession(item, currentUserId)) {
    return false;
  }

  const isWaiting =
    item.state === SYNC_STATES.pending ||
    (item.state === SYNC_STATES.error && item.errorKind === SYNC_ERROR_KINDS.retryable);

  return isWaiting && item.nextAttemptAt !== null && item.nextAttemptAt <= now;
}

export function selectNextDue(items, now, currentUserId = null) {
  return (
    items
      .filter((item) => isDueForSync(item, now, currentUserId))
      .sort((a, b) => a.createdAt - b.createdAt)[0] || null
  );
}

export function canRetryManually(item) {
  if (item.state === SYNC_STATES.pending) {
    return true;
  }

  return (
    item.state === SYNC_STATES.error &&
    (item.errorKind === SYNC_ERROR_KINDS.retryable || item.errorKind === SYNC_ERROR_KINDS.manual)
  );
}

export function retryNow(item, now) {
  if (!canRetryManually(item)) {
    throw new Error(`No se puede reintentar un reporte en ${item.state}/${item.errorKind}.`);
  }

  if (item.state === SYNC_STATES.pending) {
    return { ...item, nextAttemptAt: now, updatedAt: now };
  }

  return markReadyToSync(item, now);
}

// Solo se edita lo que con certeza no existe en el servidor.
export function canEditQueuedReport(item) {
  if (item.state === SYNC_STATES.localSaved) {
    return true;
  }

  if (item.state === SYNC_STATES.pending) {
    return item.attempts === 0;
  }

  return (
    item.state === SYNC_STATES.error &&
    (item.errorKind === SYNC_ERROR_KINDS.needsCorrection ||
      item.errorKind === SYNC_ERROR_KINDS.needsLogin)
  );
}

// Con el mismo UUID y contenido distinto el servidor responderia 409.
export function requiresNewClientReportId(item) {
  return item.state === SYNC_STATES.error;
}

export function applyQueuedEdit(item, { draft, polygonVersion, clientReportId }, now) {
  if (!canEditQueuedReport(item)) {
    throw new Error(`No se puede editar un reporte en ${item.state}/${item.errorKind}.`);
  }

  const needsNewId = requiresNewClientReportId(item);

  if (needsNewId && (!clientReportId || clientReportId === item.clientReportId)) {
    throw new Error('La correccion de un reporte rechazado necesita un clientReportId nuevo.');
  }

  return {
    ...item,
    clientReportId: needsNewId ? clientReportId : item.clientReportId,
    draft,
    polygonVersion,
    summary: buildSummary(draft),
    state: SYNC_STATES.pending,
    errorKind: null,
    lastErrorCode: null,
    attempts: 0,
    leaseUntil: null,
    nextAttemptAt: now,
    updatedAt: now,
  };
}

export function canDeleteQueuedReport(item) {
  return item.state !== SYNC_STATES.syncing;
}
