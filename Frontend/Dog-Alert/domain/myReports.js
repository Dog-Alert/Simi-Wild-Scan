import {
  DOG_COUNT_BUCKETS,
  DOG_SIZES,
  EVENT_TYPES,
  SEVERITIES,
  resolveDogCountBucket,
} from '../const/reportCatalogs';
import { getServerStatus, getSyncStatus } from '../const/syncLabels';
import { SYNC_STATES } from './syncState';

const labelsOf = (options) => Object.fromEntries(options.map((option) => [option.value, option.label]));

const EVENT_TYPE_LABELS = labelsOf(EVENT_TYPES);
const SEVERITY_LABELS = labelsOf(SEVERITIES);
const SIZE_LABELS = labelsOf(DOG_SIZES);
const DOG_COUNT_LABELS = labelsOf(DOG_COUNT_BUCKETS);

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

export function toReportDetail(entry) {
  const fields = entry.report || (entry.item && entry.item.draft) || {};
  const dogCount = resolveDogCountBucket(fields.dogCount);

  return {
    title: eventTypeLabel(entry.eventType),
    eventAt: entry.eventAt,
    status: entry.status,
    photoUri: entry.photoUri,
    severity: SEVERITY_LABELS[fields.severity] || 'Por asignar',
    dogCount: dogCount ? DOG_COUNT_LABELS[dogCount] : '—',
    size: SIZE_LABELS[fields.size] || '—',
    description: fields.description || null,
  };
}
