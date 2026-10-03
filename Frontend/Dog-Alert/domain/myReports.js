import { EVENT_TYPES } from '../const/reportCatalogs';
import { getServerStatus, getSyncStatus } from '../const/syncLabels';
import { SYNC_STATES } from './syncState';

const EVENT_TYPE_LABELS = Object.fromEntries(EVENT_TYPES.map((type) => [type.value, type.label]));

export function eventTypeLabel(eventType) {
  return EVENT_TYPE_LABELS[eventType] || eventType || 'Reporte';
}

function belongsToViewer(item, userId) {
  return item.ownerId === null || item.ownerId === undefined || item.ownerId === userId;
}

function localEntry(item) {
  return {
    key: `local:${item.localId}`,
    source: 'local',
    eventType: item.summary ? item.summary.eventType : null,
    eventAt: item.summary ? item.summary.eventAt : null,
    status: getSyncStatus(item),
    photoUri: item.draft && item.draft.photo ? item.draft.photo.uri : null,
    item,
    report: null,
  };
}

function serverEntry(report) {
  return {
    key: `server:${report.id}`,
    source: 'server',
    eventType: report.eventType,
    eventAt: report.eventAt,
    status: getServerStatus(report.status),
    photoUri: null,
    item: null,
    report,
  };
}

// Un reporte registrado ya sincronizado se muestra solo desde el servidor,
// que tiene su estado de revision actualizado.
export function buildMyReportEntries({ serverReports = [], queueItems = [], userId = null }) {
  const onServer = new Set(serverReports.map((report) => report.clientReportId));

  const local = queueItems
    .filter((item) => belongsToViewer(item, userId))
    .filter((item) => !onServer.has(item.clientReportId))
    .filter((item) => !(item.state === SYNC_STATES.synced && item.ownerId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(localEntry);

  return [...local, ...serverReports.map(serverEntry)];
}
