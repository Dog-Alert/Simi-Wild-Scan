/**
 * Servicio de foto del reporte (parte 3 de C2).
 *
 * Envuelve `expo-image-picker` y `expo-image-manipulator` para obtener una foto
 * lista para enviar: redimensionada, comprimida y con su tamano en bytes
 * medido en disco.
 *
 * ORDEN DE LAS OPERACIONES (importante)
 * --------------------------------------
 * 1. Se pide la foto al sistema.
 * 2. Se lee el GPS del EXIF, si viene.
 * 3. Se redimensiona y comprime.
 *
 * El paso 2 va antes del 3 a proposito: al redimensionar se reescribe el
 * archivo y se pierden los metadatos EXIF, asi que leerlos despues daria siempre
 * null.
 *
 * LIMITACION CONOCIDA DE iOS
 * --------------------------
 * La documentacion de `expo-image-picker` para SDK 54 dice que en el caso de
 * la camara "the EXIF data does not include GPS tags in the camera case". En
 * iOS, una foto tomada con la camara de la app llegara casi siempre sin
 * coordenadas, y el usuario debera capturar el GPS o corregir la ubicacion a
 * mano. Por eso el servicio no da por hecho que habra GPS en la foto.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { REPORT_LIMITS, REPORT_MESSAGES } from '../const/reportCatalogs';
import { isValidCoordinate } from '../const/creelPolygon';

export const PHOTO_ERROR_CODES = {
  cancelled: 'PHOTO_CANCELLED',
  cameraPermissionDenied: 'PHOTO_CAMERA_PERMISSION_DENIED',
  libraryPermissionDenied: 'PHOTO_LIBRARY_PERMISSION_DENIED',
  unavailable: 'PHOTO_UNAVAILABLE',
  tooLarge: 'PHOTO_TOO_LARGE',
};

/**
 * Intentos de compresion, del mas fiel al mas agresivo. Se toma el primero que
 * cabe en el limite, en lugar de una compresion fija, porque fijar una calidad
 * muy bajaeria fotos que si caben bien y fijarla muy alta dejaria pasar
 * imagenes que no caben.
 */
const COMPRESSION_ATTEMPTS = [
  { maxDimension: 1600, quality: 0.7 },
  { maxDimension: 1280, quality: 0.6 },
  { maxDimension: 1024, quality: 0.5 },
  { maxDimension: 800, quality: 0.4 }
];

const OUTPUT_MIME_TYPE = 'image/jpeg';

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Resuelve el signo de una coordenada EXIF.
 *
 * EXIF separa el valor del signo: `GPSLongitude` se guarda en valor absoluto y
 * `GPSLongitudeRef` dice 'E' o 'W'. Ignorar el Ref pondria el hemisferio
 * equivocado, es decir, un punto al otro lado del mundo.
 *
 * Se normaliza con `Math.abs` antes de aplicar el Ref porque hay plataformas que
 * ya entregan el valor con signo: aplicarlo encima de un valor negativo lo
 * devolveria al hemisferio opuesto. Y si el Ref viene ausente se respeta el
 * signo recibido, en vez de asumir norte/este y perder el hemisferio sur.
 */
function applyRef(value, ref, negativeRef) {
  if (typeof ref !== 'string' || ref.trim() === '') {
    return value;
  }

  return ref.trim().toUpperCase() === negativeRef ? -Math.abs(value) : Math.abs(value);
}

