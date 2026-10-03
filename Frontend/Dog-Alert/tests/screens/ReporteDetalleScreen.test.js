import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import ReporteDetalleScreen from '../../screens/ReporteDetalleScreen';

const ENTRY = {
  key: 'server:1',
  source: 'server',
  eventType: 'ATTACK_PET',
  eventAt: '2026-10-05T18:00:00.000Z',
  status: { tone: 'verified', label: 'Verificado' },
  photoUri: null,
  item: null,
  report: {
    id: 1,
    severity: 'HIGH',
    dogCount: 4,
    size: 'LARGE',
    description: 'Grupo de perros grandes sin collar.',
    exactLocation: { latitude: 27.7506615, longitude: -107.6359927 },
  },
};

describe('ReporteDetalleScreen', () => {
  it('muestra el detalle como en el diseño', () => {
    const { getByText } = render(<ReporteDetalleScreen entry={ENTRY} onBack={jest.fn()} />);

    expect(getByText('Ataque a mascota')).toBeTruthy();
    expect(getByText('Verificado')).toBeTruthy();
    expect(getByText('Alta')).toBeTruthy();
    expect(getByText('4+')).toBeTruthy();
    expect(getByText('Grande')).toBeTruthy();
    expect(getByText('"Grupo de perros grandes sin collar."')).toBeTruthy();
    expect(getByText(/^Reportado el/)).toBeTruthy();
  });

  it('no muestra las coordenadas exactas', () => {
    const { queryByText } = render(<ReporteDetalleScreen entry={ENTRY} onBack={jest.fn()} />);

    expect(queryByText(/27\.75/)).toBeNull();
    expect(queryByText(/-107\.63/)).toBeNull();
  });

  it('muestra solo las acciones que recibe', () => {
    const { queryByText, rerender } = render(
      <ReporteDetalleScreen entry={ENTRY} onBack={jest.fn()} />
    );
    expect(queryByText('Editar')).toBeNull();
    expect(queryByText('Eliminar')).toBeNull();
    expect(queryByText('Reintentar sincronización')).toBeNull();

    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onRetry = jest.fn();
    rerender(
      <ReporteDetalleScreen
        entry={ENTRY}
        onBack={jest.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onRetry={onRetry}
      />
    );
    fireEvent.press(queryByText('Editar'));
    fireEvent.press(queryByText('Eliminar'));
    fireEvent.press(queryByText('Reintentar sincronización'));

    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });

  it('avisa si el reporte ya no existe', () => {
    const onBack = jest.fn();
    const { getByText } = render(<ReporteDetalleScreen entry={null} onBack={onBack} />);

    fireEvent.press(getByText('Volver a mis reportes'));

    expect(getByText('Este reporte ya no existe.')).toBeTruthy();
    expect(onBack).toHaveBeenCalled();
  });
});
