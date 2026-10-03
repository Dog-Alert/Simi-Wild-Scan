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
  { value: 'SIGHTING', label: 'Avistamiento' },
  { value: 'ATTACK_PERSON', label: 'Ataque a persona' },
  { value: 'ATTACK_PET', label: 'Ataque a mascota' },
  { value: 'ATTACK_LIVESTOCK', label: 'Ataque a ganado' },
  { value: 'ATTACK_WILDLIFE', label: 'Ataque a fauna silvestre' },
  { value: 'HEALTH_RISK', label: 'Riesgo sanitario' },
  { value: 'INJURED_OR_SICK', label: 'Perro herido o enfermo' },
  { value: 'OTHER', label: 'Otro' },
];

/**
 * El chip "Manada" del diseño NO se incluye: el contrato de la API no define un
 * valor para una jauria/manada como tipo de incidente. Agregarlo exigiria un
 * cambio en el backend; queda pendiente de decision.
 */

export const OTHER_EVENT_TYPE = 'OTHER';

// Gravedad que estima quien reporta (SDD 5, RF-009); moderacion puede corregirla.
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

/**
 * Certeza. El diseño propone Seguro / Probable / No sé, una escala de confianza
 * que no coincide con los tres niveles del contrato (baja, media, alta). Se
 * mapea de mayor a menor: "No sé" es confianza baja.
 */
export const CERTAINTIES = [
  {
    value: 'HIGH',
    label: 'Seguro',
    help: 'Lo viste de cerca y con claridad.',
  },
  {
    value: 'MEDIUM',
    label: 'Probable',
    help: 'Lo viste a distancia o con poca claridad.',
  },
  {
    value: 'LOW',
    label: 'No sé',
    help: 'Solo lo supones, no lo viste con claridad.',
  },
];

export const DOG_SIZES = [
  { value: 'SMALL', label: 'Pequeño' },
  { value: 'MEDIUM', label: 'Mediano' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'UNDETERMINED', label: 'No sé' },
];

export const COLLAR_PRESENCES = [
  { value: 'YES', label: 'Sí' },
  { value: 'NO', label: 'No' },
  { value: 'UNDETERMINED', label: 'No sé' },
];

/**
 * Colores. El contrato trata `color` como texto libre de 120 caracteres, asi que
 * el valor que se envia es la etiqueta en espanol, no un codigo. "No sé" no es
 * un color: activa `colorUndetermined` y el payload manda `color: null`.
 */
export const UNDETERMINED_VALUE = 'UNDETERMINED';

export const COLORS = [
  { value: 'Café', label: 'Café' },
  { value: 'Negro', label: 'Negro' },
  { value: 'Blanco', label: 'Blanco' },
  { value: 'Gris', label: 'Gris' },
  { value: 'Manchado', label: 'Manchado' },
  { value: UNDETERMINED_VALUE, label: 'No sé' },
];

/**
 * Cantidad de perros. El diseño ofrece rangos (1 / 2-3 / 4+), pero el contrato
 * exige un entero exacto de 1 a 999 porque RF-038 cuenta "cantidad observada de
 * perros". Cada rango guarda su cota inferior, que es el dato defendible: nunca
 * se reporta mas perros de los que se vieron, algo que importa en un mapa publico
 * de alertas. El conteo real es una estimacion; RF-039 pide etiquetar las
 * estimaciones como tales.
 */
export const DOG_COUNT_BUCKETS = [
  { value: 1, label: '1' },
  { value: 2, label: '2–3' },
  { value: 4, label: '4+' },
];

/** Devuelve la cantidad exacta que representa el rango elegido, o null si no hay. */
export function resolveDogCountBucket(count) {
  const parsed = Number(count);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed <= 1) {
    return 1;
  }

  if (parsed <= 3) {
    return 2;
  }

  return 4;
}

/** Inversa de `resolveDogCountBucket`: dado un conteo, que rango esta activo. */
export function dogCountBucketFor(count) {
  return resolveDogCountBucket(count);
}

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

export const CONSENT_LABEL =
  'Acepto que este reporte se use según el aviso de privacidad de DogAlert.';

export const REPORT_MESSAGES = {
  eventAtRequired: 'Indica la fecha y la hora del evento.',
  eventAtFuture: 'La fecha del evento no puede ser futura.',
  eventAtBeforeLaunch: `La fecha del evento no puede ser anterior al lanzamiento de DogAlert (${REPORT_MIN_EVENT_DATE_LABEL}).`,
  eventTypeRequired: 'Selecciona el tipo de evento.',
  eventTypeOtherRequired: 'Describe el tipo de evento.',
  eventTypeOtherTooLong: `El tipo de evento admite máximo ${REPORT_LIMITS.eventTypeOther.maxLength} caracteres.`,
  severityRequired: 'Selecciona la gravedad del evento.',
  consentRequired: 'Debes aceptar el aviso de privacidad para enviar el reporte.',
  certaintyRequired: 'Selecciona qué tan certeza tienes del reporte.',
  dogCountRequired: 'Indica cuántos perros viste.',
  dogCountInvalid: `La cantidad de perros debe ser un número entre ${REPORT_LIMITS.dogCount.min} y ${REPORT_LIMITS.dogCount.max}.`,
  sizeRequired: 'Selecciona el tamaño del perro.',
  colorRequired: 'Indica el color o marca "No sé".',
  colorTooLong: `El color admite máximo ${REPORT_LIMITS.color.maxLength} caracteres.`,
  collarRequired: 'Indica si el perro lleva collar.',
  descriptionRequired: 'Describe lo que ocurrió.',
  descriptionTooShort: `La descripción admite mínimo ${REPORT_LIMITS.description.minLength} caracteres.`,
  descriptionTooLong: `La descripción admite máximo ${REPORT_LIMITS.description.maxLength} caracteres.`,
  locationRequired: 'Indica la ubicación del evento.',
  locationAccuracyInvalid: 'La precisión de la ubicación no es válida.',
  locationOutsideCreel: OUTSIDE_CREEL_MESSAGE,
  locationPermissionDenied:
    'DogAlert necesita tu ubicación para registrar dónde ocurrió. Actívala en los ajustes del sistema.',
  locationPermissionBlocked:
    'Tu ubicación está desactivada para DogAlert. Actívala en los ajustes del sistema para continuar.',
  locationServicesOff:
    'Tu dispositivo tiene la ubicación desactivada. Actívala en los ajustes del sistema para continuar.',
  locationUnavailable: 'No se pudo obtener tu ubicación. Inténtalo de nuevo o corrígela manualmente.',
  locationTooImprecise:
    'La ubicación obtenida es demasiado imprecisa para registrar el reporte. Acércate a la calle e inténtalo de nuevo, o corrígela manualmente.',
  photoTooLarge: 'La foto supera 1 MB, elige una más pequeña.',
  photoTypeInvalid: 'La foto debe estar en formato JPEG, PNG o HEIC.',
  photoPermissionDenied:
    'DogAlert necesita acceso a la cámara para adjuntar la foto. Actívalo en los ajustes del sistema.',
  photoLibraryPermissionDenied:
    'DogAlert necesita acceso a tus fotos para adjuntar la imagen. Actívalo en los ajustes del sistema.',
  photoUnavailable: 'No se pudo preparar la foto. Inténtalo de nuevo.',
  photoTooLargeAfterCompress:
    'La foto sigue pesando más de 1 MB después de reducirla. Elige una imagen más pequeña.',
};
