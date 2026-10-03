import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import MisReportesScreen from '../../screens/MisReportesScreen';

const LOCAL = {
  key: 'local:a',
  source: 'local',
  eventType: 'SIGHTING',
  eventAt: '2026-10-10T18:00:00.000Z',
  status: { tone: 'local', label: 'Guardado localmente' },
  photoUri: 'file:///documents/outbox/photos/a.jpg',
};

const SERVER = {
  key: 'server:1',
  source: 'server',
  eventType: 'ATTACK_PET',
  eventAt: '2026-10-05T18:00:00.000Z',
  status: { tone: 'verified', label: 'Verificado' },
  photoUri: null,
};

function renderScreen(props = {}) {
  const handlers = {
    onRefresh: jest.fn(),
    onLoadMore: jest.fn(),
    onOpen: jest.fn(),
    onBack: jest.fn(),
  };
  const screen = render(
    <MisReportesScreen entries={[LOCAL, SERVER]} signedIn {...handlers} {...props} />
  );
  return { ...screen, ...handlers };
}

describe('MisReportesScreen', () => {
  it('lista los reportes con tipo, fecha y estado', () => {
    const { getByText } = renderScreen();

    expect(getByText('Mis reportes')).toBeTruthy();
    expect(getByText('Avistamiento')).toBeTruthy();
    expect(getByText('Guardado localmente')).toBeTruthy();
    expect(getByText('Ataque a mascota')).toBeTruthy();
    expect(getByText('Verificado')).toBeTruthy();
  });

  it('abre el detalle al tocar un reporte', () => {
    const { getByTestId, onOpen } = renderScreen();

    fireEvent.press(getByTestId('report-row-server:1'));

    expect(onOpen).toHaveBeenCalledWith(SERVER);
  });

  it('muestra un mensaje si no hay reportes', () => {
    const { getByText } = renderScreen({ entries: [] });

    expect(getByText('Aún no tienes reportes.')).toBeTruthy();
  });

  it('invita a iniciar sesion si no hay cuenta', () => {
    const { getByText } = renderScreen({ signedIn: false });

    expect(getByText(/Inicia sesión para ver también/)).toBeTruthy();
  });

  it('muestra el error de carga', () => {
    const { getByText } = renderScreen({ error: 'No se pudo conectar con el servidor.' });

    expect(getByText('No se pudo conectar con el servidor.')).toBeTruthy();
  });

  it('carga mas solo cuando hay otra pagina', () => {
    const { queryByText, rerender, onLoadMore, onRefresh, onOpen, onBack } = renderScreen();
    expect(queryByText('Cargar más')).toBeNull();

    rerender(
      <MisReportesScreen
        entries={[SERVER]}
        signedIn
        hasMore
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        onOpen={onOpen}
        onBack={onBack}
      />
    );
    fireEvent.press(queryByText('Cargar más'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('regresa', () => {
    const { getByText, onBack } = renderScreen();

    fireEvent.press(getByText('←'));

    expect(onBack).toHaveBeenCalled();
  });
});
