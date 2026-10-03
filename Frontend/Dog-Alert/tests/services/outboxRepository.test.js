import {
  OUTBOX_SCHEMA_VERSION,
  createFileStorage,
  createMemoryStorage,
  createOutboxRepository,
} from '../../services/outbox/outboxRepository';

const mockFiles = {};

jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///documents' } },
  Directory: class {
    constructor(parent, name) {
      this.uri = `${parent.uri}/${name}`;
    }

    create() {}
  },
  File: class {
    constructor(directory, name) {
      this.uri = `${directory.uri}/${name}`;
    }

    get exists() {
      return this.uri in mockFiles;
    }

    create() {
      mockFiles[this.uri] = '';
    }

    write(text) {
      mockFiles[this.uri] = text;
    }

    async text() {
      return mockFiles[this.uri];
    }
  },
}));

function item(localId, overrides = {}) {
  return { localId, clientReportId: localId, state: 'SYNC_PENDING', createdAt: 1, ...overrides };
}

describe('createOutboxRepository', () => {
  it('empieza vacia', async () => {
    const repository = createOutboxRepository(createMemoryStorage());

    expect(await repository.list()).toEqual([]);
  });

  it('inserta, consulta y lista', async () => {
    const repository = createOutboxRepository(createMemoryStorage());

    await repository.insert(item('a'));
    await repository.insert(item('b'));

    expect((await repository.list()).map((entry) => entry.localId)).toEqual(['a', 'b']);
    expect(await repository.get('b')).toMatchObject({ localId: 'b' });
    expect(await repository.get('z')).toBeNull();
  });

  it('no inserta dos veces el mismo reporte', async () => {
    const repository = createOutboxRepository(createMemoryStorage());

    await repository.insert(item('a'));

    await expect(repository.insert(item('a'))).rejects.toThrow(/ya esta en la cola/);
    expect(await repository.list()).toHaveLength(1);
  });

  it('actualiza un elemento y devuelve el resultado', async () => {
    const repository = createOutboxRepository(createMemoryStorage());
    await repository.insert(item('a'));

    const updated = await repository.update('a', (current) => ({ ...current, state: 'SYNCED' }));

    expect(updated.state).toBe('SYNCED');
    expect((await repository.get('a')).state).toBe('SYNCED');
    expect(await repository.update('z', (current) => current)).toBeNull();
  });

  it('si el cambio falla no guarda nada', async () => {
    const storage = createMemoryStorage();
    const repository = createOutboxRepository(storage);
    await repository.insert(item('a'));
    const saved = storage.state.text;

    await expect(
      repository.update('a', () => {
        throw new Error('transicion invalida');
      })
    ).rejects.toThrow('transicion invalida');

    expect(storage.state.text).toBe(saved);
    expect((await repository.get('a')).state).toBe('SYNC_PENDING');
  });

  it('updateAll solo escribe si algo cambio', async () => {
    const storage = createMemoryStorage();
    const repository = createOutboxRepository(storage);
    await repository.insert(item('a'));
    await repository.insert(item('b'));
    const save = jest.spyOn(storage, 'save');

    await repository.updateAll((current) => current);
    expect(save).not.toHaveBeenCalled();

    const result = await repository.updateAll((current) =>
      current.localId === 'b' ? { ...current, state: 'SYNCED' } : current
    );

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.map((entry) => entry.state)).toEqual(['SYNC_PENDING', 'SYNCED']);
  });

  it('elimina un elemento', async () => {
    const repository = createOutboxRepository(createMemoryStorage());
    await repository.insert(item('a'));

    expect(await repository.remove('a')).toBe(true);
    expect(await repository.remove('a')).toBe(false);
    expect(await repository.list()).toEqual([]);
  });

  it('sobrevive a cerrar y abrir la app', async () => {
    const storage = createMemoryStorage();
    await createOutboxRepository(storage).insert(item('a', { attempts: 3 }));

    const reopened = createOutboxRepository(storage);

    expect(await reopened.get('a')).toMatchObject({ localId: 'a', attempts: 3 });
    expect(JSON.parse(storage.state.text).schemaVersion).toBe(OUTBOX_SCHEMA_VERSION);
  });

  it('aparta un archivo ilegible en lugar de borrarlo', async () => {
    const storage = createMemoryStorage('{esto no es json');
    const repository = createOutboxRepository(storage);

    expect(await repository.list()).toEqual([]);
    expect(storage.state.quarantined).toEqual(['{esto no es json']);
  });

  it('no pierde cambios con escrituras simultaneas', async () => {
    const repository = createOutboxRepository(createMemoryStorage());
    await repository.insert(item('a', { attempts: 0 }));

    await Promise.all(
      Array.from({ length: 10 }, () =>
        repository.update('a', (current) => ({ ...current, attempts: current.attempts + 1 }))
      )
    );

    expect((await repository.get('a')).attempts).toBe(10);
  });

  it('no modifica la lista devuelta al seguir escribiendo', async () => {
    const repository = createOutboxRepository(createMemoryStorage());
    await repository.insert(item('a'));
    const snapshot = await repository.list();

    await repository.insert(item('b'));

    expect(snapshot).toHaveLength(1);
  });
});

describe('createFileStorage', () => {
  beforeEach(() => {
    Object.keys(mockFiles).forEach((key) => delete mockFiles[key]);
  });

  it('guarda la cola en documents/outbox/queue.json', async () => {
    const repository = createOutboxRepository(createFileStorage());

    await repository.insert(item('a'));

    const saved = JSON.parse(mockFiles['file:///documents/outbox/queue.json']);
    expect(saved.items[0].localId).toBe('a');
  });

  it('lee lo guardado en una nueva instancia', async () => {
    await createOutboxRepository(createFileStorage()).insert(item('a'));

    const reopened = createOutboxRepository(createFileStorage());

    expect(await reopened.get('a')).toMatchObject({ localId: 'a' });
  });

  it('devuelve una cola vacia si el archivo no existe', async () => {
    expect(await createOutboxRepository(createFileStorage()).list()).toEqual([]);
  });

  it('aparta el archivo ilegible junto a la cola', async () => {
    mockFiles['file:///documents/outbox/queue.json'] = 'roto';

    await createOutboxRepository(createFileStorage()).list();

    const corrupt = Object.keys(mockFiles).find((uri) => uri.includes('queue.corrupt-'));
    expect(mockFiles[corrupt]).toBe('roto');
  });
});
