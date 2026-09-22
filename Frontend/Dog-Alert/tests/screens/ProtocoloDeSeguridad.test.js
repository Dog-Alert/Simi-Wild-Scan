import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ProtocoloDeSeguridad from '../../screens/ProtocoloDeSeguridad';

describe('ProtocoloDeSeguridad', () => {
  it('renderiza el título y la descripción general del protocolo', () => {
    const { getByText } = render(<ProtocoloDeSeguridad onBack={jest.fn()} />);

    expect(getByText('Protocolos de seguridad')).toBeTruthy();
    expect(
      getByText(/Si encuentras perros en situación de calle o peligrosa/i)
    ).toBeTruthy();
  });

  it('muestra los protocolos principales de seguridad', () => {
    const { getByText } = render(<ProtocoloDeSeguridad onBack={jest.fn()} />);

    expect(getByText('No te acerques')).toBeTruthy();
    expect(getByText('No lo persigas')).toBeTruthy();
    expect(getByText('No hagas movimientos bruscos')).toBeTruthy();
  });

  it('llama a onBack cuando se presiona el botón de regreso', () => {
    const onBack = jest.fn();
    const { getByText } = render(<ProtocoloDeSeguridad onBack={onBack} />);

    fireEvent.press(getByText('←'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
