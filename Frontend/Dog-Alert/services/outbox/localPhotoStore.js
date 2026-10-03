// La foto comprimida vive en cache y el sistema puede borrarla; la cola guarda
// su propia copia en el directorio privado de documentos.

import { Directory, File, Paths } from 'expo-file-system';

function photosDirectory() {
  return new Directory(Paths.document, 'outbox', 'photos');
}

function extensionFor(photo) {
  const fromMime = photo.mimeType ? photo.mimeType.split('/')[1] : null;
  return fromMime === 'jpeg' ? 'jpg' : fromMime || 'jpg';
}

export function persistPhoto(localId, photo) {
  if (!photo || !photo.uri) {
    return null;
  }

  const directory = photosDirectory();
  directory.create({ intermediates: true, idempotent: true });

  const target = new File(directory, `${localId}.${extensionFor(photo)}`);

  if (target.uri === photo.uri) {
    return photo;
  }

  if (target.exists) {
    target.delete();
  }

  new File(photo.uri).copy(target);

  return { ...photo, uri: target.uri };
}

export function deletePhoto(photo) {
  if (!photo || !photo.uri || !photo.uri.startsWith(photosDirectory().uri)) {
    return false;
  }

  const file = new File(photo.uri);

  if (!file.exists) {
    return false;
  }

  file.delete();
  return true;
}
