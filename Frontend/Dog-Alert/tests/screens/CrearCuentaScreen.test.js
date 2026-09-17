import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import CrearCuentaScreen from '../../screens/CrearCuentaScreen';

describe('CrearCuentaScreen', () => {
  it('renderiza el formulario de creación con los campos requeridos', () => {
    const { getAllByText, getByPlaceholderText } = render(
      <CrearCuentaScreen onBack={jest.fn()} onCreate={jest.fn()} />
    );

    expect(getAllByText('Crear cuenta').length).toBeGreaterThan(0);
    expect(getByPlaceholderText('Nombre completo')).toBeTruthy();
    expect(getByPlaceholderText('Correo electrónico')).toBeTruthy();
    expect(getByPlaceholderText('Contraseña')).toBeTruthy();
    expect(getByPlaceholderText('Confirmar contraseña')).toBeTruthy();
  });

  it('actualiza los campos del formulario y llama a onCreate con los valores', () => {
    const onCreate = jest.fn();
    const { getByPlaceholderText, getAllByText } = render(
      <CrearCuentaScreen onBack={jest.fn()} onCreate={onCreate} />
    );

    fireEvent.changeText(getByPlaceholderText('Nombre completo'), 'Ana Gomez');
    fireEvent.changeText(getByPlaceholderText('Correo electrónico'), 'ana@correo.com');
    fireEvent.changeText(getByPlaceholderText('Contraseña'), '123456');
    fireEvent.changeText(getByPlaceholderText('Confirmar contraseña'), '123456');

    const createButtons = getAllByText('Crear cuenta');
    fireEvent.press(createButtons[createButtons.length - 1]);

    expect(onCreate).toHaveBeenCalledWith({
      fullName: 'Ana Gomez',
      email: 'ana@correo.com',
      password: '123456',
      confirmPassword: '123456',
      adult: false,
      terms: false,
    });
  });

  it('llama a onBack cuando se presiona el botón de regreso', () => {
    const onBack = jest.fn();
    const { getByText } = render(
      <CrearCuentaScreen onBack={onBack} onCreate={jest.fn()} />
    );

    fireEvent.press(getByText('←'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
