import { act, renderHook, waitFor } from '@testing-library/react-native';

import { SYNC_STATES } from '../../domain/syncState';
import { useMyReports } from '../../hooks/useMyReports';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

const SESSION = { token: 'jwt', userId: '7' };

function report(id) {
  return { id, clientReportId: `uuid-${id}`, status: 'PENDING', eventType: 'ATTACK_PET' };
}

function setup({ session = SESSION, queueItems = [], api } = {}) {
  const fakeApi = api || {
    listMyReports: jest.fn(async ({ cursor }) =>
      cursor ? { items: [report(2)], nextCursor: null } : { items: [report(1)], nextCursor: 'p2' }
    ),
  };
  const hook = renderHook(
    ({ current, items }) => useMyReports(current, items, { api: fakeApi }),
    { initialProps: { current: session, items: queueItems } }
  );
  return { ...hook, api: fakeApi };
}

describe('useMyReports', () => {
  it('carga la primera pagina con el token', async () => {
    const { result, api } = setup();

    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    expect(api.listMyReports).toHaveBeenCalledWith({ token: 'jwt' });
    expect(result.current.hasMore).toBe(true);
  });

  it('carga la siguiente pagina sin repetir', async () => {
    const { result, api } = setup();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    await act(() => result.current.loadMore());

    expect(api.listMyReports).toHaveBeenLastCalledWith({ token: 'jwt', cursor: 'p2' });
    expect(result.current.entries.map((entry) => entry.key)).toEqual(['server:1', 'server:2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('sin sesion no llama al servidor y muestra la cola anonima', async () => {
    const item = {
      localId: 'a',
      clientReportId: 'a',
      ownerId: null,
      state: SYNC_STATES.pending,
      createdAt: 1,
      summary: { eventType: 'SIGHTING' },
    };
    const { result, api } = setup({ session: null, queueItems: [item] });

    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(api.listMyReports).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor', async () => {
    const api = { listMyReports: jest.fn().mockRejectedValue(new Error('Sin conexión')) };
    const { result } = setup({ api });

    await waitFor(() => expect(result.current.error).toBe('Sin conexión'));
    expect(result.current.loading).toBe(false);
  });

  it('recarga cuando un reporte propio termina de sincronizar', async () => {
    const pending = { localId: 'a', clientReportId: 'a', ownerId: '7', state: SYNC_STATES.syncing };
    const { result, api, rerender } = setup({ queueItems: [pending] });
    await waitFor(() => expect(result.current.entries.length).toBeGreaterThan(0));
    expect(api.listMyReports).toHaveBeenCalledTimes(1);

    rerender({ current: SESSION, items: [{ ...pending, state: SYNC_STATES.synced }] });

    await waitFor(() => expect(api.listMyReports).toHaveBeenCalledTimes(2));
  });

  it('actualiza o quita un reporte del servidor sin recargar', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    act(() => result.current.replaceServerReport({ ...report(1), status: 'VERIFIED' }));
    expect(result.current.entries[0].status.label).toBe('Verificado');

    act(() => result.current.removeServerReport(1));
    expect(result.current.entries).toEqual([]);
  });
});
