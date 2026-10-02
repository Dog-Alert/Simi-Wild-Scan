import * as ImagePicker from 'expo-image-picker';

import {
  PHOTO_ERROR_CODES,
  extractExifLocation,
  pickReportPhoto,
  takeReportPhoto
} from '../../services/photoService';
import { REPORT_LIMITS, REPORT_MESSAGES } from '../../const/reportCatalogs';

const mockSaveAsync = jest.fn();
const mockRenderAsync = jest.fn(() => ({ saveAsync: mockSaveAsync }));
const mockResize = jest.fn();
const mockFileSizes = {};

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: (...args) => mockResize(...args),
      renderAsync: (...args) => mockRenderAsync(...args)
    }))
  }
}));

jest.mock('expo-file-system', () => ({
  File: class {
    constructor(uri) {
      this.uri = uri;
    }

    get size() {
      return mockFileSizes[this.uri];
    }

    get type() {
      return 'image/jpeg';
    }
  }
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn()
}));

const MAX_BYTES = REPORT_LIMITS.photo.maxBytes;
const PICKED_URI = 'file://original.jpg';

/**
 * Programa los archivos que producira cada intento de compresion. El doble de
 * `File` no existe en el sistema de pruebas, asi que el tamano en disco se
 * inyecta por uri.
 */
function arrangeOutputs(sizes) {
  Object.keys(mockFileSizes).forEach((key) => delete mockFileSizes[key]);

  sizes.forEach((size, index) => {
    mockFileSizes[`file://out-${index}`] = size;
  });

  mockSaveAsync.mockImplementation(async () => ({
    uri: `file://out-${mockSaveAsync.mock.calls.length - 1}`,
    width: 1000,
    height: 750
  }));
}

function asset(overrides = {}) {
  return { uri: PICKED_URI, width: 3000, height: 2000, fileName: 'IMG_0001.HEIC', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockFileSizes).forEach((key) => delete mockFileSizes[key]);
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  arrangeOutputs([500 * 1024]);
});

describe('extractExifLocation', () => {
  it('lee coordenadas del hemisferio norte y este', () => {
    const location = extractExifLocation({
      GPSLatitude: 25.0,
      GPSLongitude: 100.0,
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E'
    });

    expect(location).toEqual({ latitude: 25.0, longitude: 100.0 });
  });

  it('hace prevalecer el campo Ref cuando el valor viene con signo contrario', () => {
    const location = extractExifLocation({
      GPSLatitude: 27.75,
      GPSLongitude: -107.6359,
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E'
    });

    expect(location).toEqual({ latitude: 27.75, longitude: 107.6359 });
  });

  it('aplica el signo que indican los campos Ref', () => {
    const location = extractExifLocation({
      GPSLatitude: 27.75,
      GPSLongitude: 107.63,
      GPSLatitudeRef: 'S',
      GPSLongitudeRef: 'W'
    });

    expect(location).toEqual({ latitude: -27.75, longitude: -107.63 });
  });

  it('acepta coordenadas expresadas como texto', () => {
    const location = extractExifLocation({
      GPSLatitude: '27.7506',
      GPSLongitude: '107.6359',
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'W'
    });

    expect(location).toEqual({ latitude: 27.7506, longitude: -107.6359 });
  });

  it('no duplica el signo cuando la plataforma ya lo entrega en el valor', () => {
    const location = extractExifLocation({
      GPSLatitude: -27.7506,
      GPSLongitude: -107.6359,
      GPSLatitudeRef: 'S',
      GPSLongitudeRef: 'W'
    });

    expect(location).toEqual({ latitude: -27.7506, longitude: -107.6359 });
  });

  it('respeta el signo recibido cuando falta el campo Ref', () => {
    const location = extractExifLocation({ GPSLatitude: -27.7506, GPSLongitude: -107.6359 });

    expect(location).toEqual({ latitude: -27.7506, longitude: -107.6359 });
  });

  it('devuelve null si no hay EXIF, es el caso de la camara en iOS', () => {
    expect(extractExifLocation(null)).toBeNull();
    expect(extractExifLocation(undefined)).toBeNull();
    expect(extractExifLocation({})).toBeNull();
    expect(extractExifLocation({ GPSLatitude: 27.75 })).toBeNull();
  });

  it('descarta coordenadas EXIF fuera de rango', () => {
    expect(
      extractExifLocation({ GPSLatitude: 27.75, GPSLongitude: 200, GPSLongitudeRef: 'E' })
    ).toBeNull();
  });
});

