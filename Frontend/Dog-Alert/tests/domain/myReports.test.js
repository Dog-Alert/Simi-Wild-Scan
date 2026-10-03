import {
  buildMyReportEntries,
  eventTypeLabel,
  reportToDraft,
  toReportDetail,
} from '../../domain/myReports';
import { buildReportUpdatePayload } from '../../domain/reportValidation';
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

describe('toReportDetail', () => {
  it('toma los datos del reporte del servidor', () => {
    const [entry] = buildMyReportEntries({
      serverReports: [
        serverReport(1, { severity: 'HIGH', dogCount: 4, size: 'LARGE', description: 'Grupo de perros grandes sin collar.' }),
      ],
    });

    expect(toReportDetail(entry)).toEqual({
      title: 'Ataque a mascota',
      eventAt: '2026-10-05T10:00:00.000Z',
      status: { tone: 'verified', label: 'Verificado' },
      photoUri: null,
      severity: 'Alta',
      dogCount: '4+',
      size: 'Grande',
      description: 'Grupo de perros grandes sin collar.',
    });
  });

  it('toma los datos del borrador de la cola', () => {
    const [entry] = buildMyReportEntries({
      queueItems: [
        queueItem('a', {
          summary: { eventType: 'SIGHTING', eventAt: null },
          draft: { severity: null, dogCount: '2', size: 'SMALL', description: 'Un perro.', photo: null },
        }),
      ],
    });

    expect(toReportDetail(entry)).toMatchObject({
      title: 'Avistamiento',
      severity: 'Por asignar',
      dogCount: '2–3',
      size: 'Pequeño',
      description: 'Un perro.',
    });
  });

  it('tolera un reporte anonimo ya sincronizado sin borrador', () => {
    const [entry] = buildMyReportEntries({
      queueItems: [queueItem('a', { state: SYNC_STATES.synced, draft: null })],
    });

    expect(toReportDetail(entry)).toMatchObject({ dogCount: '—', size: '—', description: null });
  });
});

describe('reportToDraft', () => {
  const owned = {
    id: 12,
    clientReportId: 'uuid-12',
    status: 'VERIFIED',
    eventAt: '2026-10-05T18:00:00.000Z',
    eventType: 'ATTACK_PET',
    severity: 'HIGH',
    certainty: 'MEDIUM',
    dogCount: 4,
    size: 'LARGE',
    collar: 'NO',
    description: 'Grupo de perros grandes sin collar.',
    exactLocation: { latitude: 27.75, longitude: -107.63 },
    hasPhoto: true,
  };

  it('llena el formulario con el reporte del servidor', () => {
    const draft = reportToDraft(owned);

    expect(draft).toMatchObject({
      eventType: 'ATTACK_PET',
      severity: 'HIGH',
      certainty: 'MEDIUM',
      dogCount: '4',
      size: 'LARGE',
      collar: 'NO',
      description: 'Grupo de perros grandes sin collar.',
      location: { latitude: 27.75, longitude: -107.63, source: 'MANUAL', accuracyMeters: null },
      photo: null,
    });
    expect(draft.eventAt.toISOString()).toBe('2026-10-05T18:00:00.000Z');
  });

  it('deja vacio el color si el servidor no lo envia', () => {
    expect(reportToDraft(owned)).toMatchObject({ color: '', colorUndetermined: false });
    expect(reportToDraft({ ...owned, color: 'Negro' }).color).toBe('Negro');
  });

  it('se convierte de vuelta en el cuerpo del PATCH sin UUID', () => {
    const payload = buildReportUpdatePayload({ ...reportToDraft(owned), color: 'Negro' });

    expect(payload).not.toHaveProperty('clientReportId');
    expect(payload).toMatchObject({
      eventAt: '2026-10-05T18:00:00.000Z',
      severity: 'HIGH',
      dogCount: 4,
      color: 'Negro',
      location: { latitude: 27.75, longitude: -107.63 },
    });
  });
});
