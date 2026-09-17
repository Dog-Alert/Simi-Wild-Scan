import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import InicioScreen from '../../screens/InicioScreen';

describe('InicioScreen', () => {
  it('renderiza el nombre de la app y la descripción', () => {
    const { getByText } = render(<InicioScreen onStart={jest.fn()} onAnonymous={jest.fn()} />);

    expect(getByText('DogAlert')).toBeTruthy();
    expect(
      getByText(/Reporta, localiza y protege tu comunidad/i)
    ).toBeTruthy();
  });

  it('llama a onStart cuando se presiona Empezar', () => {
    const onStart = jest.fn();
    const { getByText } = render(
      <InicioScreen onStart={onStart} onAnonymous={jest.fn()} />
    );

    fireEvent.press(getByText('Empezar'));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('llama a onAnonymous cuando se presiona el reporte anónimo', () => {
    const onAnonymous = jest.fn();
    const { getByText } = render(
      <InicioScreen onStart={jest.fn()} onAnonymous={onAnonymous} />
    );

    fireEvent.press(getByText(/Continuar como anónimo/i));

    expect(onAnonymous).toHaveBeenCalledTimes(1);
  });
});
