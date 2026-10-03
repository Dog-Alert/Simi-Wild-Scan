import { SYNC_ERROR_KINDS, SYNC_STATES } from '../domain/syncState';

const ERROR_DETAILS = {
  [SYNC_ERROR_KINDS.retryable]: 'El servidor no respondió. Se reintentará automáticamente.',
  [SYNC_ERROR_KINDS.needsCorrection]: 'El servidor rechazó el reporte. Revísalo y corrígelo.',
  [SYNC_ERROR_KINDS.needsLogin]: 'Inicia sesión con tu cuenta para enviarlo.',
  [SYNC_ERROR_KINDS.manual]: 'No se pudo enviar. Inténtalo de nuevo más tarde.',
};

export function getSyncStatus(item) {
  switch (item.state) {
    case SYNC_STATES.localSaved:
    case SYNC_STATES.pending:
      return { tone: 'local', label: 'Guardado localmente', detail: 'Pendiente de sincronización' };
    case SYNC_STATES.syncing:
      return { tone: 'syncing', label: 'Sincronizando', detail: 'Enviando el reporte' };
    case SYNC_STATES.synced:
      return { tone: 'synced', label: 'Sincronizado', detail: 'Recibido por el servidor' };
    default:
      return {
        tone: 'error',
        label: 'Error',
        detail: ERROR_DETAILS[item.errorKind] || ERROR_DETAILS[SYNC_ERROR_KINDS.manual],
      };
  }
}

export function formatElapsed(since, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - since) / 60000);

  if (minutes < 1) {
    return 'hace un momento';
  }

  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `hace ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
