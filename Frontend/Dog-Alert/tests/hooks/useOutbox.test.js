import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useOutbox } from '../../hooks/useOutbox';

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));
jest.mock('../../services/outbox/outboxService', () => ({ getOutboxService: jest.fn() }));

function emitter() {
  const listeners = [];
  return {
    listeners,
    emit: (value) => listeners.forEach((listener) => listener(value)),
    subscribe: (listener) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    },
  };
}

function fakeService(items = []) {
  const state = { items };
  return {
    state,
    list: jest.fn(async () => state.items),
    recoverInterrupted: jest.fn(async () => state.items),
    syncPending: jest.fn(async () => ({ synced: [], failed: [], errors: {} })),
    enqueue: jest.fn(async ({ clientReportId, ownerId }) => {
      const item = { localId: clientReportId, clientReportId, ownerId, state: 'SYNC_PENDING' };
      state.items = [...state.items, item];
      return item;
    }),
    retry: jest.fn(async () => ({ synced: [], failed: [], errors: {} })),
    remove: jest.fn(async (localId) => {
      state.items = state.items.filter((item) => item.localId !== localId);
      return true;
    }),
  };
}

function setup(session = null, items = []) {
  const service = fakeService(items);
  const network = emitter();
  const appState = emitter();
  const hook = renderHook(({ current }) =>
    useOutbox(current, {
      service,
      network: { addNetworkStateListener: network.subscribe },
      appState: { addEventListener: (_event, listener) => appState.subscribe(listener) },
    }),
    { initialProps: { current: session } }
  );

  return { ...hook, service, network, appState };
}

const SESSION = { token: 'jwt', userId: '7' };

afterEach(() => {
  jest.useRealTimers();
});

describe('useOutbox', () => {
  it('al abrir recupera envios cortados, carga la cola y sincroniza', async () => {
    const pending = { localId: 'a', state: 'SYNC_PENDING', nextAttemptAt: null };
    const { result, service } = setup(null, [pending]);

    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(service.syncPending).toHaveBeenCalled());

    expect(service.recoverInterrupted).toHaveBeenCalled();
    expect(result.current.items).toEqual([pending]);
  });

  it('sincroniza al recuperar la red, no al perderla', async () => {
    const { result, service, network } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(service.syncPending).toHaveBeenCalledTimes(1));

    await act(async () => network.emit({ isConnected: false }));
    await act(async () => network.emit({ isConnected: true, isInternetReachable: false }));
    expect(service.syncPending).toHaveBeenCalledTimes(1);

    await act(async () => network.emit({ isConnected: true, isInternetReachable: true }));
    expect(service.syncPending).toHaveBeenCalledTimes(2);
  });

  it('sincroniza al volver la app al primer plano', async () => {
    const { result, service, appState } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(service.syncPending).toHaveBeenCalledTimes(1));

    await act(async () => appState.emit('background'));
    await act(async () => appState.emit('active'));

    expect(service.syncPending).toHaveBeenCalledTimes(2);
  });

  it('al iniciar sesion sincroniza con el token del autor', async () => {
    const { result, service, rerender } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    rerender({ current: SESSION });

    await waitFor(() =>
      expect(service.syncPending).toHaveBeenLastCalledWith({ token: 'jwt', userId: '7' })
    );
  });

  it('despierta la cola cuando vence el siguiente intento', async () => {
    jest.useFakeTimers({ now: 1000 });
    const waiting = { localId: 'a', state: 'SYNC_PENDING', ownerId: null, nextAttemptAt: 6000 };
    const { result, service } = setup(null, [waiting]);
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(service.syncPending).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(service.syncPending).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(service.syncPending).toHaveBeenCalledTimes(2);
  });

  it('enqueue guarda con el autor de la sesion y devuelve el estado tras el intento', async () => {
    const { result, service } = setup(SESSION);
    await waitFor(() => expect(result.current.ready).toBe(true));
    const error = { status: 422 };
    service.syncPending.mockImplementation(async () => {
      service.state.items = service.state.items.map((item) => ({ ...item, state: 'SYNC_ERROR' }));
      return { synced: [], failed: [], errors: { u1: error } };
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.enqueue({ draft: {}, clientReportId: 'u1' });
    });

    expect(service.enqueue).toHaveBeenCalledWith({ draft: {}, clientReportId: 'u1', ownerId: '7' });
    expect(outcome.item.state).toBe('SYNC_ERROR');
    expect(outcome.error).toBe(error);
  });

  it('un reporte anonimo se guarda sin autor', async () => {
    const { result, service } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(() => result.current.enqueue({ draft: {}, clientReportId: 'u1' }));

    expect(service.enqueue).toHaveBeenCalledWith(expect.objectContaining({ ownerId: null }));
  });

  it('retry y remove actualizan la lista', async () => {
    const item = { localId: 'a', state: 'SYNC_ERROR', nextAttemptAt: null };
    const { result, service } = setup(SESSION, [item]);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(() => result.current.retry('a'));
    expect(service.retry).toHaveBeenCalledWith('a', { token: 'jwt', userId: '7' });

    await act(() => result.current.remove('a'));
    expect(result.current.items).toEqual([]);
  });
});
