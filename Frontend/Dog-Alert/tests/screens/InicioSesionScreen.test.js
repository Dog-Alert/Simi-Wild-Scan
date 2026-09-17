import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import IniciarSesionScreen from '../../screens/InicioSesionScreen';

describe('IniciarSesionScreen', () => {
  it('renderiza la pantalla de inicio de sesión con los campos principales', () => {
    const { getByText, getAllByText, getByPlaceholderText } = render(
      <IniciarSesionScreen
        onBack={jest.fn()}
        onCreateAccount={jest.fn()}
        onLogin={jest.fn()}
      />
    );

    expect(getByText('DogAlert')).toBeTruthy();
    expect(getAllByText('Iniciar sesión').length).toBeGreaterThan(0);
    expect(getByPlaceholderText('usuario@correo.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('actualiza email y contraseña y llama a onLogin con los datos', () => {
    const onLogin = jest.fn();
    const { getByPlaceholderText, getAllByText } = render(
      <IniciarSesionScreen
        onBack={jest.fn()}
        onCreateAccount={jest.fn()}
        onLogin={onLogin}
      />
    );

    fireEvent.changeText(getByPlaceholderText('usuario@correo.com'), 'usuario@correo.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), '123456');

    const loginButtons = getAllByText('Iniciar sesión');
    fireEvent.press(loginButtons[loginButtons.length - 1]);

    expect(onLogin).toHaveBeenCalledWith({
      email: 'usuario@correo.com',
      password: '123456',
    });
  });

  it('llama a onCreateAccount cuando se presiona Crear cuenta', () => {
    const onCreateAccount = jest.fn();
    const { getByText } = render(
      <IniciarSesionScreen
        onBack={jest.fn()}
        onCreateAccount={onCreateAccount}
        onLogin={jest.fn()}
      />
    );

    fireEvent.press(getByText('Crear cuenta'));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });
});
