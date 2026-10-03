import { deletePhoto, persistPhoto } from '../../services/outbox/localPhotoStore';

const mockFiles = new Set();
const mockCopies = [];

jest.mock('expo-file-system', () => {
  const join = (...parts) =>
    parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');

  return {
    Paths: { document: { uri: 'file:///documents' } },
    Directory: class {
      constructor(...parts) {
        this.uri = join(...parts);
      }

      create() {}
    },
    File: class {
      constructor(...parts) {
        this.uri = join(...parts);
      }

      get exists() {
        return mockFiles.has(this.uri);
      }

      copy(target) {
        mockCopies.push([this.uri, target.uri]);
        mockFiles.add(target.uri);
      }

      delete() {
        mockFiles.delete(this.uri);
      }
    },
  };
});

const CACHE_URI = 'file:///cache/ImageManipulator/abc.jpg';
const PRIVATE_URI = 'file:///documents/outbox/photos/report-1.jpg';

beforeEach(() => {
  mockFiles.clear();
  mockCopies.length = 0;
  mockFiles.add(CACHE_URI);
});

describe('persistPhoto', () => {
  it('copia la foto de cache al directorio privado de la cola', () => {
    const photo = { uri: CACHE_URI, mimeType: 'image/jpeg', fileSize: 1000 };

    const saved = persistPhoto('report-1', photo);

    expect(saved).toEqual({ ...photo, uri: PRIVATE_URI });
    expect(mockCopies).toEqual([[CACHE_URI, PRIVATE_URI]]);
  });

  it('usa la extension del tipo de imagen', () => {
    const saved = persistPhoto('report-1', { uri: CACHE_URI, mimeType: 'image/png' });

    expect(saved.uri).toBe('file:///documents/outbox/photos/report-1.png');
  });

  it('reemplaza una copia anterior del mismo reporte', () => {
    mockFiles.add(PRIVATE_URI);

    persistPhoto('report-1', { uri: CACHE_URI, mimeType: 'image/jpeg' });

    expect(mockCopies).toHaveLength(1);
    expect(mockFiles.has(PRIVATE_URI)).toBe(true);
  });

  it('no copia una foto que ya esta en la cola', () => {
    const photo = { uri: PRIVATE_URI, mimeType: 'image/jpeg' };

    expect(persistPhoto('report-1', photo)).toBe(photo);
    expect(mockCopies).toEqual([]);
  });

  it('devuelve null sin foto', () => {
    expect(persistPhoto('report-1', null)).toBeNull();
    expect(persistPhoto('report-1', {})).toBeNull();
  });
});

describe('deletePhoto', () => {
  it('borra la copia privada', () => {
    mockFiles.add(PRIVATE_URI);

    expect(deletePhoto({ uri: PRIVATE_URI })).toBe(true);
    expect(mockFiles.has(PRIVATE_URI)).toBe(false);
  });

  it('nunca borra archivos fuera de la cola', () => {
    expect(deletePhoto({ uri: CACHE_URI })).toBe(false);
    expect(mockFiles.has(CACHE_URI)).toBe(true);
  });

  it('ignora fotos inexistentes o vacias', () => {
    expect(deletePhoto({ uri: PRIVATE_URI })).toBe(false);
    expect(deletePhoto(null)).toBe(false);
  });
});
