/**
 * Validacion pura del reporte y construccion del payload.
 *
 * Sin estado, sin red y sin imports de React Native: estas funciones se prueban
 * directo en Jest. La app valida para ayudar, la API repite todas las
 * validaciones (`SDD/docs/sdd/05_aplicacion_movil.md:92-94`).
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import { isPointInCreel, isValidCoordinate } from '../const/creelPolygon';
import {
  DOG_SIZES,
  EVENT_TYPES,
  OTHER_EVENT_TYPE,
  REPORT_LIMITS,
  REPORT_MESSAGES,
  REPORT_MIN_EVENT_DATE,
  SEVERITIES,
} from '../const/reportCatalogs';

const EVENT_TYPE_VALUES = new Set(EVENT_TYPES.map((option) => option.value));
const DOG_SIZE_VALUES = new Set(DOG_SIZES.map((option) => option.value));
const SEVERITY_VALUES = new Set(SEVERITIES.map((option) => option.value));

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toNonNegativeNumber(value) {
  const parsed = toFiniteNumber(value);

  if (parsed === null) {
    return null;
  }

  return parsed < 0 ? null : parsed;
}

export function createEmptyReportDraft() {
  return {
    eventAt: null,
    eventType: '',
    eventTypeOther: '',
    severity: '',
    certainty: '',
    dogCount: '',
    size: '',
    color: '',
    colorUndetermined: false,
    collar: '',
    description: '',
    location: null,
    photo: null,
    consentAccepted: false,
  };
}

export function validateEventAt(eventAt) {
  if (!eventAt) {
    return REPORT_MESSAGES.eventAtRequired;
  }

  const date = eventAt instanceof Date ? eventAt : new Date(eventAt);

  if (Number.isNaN(date.getTime())) {
    return REPORT_MESSAGES.eventAtRequired;
  }

  if (date.getTime() < REPORT_MIN_EVENT_DATE.getTime()) {
    return REPORT_MESSAGES.eventAtBeforeLaunch;
  }

  if (date.getTime() > Date.now()) {
    return REPORT_MESSAGES.eventAtFuture;
  }

  return null;
}

export function validateEventType(eventType, eventTypeOther) {
  if (!eventType || !EVENT_TYPE_VALUES.has(eventType)) {
    return REPORT_MESSAGES.eventTypeRequired;
  }

  if (eventType !== OTHER_EVENT_TYPE) {
    return null;
  }

  const detail = normalizeText(eventTypeOther);

  if (!detail) {
    return REPORT_MESSAGES.eventTypeOtherRequired;
  }

  if (detail.length > REPORT_LIMITS.eventTypeOther.maxLength) {
    return REPORT_MESSAGES.eventTypeOtherTooLong;
  }

  return null;
}

export function validateDogCount(dogCount) {
  const parsed = toFiniteNumber(dogCount);

  if (parsed === null) {
    return REPORT_MESSAGES.dogCountRequired;
  }

  const isWholeNumber = Number.isInteger(parsed);

  if (
    !isWholeNumber ||
    parsed < REPORT_LIMITS.dogCount.min ||
    parsed > REPORT_LIMITS.dogCount.max
  ) {
    return REPORT_MESSAGES.dogCountInvalid;
  }

  return null;
}

export function validateColor(color, colorUndetermined) {
  if (colorUndetermined) {
    return null;
  }

  const value = normalizeText(color);

  if (!value) {
    return REPORT_MESSAGES.colorRequired;
  }

  if (value.length > REPORT_LIMITS.color.maxLength) {
    return REPORT_MESSAGES.colorTooLong;
  }

  return null;
}

export function validateDescription(description) {
  const value = normalizeText(description);

  if (!value) {
    return REPORT_MESSAGES.descriptionRequired;
  }

  if (value.length < REPORT_LIMITS.description.minLength) {
    return REPORT_MESSAGES.descriptionTooShort;
  }

  if (value.length > REPORT_LIMITS.description.maxLength) {
    return REPORT_MESSAGES.descriptionTooLong;
  }

  return null;
}

export function validatePhoto(photo) {
  if (!photo) {
    return null;
  }

  if (photo.mimeType && !REPORT_LIMITS.photoMimeTypes.includes(photo.mimeType)) {
    return REPORT_MESSAGES.photoTypeInvalid;
  }

  if (
    typeof photo.fileSize === 'number' &&
    photo.fileSize > REPORT_LIMITS.photo.maxBytes
  ) {
    return REPORT_MESSAGES.photoTooLarge;
  }

  return null;
}

export function validateLocation(location) {
  if (!location) {
    return REPORT_MESSAGES.locationRequired;
  }

  const { latitude, longitude } = location;

  if (!isValidCoordinate(toFiniteNumber(latitude), toFiniteNumber(longitude))) {
    return REPORT_MESSAGES.locationRequired;
  }

  if (location.accuracyMeters != null) {
    const accuracy = toNonNegativeNumber(location.accuracyMeters);

    if (accuracy === null) {
      return REPORT_MESSAGES.locationAccuracyInvalid;
    }
  }

  if (!isPointInCreel(toFiniteNumber(latitude), toFiniteNumber(longitude))) {
    return REPORT_MESSAGES.locationOutsideCreel;
  }

  return null;
}

/**
 * Devuelve un objeto {campo: mensaje} con todos los errores del borrador.
 * Un objeto vacio significa que se puede enviar.
 */
