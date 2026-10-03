import { act, renderHook } from '@testing-library/react-native';

import { loginUser, logoutUser, registerUser } from '../../apis/API_Client';
import { readTokenSubject, useAuth } from '../../hooks/UseAuth';

jest.mock('../../apis/API_Client', () => ({
  loginUser: jest.fn(),
  registerUser: jest.fn(),
  logoutUser: jest.fn(),
}));

function jwt(claims) {
  const encode = (value) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'RS256' })}.${encode(claims)}.firma`;
}

const TOKEN = jwt({ sub: '42', roles: ['USUARIO'] });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('readTokenSubject', () => {
  it('lee el sub del JWT', () => {
    expect(readTokenSubject(TOKEN)).toBe('42');
  });

  it('devuelve null si el token no se puede leer', () => {
    expect(readTokenSubject('no-es-un-jwt')).toBeNull();
    expect(readTokenSubject(jwt({ roles: [] }))).toBeNull();
  });
});

describe('useAuth', () => {
  it('guarda el token y el id del usuario al iniciar sesion', async () => {
    loginUser.mockResolvedValue({ accessToken: TOKEN, tokenType: 'Bearer', expiresIn: 3600 });
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.login({ email: 'ana@correo.mx', password: 'x' }));

    expect(result.current.session).toEqual({ token: TOKEN, userId: '42', email: 'ana@correo.mx' });
    expect(result.current.user).toEqual({ id: '42', email: 'ana@correo.mx' });
  });

  it('tambien inicia sesion al crear la cuenta', async () => {
    registerUser.mockResolvedValue({ accessToken: TOKEN });
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.register({ email: 'ana@correo.mx' }));

    expect(result.current.session.userId).toBe('42');
  });

  it('no crea la cuenta si las contrasenas no coinciden', async () => {
    const { result } = renderHook(() => useAuth());

    await act(() =>
      result.current.register({ email: 'ana@correo.mx', password: 'secreta123', confirmPassword: 'otra' })
    );

    expect(registerUser).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Las contraseñas no coinciden.');
  });

  it('no abre sesion si la respuesta no trae un token valido', async () => {
    loginUser.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAuth());

    let returned;
    await act(async () => {
      returned = await result.current.login({ email: 'ana@correo.mx' });
    });

    expect(returned).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.error).toMatch(/sesión válida/);
  });

  it('muestra el error del servidor', async () => {
    loginUser.mockRejectedValue(new Error('Correo o contraseña incorrectos'));
    const { result } = renderHook(() => useAuth());

    await act(() => result.current.login({ email: 'ana@correo.mx' }));

    expect(result.current.error).toBe('Correo o contraseña incorrectos');
    expect(result.current.user).toBeNull();
  });

  it('cierra sesion enviando el token', async () => {
    loginUser.mockResolvedValue({ accessToken: TOKEN });
    logoutUser.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth());
    await act(() => result.current.login({ email: 'ana@correo.mx' }));

    await act(() => result.current.logout());

    expect(logoutUser).toHaveBeenCalledWith(TOKEN);
    expect(result.current.session).toBeNull();
  });

  it('cierra la sesion local aunque falle el servidor', async () => {
    loginUser.mockResolvedValue({ accessToken: TOKEN });
    logoutUser.mockRejectedValue(new Error('sin red'));
    const { result } = renderHook(() => useAuth());
    await act(() => result.current.login({ email: 'ana@correo.mx' }));

    let returned;
    await act(async () => {
      returned = await result.current.logout();
    });

    expect(returned).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('');
  });
});