describe('takeReportPhoto', () => {
  it('devuelve la foto lista para enviar', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });

    const result = await takeReportPhoto();

    expect(result.ok).toBe(true);
    expect(result.photo).toMatchObject({
      uri: 'file://out-0',
      width: 1000,
      height: 750,
      fileName: 'reporte.jpeg',
      mimeType: 'image/jpeg',
      fileSize: 500 * 1024
    });
    expect(result.photo.originalFileName).toBe('IMG_0001.HEIC');
    expect(result.exifLocation).toBeNull();
  });

  it('pide la camara con EXIF y una sola imagen', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });
    await takeReportPhoto();

    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], exif: true, allowsMultipleSelection: false })
    );
  });

  it('extrae el GPS del EXIF antes de recomprimir la imagen', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [
        asset({
          exif: { GPSLatitude: 27.7506, GPSLongitude: 107.6359, GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' }
        })
      ]
    });

    const result = await takeReportPhoto();

    // La salida recomprimida no conserva EXIF, por eso el servicio lo lee antes.
    expect(result.exifLocation).toEqual({ latitude: 27.7506, longitude: -107.6359 });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: expect.any(Number) });
  });

  it('no vuelve a comprimir cuando la primera foto ya cabe', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });

    await takeReportPhoto();

    expect(mockSaveAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7 });
  });

  it('reduce progresivamente hasta que la foto cabe en el limite', async () => {
    arrangeOutputs([2 * MAX_BYTES, 1.4 * MAX_BYTES, 300 * 1024, 200 * 1024]);
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });

    const result = await takeReportPhoto();

    expect(result.ok).toBe(true);
    expect(result.photo.fileSize).toBe(300 * 1024);
    expect(mockSaveAsync).toHaveBeenCalledTimes(3);
    expect(mockSaveAsync.mock.calls.map((call) => call[0].compress)).toEqual([0.7, 0.6, 0.5]);
  });

  it('rechaza la foto si ni el intento mas agresivo cabe en el limite', async () => {
    arrangeOutputs([2 * MAX_BYTES, 2 * MAX_BYTES, 2 * MAX_BYTES, 2 * MAX_BYTES]);
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });

    const result = await takeReportPhoto();

    expect(result.ok).toBe(false);
    expect(result.code).toBe(PHOTO_ERROR_CODES.tooLarge);
    expect(result.message).toBe(REPORT_MESSAGES.photoTooLargeAfterCompress);
    expect(mockSaveAsync).toHaveBeenCalledTimes(4);
  });

  it('acota el lado mayor conservando la proporcion', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });
    await takeReportPhoto();
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });

    mockResize.mockClear();

    ImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [asset({ width: 2000, height: 3000 })]
    });
    await takeReportPhoto();
    expect(mockResize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('informa cuando el usuario cierra la camara sin elegir foto', async () => {
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });

    const result = await takeReportPhoto();

    expect(result).toEqual({ ok: false, code: PHOTO_ERROR_CODES.cancelled, message: '' });
    expect(mockSaveAsync).not.toHaveBeenCalled();
  });

  it('informa cuando el permiso de camara esta denegado', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await takeReportPhoto();

    expect(result.code).toBe(PHOTO_ERROR_CODES.cameraPermissionDenied);
    expect(result.message).toBe(REPORT_MESSAGES.photoPermissionDenied);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('reporta como no disponible si la camara o la compresion fallan', async () => {
    ImagePicker.launchCameraAsync.mockRejectedValue(new Error('boom'));
    expect((await takeReportPhoto()).code).toBe(PHOTO_ERROR_CODES.unavailable);

    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset()] });
    mockRenderAsync.mockRejectedValueOnce(new Error('boom'));
    expect((await takeReportPhoto()).code).toBe(PHOTO_ERROR_CODES.unavailable);
  });
});

describe('pickReportPhoto', () => {
  it('elige una imagen de la galeria', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset()] });

    const result = await pickReportPhoto();

    expect(result.ok).toBe(true);
    expect(result.photo.mimeType).toBe('image/jpeg');
  });

  it('informa cuando el permiso de galeria esta denegado', async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await pickReportPhoto();

    expect(result.code).toBe(PHOTO_ERROR_CODES.libraryPermissionDenied);
    expect(result.message).toBe(REPORT_MESSAGES.photoLibraryPermissionDenied);
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
