import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { formatElapsed, getSyncStatus } from '../../const/syncLabels';
import { SYNC_ERROR_KINDS, SYNC_STATES } from '../../domain/syncState';
import SinConexionScreen from '../../screens/SinConexionScreen';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');

function item(overrides = {}) {
  return {
    localId: 'a',
    state: SYNC_STATES.pending,
    errorKind: null,
    attempts: 1,
    createdAt: NOW - 2 * 60000,
    ...overrides,
  };
}

function renderScreen(props = {}) {
  const handlers = { onRetry: jest.fn(), onViewReports: jest.fn(), onDone: jest.fn() };
  const screen = render(<SinConexionScreen item={item()} {...handlers} {...props} />);
  return { ...screen, ...handlers };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getSyncStatus', () => {
  it.each([
    [SYNC_STATES.localSaved, null, 'Guardado localmente'],
    [SYNC_STATES.pending, null, 'Guardado localmente'],
    [SYNC_STATES.syncing, null, 'Sincronizando'],
    [SYNC_STATES.synced, null, 'Sincronizado'],
    [SYNC_STATES.error, SYNC_ERROR_KINDS.needsCorrection, 'Error'],
  ])('%s/%s -> %s', (state, errorKind, label) => {
    expect(getSyncStatus(item({ state, errorKind })).label).toBe(label);
  });

  it('explica cada tipo de error', () => {
    const needsLogin = getSyncStatus(item({ state: SYNC_STATES.error, errorKind: SYNC_ERROR_KINDS.needsLogin }));

    expect(needsLogin.detail).toMatch(/Inicia sesión/);
  });
});

describe('formatElapsed', () => {
  it.each([
    [30 * 1000, 'hace un momento'],
    [2 * 60000, 'hace 2 min'],
    [3 * 3600000, 'hace 3 h'],
    [24 * 3600000, 'hace 1 día'],
    [72 * 3600000, 'hace 3 días'],
  ])('%i ms -> %s', (elapsed, text) => {
    expect(formatElapsed(NOW - elapsed, NOW)).toBe(text);
  });
});

describe('SinConexionScreen', () => {
  it('muestra el reporte guardado localmente como en el diseño', () => {
    const { getByText } = renderScreen();

    expect(getByText('Sin conexión')).toBeTruthy();
    expect(getByText('Guardado localmente')).toBeTruthy();
    expect(getByText('Pendiente de sincronización · hace 2 min')).toBeTruthy();
  });

  it('reintenta la sincronizacion', () => {
    const { getByText, onRetry } = renderScreen();

    fireEvent.press(getByText('Reintentar sincronización'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lleva a mis reportes y al inicio', () => {
    const { getByText, onViewReports, onDone } = renderScreen();

    fireEvent.press(getByText('Ver mis reportes guardados'));
    fireEvent.press(getByText('Volver al inicio'));

    expect(onViewReports).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('oculta mis reportes si no hay a donde ir', () => {
    const { queryByText } = renderScreen({ onViewReports: undefined });

    expect(queryByText('Ver mis reportes guardados')).toBeNull();
  });

  it('desactiva el reintento mientras sincroniza', () => {
    const { queryByText, onRetry, UNSAFE_getAllByType } = renderScreen({ syncing: true });

    expect(queryByText('Reintentar sincronización')).toBeNull();
    expect(onRetry).not.toHaveBeenCalled();
    expect(UNSAFE_getAllByType(require('react-native').ActivityIndicator)).toHaveLength(1);
  });

  it('confirma cuando el reporte ya se envio', () => {
    const { getByText, queryByText } = renderScreen({ item: item({ state: SYNC_STATES.synced }) });

    expect(getByText('Reporte enviado')).toBeTruthy();
    expect(queryByText('Reintentar sincronización')).toBeNull();
  });

  it('no ofrece reintentar lo que hay que corregir', () => {
    const { getByText, queryByText } = renderScreen({
      item: item({ state: SYNC_STATES.error, errorKind: SYNC_ERROR_KINDS.needsCorrection }),
    });

    expect(getByText('No se pudo enviar')).toBeTruthy();
    expect(getByText(/Revísalo y corrígelo/)).toBeTruthy();
    expect(queryByText('Reintentar sincronización')).toBeNull();
  });

  it('maneja un reporte que ya no existe', () => {
    const { getByText, onDone } = renderScreen({ item: null });

    fireEvent.press(getByText('Volver al inicio'));

    expect(getByText('Reporte no encontrado')).toBeTruthy();
    expect(onDone).toHaveBeenCalled();
  });
});