/** Lee las coordenadas del EXIF de la foto, si las trae. */
export function extractExifLocation(exif) {
  if (!exif || typeof exif !== 'object') {
    return null;
  }

  const latitude = toNumber(exif.GPSLatitude);
  const longitude = toNumber(exif.GPSLongitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const signedLatitude = applyRef(latitude, exif.GPSLatitudeRef, 'S');
  const signedLongitude = applyRef(longitude, exif.GPSLongitudeRef, 'W');

  if (!isValidCoordinate(signedLatitude, signedLongitude)) {
    return null;
  }

  return { latitude: signedLatitude, longitude: signedLongitude };
}

/**
 * Reduce la dimension mayor a `maxDimension` conservando la proporcion.
 * `ImageManipulatorContext.resize` recalcula el otro lado si se pasa uno solo.
 */
function constrainDimension(width, height, maxDimension) {
  if (!width || !height) {
    return { maxDimension };
  }

  return width >= height ? { width: maxDimension } : { height: maxDimension };
}

function readFileMetadata(uri) {
  try {
    const file = new File(uri);

    return { size: file.size, type: file.type };
  } catch {
    // Si el archivo no se puede leer, se devuelve null y se hace el intento
    // siguiente: es preferible un intento extra a fallar la captura.
    return null;
  }
}

async function renderAndSave(asset, attempt) {
  const context = ImageManipulator.manipulate(asset.uri);
  const size = constrainDimension(asset.width, asset.height, attempt.maxDimension);

  context.resize(size);

  const rendered = await context.renderAsync();

  return rendered.saveAsync({ format: SaveFormat.JPEG, compress: attempt.quality });
}

/**
 * Redimensiona y comprime hasta que la foto quepa en el limite de bytes.
 * @returns {Promise<{uri: string, width: number, height: number, fileSize: number}>}
 */
async function compressToLimit(asset) {
  let lastResult = null;

  for (const attempt of COMPRESSION_ATTEMPTS) {
    const saved = await renderAndSave(asset, attempt);
    const metadata = readFileMetadata(saved.uri);

    lastResult = {
      uri: saved.uri,
      width: saved.width ?? asset.width,
      height: saved.height ?? asset.height,
      fileSize: metadata && Number.isFinite(metadata.size) ? metadata.size : null
    };

    if (lastResult.fileSize !== null && lastResult.fileSize <= REPORT_LIMITS.photo.maxBytes) {
      return lastResult;
    }
  }

  return lastResult;
}

function toDraftPhoto(processed, originalAsset) {
  return {
    uri: processed.uri,
    width: processed.width,
    height: processed.height,
    fileName: `reporte.${OUTPUT_MIME_TYPE.split('/')[1]}`,
    mimeType: OUTPUT_MIME_TYPE,
    fileSize: processed.fileSize,
    originalFileName: originalAsset.fileName || null
  };
}

/**
 * Traduce el resultado de `readExif` del picker. La opcion `exif` solo se
 * entrega si el sistema la soporta, asi que puede venir `null` o `undefined`.
 */
function buildResult(asset) {
  const exifLocation = extractExifLocation(asset.exif);
  return { asset, exifLocation };
}

async function launch(launcher, requestPermission, deniedCode, deniedMessage) {
  try {
    const permission = await requestPermission();

    if (permission && permission.granted === false) {
      return { ok: false, code: deniedCode, message: deniedMessage };
    }
  } catch {
    return {
      ok: false,
      code: PHOTO_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.photoUnavailable
    };
  }

  let result;

  try {
    result = await launcher();
  } catch {
    return {
      ok: false,
      code: PHOTO_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.photoUnavailable
    };
  }

  if (!result || result.canceled || !result.assets || result.assets.length === 0) {
    return { ok: false, code: PHOTO_ERROR_CODES.cancelled, message: '' };
  }

  const { asset, exifLocation } = buildResult(result.assets[0]);

  let processed;

  try {
    processed = await compressToLimit(asset);
  } catch {
    return {
      ok: false,
      code: PHOTO_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.photoUnavailable
    };
  }

  if (!processed || !processed.uri) {
    return {
      ok: false,
      code: PHOTO_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.photoUnavailable
    };
  }

  if (processed.fileSize !== null && processed.fileSize > REPORT_LIMITS.photo.maxBytes) {
    return {
      ok: false,
      code: PHOTO_ERROR_CODES.tooLarge,
      message: REPORT_MESSAGES.photoTooLargeAfterCompress
    };
  }

  return { ok: true, photo: toDraftPhoto(processed, asset), exifLocation };
}

const SHARED_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: false,
  allowsMultipleSelection: false,
  exif: true,
  quality: 1
};

/** Toma una foto con la camara. */
export function takeReportPhoto() {
  return launch(
    () => ImagePicker.launchCameraAsync(SHARED_OPTIONS),
    () => ImagePicker.requestCameraPermissionsAsync(),
    PHOTO_ERROR_CODES.cameraPermissionDenied,
    REPORT_MESSAGES.photoPermissionDenied
  );
}

/** Elige una foto de la galeria. */
export function pickReportPhoto() {
  return launch(
    () => ImagePicker.launchImageLibraryAsync(SHARED_OPTIONS),
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    PHOTO_ERROR_CODES.libraryPermissionDenied,
    REPORT_MESSAGES.photoLibraryPermissionDenied
  );
}
