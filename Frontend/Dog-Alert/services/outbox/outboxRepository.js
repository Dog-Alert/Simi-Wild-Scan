// Cola local de reportes. Implementacion temporal sobre un archivo JSON hasta
// tener el SQLite de DOG-37, que debe exponer los mismos metodos.

import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

export const OUTBOX_SCHEMA_VERSION = 1;

const OUTBOX_DIRECTORY = 'outbox';
const OUTBOX_FILE = 'queue.json';

export function createOutboxRepository(storage) {
  let items = null;
  let queue = Promise.resolve();

  // Serializa las operaciones para que dos escrituras no se pisen.
  function exclusive(operation) {
    const run = queue.then(operation);
    queue = run.catch(() => {});
    return run;
  }

  async function load() {
    if (items) {
      return items;
    }

    const text = await storage.load();

    if (!text) {
      items = [];
      return items;
    }

    try {
      const parsed = JSON.parse(text);
      items = Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      // Nunca se descarta en silencio: se aparta la copia ilegible (SDD 6.7).
      await storage.quarantine(text);
      items = [];
    }

    return items;
  }

  async function persist(nextItems) {
    await storage.save(JSON.stringify({ schemaVersion: OUTBOX_SCHEMA_VERSION, items: nextItems }));
    items = nextItems;
  }

  return {
    list: () => exclusive(async () => [...(await load())]),

    get: (localId) =>
      exclusive(async () => (await load()).find((item) => item.localId === localId) || null),

    insert: (item) =>
      exclusive(async () => {
        const current = await load();

        if (current.some((existing) => existing.localId === item.localId)) {
          throw new Error(`El reporte ${item.localId} ya esta en la cola.`);
        }

        await persist([...current, item]);
        return item;
      }),

    update: (localId, updater) =>
      exclusive(async () => {
        const current = await load();
        const index = current.findIndex((item) => item.localId === localId);

        if (index === -1) {
          return null;
        }

        const updated = updater(current[index]);
        const nextItems = [...current];
        nextItems[index] = updated;
        await persist(nextItems);
        return updated;
      }),

    updateAll: (updater) =>
      exclusive(async () => {
        const current = await load();
        const nextItems = current.map(updater);

        if (nextItems.some((item, index) => item !== current[index])) {
          await persist(nextItems);
        }

        return [...nextItems];
      }),

    remove: (localId) =>
      exclusive(async () => {
        const current = await load();
        const nextItems = current.filter((item) => item.localId !== localId);

        if (nextItems.length === current.length) {
          return false;
        }

        await persist(nextItems);
        return true;
      }),
  };
}

export function createMemoryStorage(initialText = null) {
  const state = { text: initialText, quarantined: [] };

  return {
    state,
    load: async () => state.text,
    save: async (text) => {
      state.text = text;
    },
    quarantine: async (text) => {
      state.quarantined.push(text);
    },
  };
}

export function createFileStorage(directory = new Directory(Paths.document, OUTBOX_DIRECTORY)) {
  const file = () => new File(directory, OUTBOX_FILE);

  function writeFile(target, text) {
    directory.create({ intermediates: true, idempotent: true });

    if (!target.exists) {
      target.create();
    }

    target.write(text);
  }

  return {
    load: async () => {
      const target = file();
      return target.exists ? target.text() : null;
    },
    save: async (text) => writeFile(file(), text),
    quarantine: async (text) =>
      writeFile(new File(directory, `queue.corrupt-${Date.now()}.json`), text),
  };
}

let defaultRepository = null;

export function getOutboxRepository() {
  if (!defaultRepository) {
    // expo-file-system no funciona en web; ahi la cola solo vive en memoria.
    const storage = Platform.OS === 'web' ? createMemoryStorage() : createFileStorage();
    defaultRepository = createOutboxRepository(storage);
  }

  return defaultRepository;
}
