import { buildMyReportEntries, eventTypeLabel } from '../../domain/myReports';
import { SYNC_STATES } from '../../domain/syncState';

function queueItem(localId, overrides = {}) {
  return {
    localId,
    clientReportId: localId,
    state: SYNC_STATES.pending,
    errorKind: null,
    ownerId: null,
    createdAt: 1,
    summary: { eventType: 'PACK', eventAt: '2026-10-10T10:00:00.000Z' },
    draft: { photo: { uri: `file:///documents/outbox/photos/${localId}.jpg` } },
    ...overrides,
  };
}

function serverReport(id, overrides = {}) {
  return {
    id,
    clientReportId: `uuid-${id}`,
    status: 'VERIFIED',
    eventType: 'ATTACK_PET',
    eventAt: '2026-10-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('eventTypeLabel', () => {
  it('traduce el tipo de incidente', () => {
    expect(eventTypeLabel('ATTACK_PET')).toBe('Ataque a mascota');
    expect(eventTypeLabel('DESCONOCIDO')).toBe('DESCONOCIDO');
    expect(eventTypeLabel(null)).toBe('Reporte');
  });
});

describe('buildMyReportEntries', () => {
  it('pone primero la cola local, la mas reciente arriba, y luego el servidor', () => {
    const entries = buildMyReportEntries({
      serverReports: [serverReport(1)],
      queueItems: [queueItem('a', { createdAt: 1 }), queueItem('b', { createdAt: 2 })],
    });

    expect(entries.map((entry) => entry.key)).toEqual(['local:b', 'local:a', 'server:1']);
  });

  it('usa la etiqueta de sincronizacion en la cola y la de revision en el servidor', () => {
    const [local, server] = buildMyReportEntries({
      serverReports: [serverReport(1)],
      queueItems: [queueItem('a')],
    });

    expect(local.status.label).toBe('Guardado localmente');
    expect(local.photoUri).toContain('a.jpg');
    expect(server.status).toEqual({ tone: 'verified', label: 'Verificado' });
    expect(server.report.id).toBe(1);
  });

  it('no repite un reporte que ya esta en el servidor', () => {
    const entries = buildMyReportEntries({
      serverReports: [serverReport(1, { clientReportId: 'a' })],
      queueItems: [queueItem('a', { state: SYNC_STATES.syncing, ownerId: '7' })],
      userId: '7',
    });

    expect(entries.map((entry) => entry.key)).toEqual(['server:1']);
  });

  it('oculta los registrados ya sincronizados que aun no llegan en la pagina', () => {
    const entries = buildMyReportEntries({
      queueItems: [queueItem('a', { state: SYNC_STATES.synced, ownerId: '7', draft: null })],
      userId: '7',
    });

    expect(entries).toEqual([]);
  });

  it('muestra los anonimos sincronizados, que el servidor no puede listar', () => {
    const [entry] = buildMyReportEntries({
      queueItems: [queueItem('a', { state: SYNC_STATES.synced, draft: null })],
    });

    expect(entry.status.label).toBe('Sincronizado');
    expect(entry.photoUri).toBeNull();
  });

  it('no muestra la cola de otra cuenta', () => {
    const entries = buildMyReportEntries({
      queueItems: [queueItem('a', { ownerId: '8' }), queueItem('b', { ownerId: '7' })],
      userId: '7',
    });

    expect(entries.map((entry) => entry.key)).toEqual(['local:b']);
  });

  it('sin sesion solo muestra la cola anonima', () => {
    const entries = buildMyReportEntries({
      queueItems: [queueItem('a', { ownerId: '7' }), queueItem('b')],
    });

    expect(entries.map((entry) => entry.key)).toEqual(['local:b']);
  });
});
