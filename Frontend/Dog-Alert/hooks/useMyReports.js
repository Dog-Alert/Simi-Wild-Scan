import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as myReportsApi from '../apis/myReportsApi';
import { buildMyReportEntries } from '../domain/myReports';
import { SYNC_STATES } from '../domain/syncState';

export function useMyReports(session, queueItems, { api = myReportsApi } = {}) {
  const apiRef = useRef(api);
  const token = session ? session.token : null;
  const userId = session ? session.userId : null;

  const [serverReports, setServerReports] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setServerReports([]);
      setNextCursor(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await apiRef.current.listMyReports({ token });
      setServerReports(page.items);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!token || !nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const page = await apiRef.current.listMyReports({ token, cursor: nextCursor });
      setServerReports((current) => {
        const known = new Set(current.map((report) => report.id));
        return [...current, ...page.items.filter((report) => !known.has(report.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [token, nextCursor, loadingMore]);

  // Cuando un reporte propio termina de sincronizar, ya aparece en el servidor.
  const syncedOwned = queueItems.filter(
    (item) => item.state === SYNC_STATES.synced && item.ownerId === userId
  ).length;

  useEffect(() => {
    refresh();
  }, [refresh, syncedOwned]);

  const replaceServerReport = useCallback((report) => {
    setServerReports((current) => current.map((entry) => (entry.id === report.id ? report : entry)));
  }, []);

  const removeServerReport = useCallback((reportId) => {
    setServerReports((current) => current.filter((entry) => entry.id !== reportId));
  }, []);

  const entries = useMemo(
    () => buildMyReportEntries({ serverReports, queueItems, userId }),
    [serverReports, queueItems, userId]
  );

  return {
    entries,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(nextCursor),
    refresh,
    loadMore,
    replaceServerReport,
    removeServerReport,
  };
}
