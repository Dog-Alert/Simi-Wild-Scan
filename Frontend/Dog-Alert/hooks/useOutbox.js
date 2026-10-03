import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { nextWakeAt } from '../domain/syncState';
import { getOutboxService } from '../services/outbox/outboxService';

function isOnline(state) {
  return Boolean(state && state.isConnected && state.isInternetReachable !== false);
}

const ignore = () => {};

export function useOutbox(session, { service, network = Network, appState = AppState } = {}) {
  const serviceRef = useRef(service || getOutboxService());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const userId = session ? session.userId : null;

  const credentials = () =>
    sessionRef.current
      ? { token: sessionRef.current.token, userId: sessionRef.current.userId }
      : {};

  const refresh = useCallback(async () => {
    const list = await serviceRef.current.list();
    setItems(list);
    return list;
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);

    try {
      return await serviceRef.current.syncPending(credentials());
    } finally {
      await refresh();
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    (async () => {
      await serviceRef.current.recoverInterrupted();
      await refresh();
      setReady(true);
      await sync();
    })().catch(ignore);
  }, [refresh, sync]);

  useEffect(() => {
    const subscription = network.addNetworkStateListener((state) => {
      if (isOnline(state)) {
        sync().catch(ignore);
      }
    });

    return () => subscription.remove();
  }, [network, sync]);

  useEffect(() => {
    const subscription = appState.addEventListener('change', (state) => {
      if (state === 'active') {
        sync().catch(ignore);
      }
    });

    return () => subscription.remove();
  }, [appState, sync]);

  useEffect(() => {
    if (userId) {
      sync().catch(ignore);
    }
  }, [userId, sync]);

  useEffect(() => {
    const wakeAt = nextWakeAt(items, userId);

    if (wakeAt === null) {
      return undefined;
    }

    const timer = setTimeout(() => sync().catch(ignore), Math.max(0, wakeAt - Date.now()));
    return () => clearTimeout(timer);
  }, [items, userId, sync]);

  const sendNow = useCallback(
    async (saved) => {
      const result = await sync();
      const current = (await serviceRef.current.list()).find((item) => item.localId === saved.localId);
      return { item: current || saved, error: result.errors[saved.localId] || null };
    },
    [sync]
  );

  const enqueue = useCallback(
    async ({ draft, clientReportId }) => {
      const queued = await serviceRef.current.enqueue({ draft, clientReportId, ownerId: userId });
      return sendNow(queued);
    },
    [userId, sendNow]
  );

  const edit = useCallback(
    async (localId, draft) => {
      return sendNow(await serviceRef.current.edit(localId, draft));
    },
    [sendNow]
  );

  const retry = useCallback(
    async (localId) => {
      setSyncing(true);

      try {
        return await serviceRef.current.retry(localId, credentials());
      } finally {
        await refresh();
        setSyncing(false);
      }
    },
    [refresh]
  );

  const remove = useCallback(
    async (localId) => {
      await serviceRef.current.remove(localId);
      await refresh();
    },
    [refresh]
  );

  return { items, ready, syncing, enqueue, edit, sync, retry, remove, refresh };
}
