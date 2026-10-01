import { useCallback, useMemo, useState } from 'react';

import { createEmptyReportDraft, validateReport } from '../domain/reportValidation';

/**
 * Borrador del reporte compartido por los dos pasos del formulario.
 *
 * Vive en App.js y se pasa por props a las pantallas, igual que el resto de
 * callbacks del proyecto. Se evita un context porque solo lo consumen dos
 * pantallas hermanas.
 *
 * `locationDerivedFromPhoto` es una bandera del borrador local: el contrato no
 * tiene un valor de ubicacion "viene de la foto", asi que en el payload la
 * ubicacion viaja como MANUAL. Solo se usa para distinguirla en la interfaz.
 */
export function useReportDraft() {
  const [draft, setDraft] = useState(createEmptyReportDraft);

  const updateDraft = useCallback((changes) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(createEmptyReportDraft());
  }, []);

  const errors = useMemo(() => validateReport(draft), [draft]);

  return { draft, updateDraft, resetDraft, errors };
}

export default useReportDraft;