export function validateReport(draft = {}) {
  const errors = {};

  const eventAtError = validateEventAt(draft.eventAt);
  if (eventAtError) {
    errors.eventAt = eventAtError;
  }

  const eventTypeError = validateEventType(draft.eventType, draft.eventTypeOther);
  if (eventTypeError) {
    errors.eventType = eventTypeError;
  }

  if (!SEVERITY_VALUES.has(draft.severity)) {
    errors.severity = REPORT_MESSAGES.severityRequired;
  }

  if (!draft.certainty) {
    errors.certainty = REPORT_MESSAGES.certaintyRequired;
  }

  const dogCountError = validateDogCount(draft.dogCount);
  if (dogCountError) {
    errors.dogCount = dogCountError;
  }

  if (!draft.size || !DOG_SIZE_VALUES.has(draft.size)) {
    errors.size = REPORT_MESSAGES.sizeRequired;
  }

  const colorError = validateColor(draft.color, draft.colorUndetermined);
  if (colorError) {
    errors.color = colorError;
  }

  if (!draft.collar) {
    errors.collar = REPORT_MESSAGES.collarRequired;
  }

  const descriptionError = validateDescription(draft.description);
  if (descriptionError) {
    errors.description = descriptionError;
  }

  const locationError = validateLocation(draft.location);
  if (locationError) {
    errors.location = locationError;
  }

  const photoError = validatePhoto(draft.photo);
  if (photoError) {
    errors.photo = photoError;
  }

  if (draft.consentAccepted !== true) {
    errors.consentAccepted = REPORT_MESSAGES.consentRequired;
  }

  return errors;
}

export function isReportValid(draft) {
  return Object.keys(validateReport(draft)).length === 0;
}

/**
 * Arma el JSON de la parte `payload` del multipart de `POST /reports`
 * (`SDD/docs/sdd/openapi.yaml:564-580`).
 *
 * La foto viaja como parte aparte del multipart, nunca dentro del payload.
 */
export function buildReportPayload(draft, clientReportId) {
  const colorUndetermined = Boolean(draft.colorUndetermined);
  const color = colorUndetermined ? null : normalizeText(draft.color) || null;

  const location = draft.location || {};

  return {
    clientReportId,
    eventAt: new Date(draft.eventAt).toISOString(),
    eventType: draft.eventType,
    eventTypeOther:
      draft.eventType === OTHER_EVENT_TYPE ? normalizeText(draft.eventTypeOther) || null : null,
    severity: draft.severity,
    certainty: draft.certainty,
    dogCount: toFiniteNumber(draft.dogCount),
    size: draft.size,
    color,
    colorUndetermined,
    collar: draft.collar,
    description: normalizeText(draft.description),
    location: {
      latitude: toFiniteNumber(location.latitude),
      longitude: toFiniteNumber(location.longitude),
      source: location.source,
      accuracyMeters:
        location.accuracyMeters === null || location.accuracyMeters === undefined
          ? null
          : toNonNegativeNumber(location.accuracyMeters),
    },
    consentAccepted: Boolean(draft.consentAccepted),
  };
}

// Cuerpo de PATCH /v1/me/reports/{id}: el mismo reporte, sin UUID, foto ni consentimiento.
export function buildReportUpdatePayload(draft) {
  const { clientReportId, consentAccepted, ...payload } = buildReportPayload(draft, null);
  return payload;
}
