import { renderHook, act } from '@testing-library/react-native';

import { useReportDraft } from '../../hooks/UseReportDraft';
import { CREEL_CENTER } from '../../const/creelPolygon';

function fillLocation(draft) {
  return { ...draft, location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 12 } };
}

describe('useReportDraft', () => {
  it('empieza con un borrador vacio y con los errores de los campos faltantes', () => {
    const { result } = renderHook(() => useReportDraft());

    expect(result.current.draft.eventType).toBe('');
    expect(result.current.draft.location).toBeNull();
    expect(Object.keys(result.current.errors)).toEqual(
      expect.arrayContaining(['eventType', 'location', 'description'])
    );
  });

  it('fusiona los cambios parciales sin perder lo ya capturado', () => {
    const { result } = renderHook(() => useReportDraft());

    act(() => {
      result.current.updateDraft({ eventType: 'ATTACK_PET' });
    });
    act(() => {
      result.current.updateDraft({ location: fillLocation(result.current.draft).location });
    });

    expect(result.current.draft.eventType).toBe('ATTACK_PET');
    expect(result.current.draft.location).not.toBeNull();
  });

  it('no borra los demas campos al actualizar uno', () => {
    const { result } = renderHook(() => useReportDraft());

    act(() => {
      result.current.updateDraft({ eventType: 'ATTACK_PET' });
    });
    act(() => {
      result.current.updateDraft({ certainty: 'HIGH' });
    });

    expect(result.current.draft).toEqual(
      expect.objectContaining({ eventType: 'ATTACK_PET', certainty: 'HIGH' })
    );
  });

  it('recalcula los errores a medida que se completa el borrador', () => {
    const { result } = renderHook(() => useReportDraft());

    expect(result.current.errors.eventType).toBeDefined();

    act(() => {
      result.current.updateDraft({ eventType: 'ATTACK_PET' });
    });

    expect(result.current.errors.eventType).toBeUndefined();
  });

  it('descarta todo el contenido anterior al reiniciar', () => {
    const { result } = renderHook(() => useReportDraft());

    act(() => {
      result.current.updateDraft({ eventType: 'ATTACK_PET', description: 'Perro flaco' });
    });

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.draft.eventType).toBe('');
    expect(result.current.draft.description).toBe('');
  });
});
