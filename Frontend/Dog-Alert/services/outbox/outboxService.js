import {
  REPORT_ERROR_CODES,
  ReportApiError,
  createClientReportId,
  submitReport,
} from '../../apis/reportsApi';
import { CREEL_BOUNDARY_VERSION } from '../../const/creelPolygon';
import { isReportValid, validateReport } from '../../domain/reportValidation';
import {
  SYNC_STATES,
  canDeleteQueuedReport,
  claimForSync,
  createQueuedReport,
  markReadyToSync,
  markSyncFailed,
  markSynced,
  recoverExpiredLease,
  retryNow,
  selectNextDue,
} from '../../domain/syncState';
import { getOutboxRepository } from './outboxRepository';
import * as localPhotoStore from './localPhotoStore';

function toFailure(error) {
  const code = error && error.code ? error.code : null;
  const status = error && Number.isInteger(error.status) ? error.status : null;

  return {
    status,
    isNetworkError: code === REPORT_ERROR_CODES.network,
    isLocalValidation: code === REPORT_ERROR_CODES.validation && status === null,
    retryAfterSeconds: error ? error.retryAfterSeconds ?? null : null,
    errorCode: code || 'UNEXPECTED',
  };
}

export function createOutboxService({
  repository = getOutboxRepository(),
  submit = submitReport,
  photos = localPhotoStore,
  createId = createClientReportId,
  now = () => Date.now(),
  random = Math.random,
} = {}) {
  let running = null;

  async function enqueue({ draft, clientReportId = createId(), ownerId = null }) {
    if (!isReportValid(draft)) {
      throw new ReportApiError('Revisa los datos del reporte antes de guardarlo.', {
        code: REPORT_ERROR_CODES.validation,
        fieldErrors: validateReport(draft),
      });
    }

    const localId = clientReportId;
    const photo = photos.persistPhoto(localId, draft.photo);
    const time = now();
    const item = markReadyToSync(
      createQueuedReport({
        localId,
        clientReportId,
        draft: { ...draft, photo },
        ownerId,
        polygonVersion: CREEL_BOUNDARY_VERSION,
        now: time,
      }),
      time
    );

    try {
      return await repository.insert(item);
    } catch (error) {
      photos.deletePhoto(photo);
      throw error;
    }
  }

  // Al abrir la app ningun envio esta en curso: todo SYNCING quedo cortado.
  function recoverInterrupted() {
    const time = now();
    return repository.updateAll((item) =>
      item.state === SYNC_STATES.syncing ? recoverExpiredLease({ ...item, leaseUntil: null }, time) : item
    );
  }

  async function sendOne(item, token) {
    if (!isReportValid(item.draft)) {
      throw new ReportApiError('El reporte ya no es valido.', { code: REPORT_ERROR_CODES.validation });
    }

    return submit({
      draft: item.draft,
      clientReportId: item.clientReportId,
      token: item.ownerId ? token : undefined,
    });
  }

  async function drain({ token = null, userId = null }) {
    const result = { synced: [], failed: [] };
    const attempted = new Set();

    for (;;) {
      const pending = (await repository.list()).filter((item) => !attempted.has(item.localId));
      const next = selectNextDue(pending, now(), userId);

      if (!next) {
        break;
      }

      attempted.add(next.localId);
      const claimed = await repository.update(next.localId, (item) => claimForSync(item, now()));

      if (!claimed) {
        continue;
      }

      try {
        const receipt = await sendOne(claimed, token);
        const synced = await repository.update(claimed.localId, (item) =>
          markSynced(item, receipt, now())
        );
        photos.deletePhoto(claimed.draft.photo);
        result.synced.push(synced);
      } catch (error) {
        const failure = toFailure(error);
        const failed = await repository.update(claimed.localId, (item) =>
          markSyncFailed(item, failure, now(), { random })
        );
        result.failed.push(failed);

        if (failure.isNetworkError) {
          break;
        }
      }
    }

    return result;
  }

  // Una sola sincronizacion a la vez; las llamadas simultaneas comparten la misma.
  function syncPending(session = {}) {
    if (!running) {
      running = drain(session).finally(() => {
        running = null;
      });
    }

    return running;
  }

  async function retry(localId, session = {}) {
    await repository.update(localId, (item) => retryNow(item, now()));
    return syncPending(session);
  }

  async function remove(localId) {
    const item = await repository.get(localId);

    if (!item) {
      return false;
    }

    if (!canDeleteQueuedReport(item)) {
      throw new Error('No se puede borrar un reporte mientras se envia.');
    }

    await repository.remove(localId);
    photos.deletePhoto(item.draft && item.draft.photo);
    return true;
  }

  return {
    enqueue,
    recoverInterrupted,
    syncPending,
    retry,
    remove,
    list: () => repository.list(),
  };
}
