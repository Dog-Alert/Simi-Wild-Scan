/**
 * Catalogos, etiquetas y limites del formulario de reporte.
 *
 * Los valoresPersistidos son los del contrato de la API
 * (`SDD/docs/sdd/openapi.yaml:538-580`) y las etiquetas visibles son las del SRS
 * (`SDD/SRS/DogAlert_SRS (2).txt:252-267`). Estados persistidos en ingles mayuscula,
 * etiquetas en espanol.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import { CREEL_CENTER } from './creelPolygon';

export const UNDETERMINED_LABEL = 'No se pudo determinar';

export const EVENT_TYPES = [
  { value: 'SIGHTING', label: 'Avistamiento sin incidente' },
  { value: 'ATTACK_PERSON', label: 'Agresión o ataque a una persona' },
  { value: 'ATTACK_PET', label: 'Ataque a una mascota' },
  { value: 'ATTACK_LIVESTOCK', label: 'Ataque a ganado' },
  { value: 'ATTACK_WILDLIFE', label: 'Ataque a fauna silvestre' },
  { value: 'INJURED_OR_SICK', label: 'Perro herido o enfermo' },
  { value: 'HEALTH_RISK', label: 'Posible riesgo sanitario' },
  { value: 'OTHER', label: 'Otro' },
];

export const OTHER_EVENT_TYPE = 'OTHER';

export const SEVERITIES = [
  {
    value: 'LOW',
    label: 'Baja',
    help: 'Avistamiento sin agresión, lesiones ni daños.',
  },
  {
    value: 'MEDIUM',
    label: 'Media',
    help: 'Persecución, conducta agresiva o lesión no crítica.',
  },
  {
    value: 'HIGH',
    label: 'Alta',
    help: 'Ataque a personas, lesión grave, muerte de un animal o posible riesgo sanitario importante.',
  },
];

export const CERTAINTIES = [
  { value: 'LOW', label: 'Baja', help: 'Solo lo supones, no lo viste con claridad.' },
  { value: 'MEDIUM', label: 'Media', help: 'Lo viste a distancia o con poca claridad.' },
  { value: 'HIGH', label: 'Alta', help: 'Lo viste de cerca y con claridad.' },
];

export const DOG_SIZES = [
  { value: 'SMALL', label: 'Chico' },
  { value: 'MEDIUM', label: 'Mediano' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'UNDETERMINED', label: UNDETERMINED_LABEL },
];

export const COLLAR_PRESENCES = [
  { value: 'YES', label: 'Sí' },
  { value: 'NO', label: 'No' },
  { value: 'UNDETERMINED', label: UNDETERMINED_LABEL },
];

/**
 * Fuentes de ubicacion que acepta el contrato. `openapi.yaml:562` solo declara
 * GPS y MANUAL, aunque `schema.sql:67` ya contempla METADATOS_FOTO.
 *
 * Cuando la ubicacion se toma de los metadatos de la foto se envia como MANUAL
 * (el usuario la confirmo o la corrigio) y se marca `derivedFromPhoto` solo en el
 * borrador local, nunca en el payload. El valor METADATADOS_FOTO queda pendiente
 * de que el backend lo acepte.
 */
export const LOCATION_SOURCES = ['GPS', 'MANUAL'];

export const CREEL_DEFAULT_LOCATION = CREEL_CENTER;

export const REPORT_LIMITS = {
  dogCount: { min: 1, max: 999 },
  description: { minLength: 20, maxLength: 2000 },
  color: { maxLength: 120 },
  eventTypeOther: { maxLength: 120 },
  photo: { maxBytes: 1048576 },
  photoMimeTypes: ['image/jpeg', 'image/png', 'image/heic'],
};

/**
 * Fecha mas antigua admitida para el evento (RF-015). Se configura por entorno
 * porque el SDD la trata como variable de despliegue, no como fecha fija
 * (`SDD/docs/sdd/10_despliegue_operacion.md:28`).
 */
const DEFAULT_MIN_EVENT_DATE = '2026-10-02T00:00:00.000Z';

const configuredMinEventDate = process.env.EXPO_PUBLIC_REPORT_MIN_EVENT_DATE;

export const REPORT_MIN_EVENT_DATE = new Date(
  configuredMinEventDate
    ? `${configuredMinEventDate}T00:00:00.000Z`
    : DEFAULT_MIN_EVENT_DATE
);

export const REPORT_MIN_EVENT_DATE_LABEL = REPORT_MIN_EVENT_DATE.toLocaleDateString('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export const OUTSIDE_CREEL_MESSAGE =
  'Esta ubicación está fuera del área de Creel. DogAlert solo registra reportes dentro de Creel, corrige la ubicación para continuar.';

export const REPORT_MESSAGES = {
  eventAtRequired: 'Indica la fecha y la hora del evento.',
  eventAtFuture: 'La fecha del evento no puede ser futura.',
  eventAtBeforeLaunch: `La fecha del evento no puede ser anterior al lanzamiento de DogAlert (${REPORT_MIN_EVENT_DATE_LABEL}).`,
  eventTypeRequired: 'Selecciona el tipo de evento.',
  eventTypeOtherRequired: 'Describe el tipo de evento.',
  eventTypeOtherTooLong: `El tipo de evento admite máximo ${REPORT_LIMITS.eventTypeOther.maxLength} caracteres.`,
  severityRequired: 'Selecciona la gravedad del evento.',
  certaintyRequired: 'Selecciona qué tan certeza tienes del reporte.',
  dogCountRequired: 'Indica cuántos perros viste.',
  dogCountInvalid: `La cantidad de perros debe ser un número entre ${REPORT_LIMITS.dogCount.min} y ${REPORT_LIMITS.dogCount.max}.`,
  sizeRequired: 'Selecciona el tamaño del perro.',
  colorRequired: 'Indica el color o marca "No se pudo determinar".',
  colorTooLong: `El color admite máximo ${REPORT_LIMITS.color.maxLength} caracteres.`,
  collarRequired: 'Indica si el perro lleva collar.',
  descriptionRequired: 'Describe lo que ocurrió.',
  descriptionTooShort: `La descripción admite mínimo ${REPORT_LIMITS.description.minLength} caracteres.`,
  descriptionTooLong: `La descripción admite máximo ${REPORT_LIMITS.description.maxLength} caracteres.`,
  locationRequired: 'Indica la ubicación del evento.',
  locationAccuracyInvalid: 'La precisión de la ubicación no es válida.',
  locationOutsideCreel: OUTSIDE_CREEL_MESSAGE,
  photoTooLarge: 'La foto supera 1 MB, elige una más pequeña.',
  photoTypeInvalid: 'La foto debe estar en formato JPEG, PNG o HEIC.',
};
