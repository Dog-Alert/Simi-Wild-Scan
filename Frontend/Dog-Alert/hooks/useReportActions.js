import { useCallback } from 'react';

import * as myReportsApi from '../apis/myReportsApi';
import { MY_REPORTS_ERROR_CODES } from '../apis/myReportsApi';
import { buildReportUpdatePayload, isReportValid, validateReport } from '../domain/reportValidation';
import { SYNC_ERROR_KINDS, SYNC_STATES } from '../domain/syncState';

const INVALID = 'Revisa los datos del reporte.';

export function useReportActions({ session, outbox, myReports, api = myReportsApi }) {
  const token = session ? session.token : null;

  const deleteEntry = useCallback(
    async (entry) => {
      if (entry.source === 'local') {
        await outbox.remove(entry.item.localId);
        return;
      }

      try {
        await api.deleteMyReport({ token, reportId: entry.report.id });
      } catch (error) {
        if (error.code !== MY_REPORTS_ERROR_CODES.notFound) {
          throw error;
        }
      }

      myReports.removeServerReport(entry.report.id);
    },
    [api, token, outbox, myReports]
  );

  // Devuelve a donde ir tras guardar, o el error para mostrarlo en el formulario.
  const saveEdit = useCallback(
    async (target, draft) => {
      if (!isReportValid(draft)) {
        return { error: { message: INVALID, fields: validateReport(draft) } };
      }

      try {
        if (target.source === 'local') {
          const { item, error } = await outbox.edit(target.localId, draft);

          if (item.state === SYNC_STATES.error && item.errorKind === SYNC_ERROR_KINDS.needsCorrection) {
            throw error || new Error(INVALID);
          }

          return { route: 'EstadoEnvio', params: { localId: item.localId } };
        }

        const updated = await api.updateMyReport({
          token,
          reportId: target.reportId,
          payload: buildReportUpdatePayload(draft),
        });
        myReports.replaceServerReport(updated);
        return {
          route: 'ReporteDetalle',
          params: { key: `server:${updated.id}`, clientReportId: updated.clientReportId },
        };
      } catch (error) {
        return { error: { message: error.message, fields: error.fieldErrors || {} } };
      }
    },
    [api, token, outbox, myReports]
  );

  return { deleteEntry, saveEdit };
}
