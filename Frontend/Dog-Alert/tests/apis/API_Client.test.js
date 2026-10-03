import { loginUser, logoutUser, registerUser } from '../../apis/API_Client';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const TOKEN = { accessToken: 'jwt', tokenType: 'Bearer', expiresIn: 3600 };

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('autenticacion', () => {
  it('inicia sesion en /v1/auth/login', async () => {
    fetch.mockResolvedValue(jsonResponse(200, TOKEN));

    const result = await loginUser({ email: 'a@b.mx', password: 'secreta123' });

    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/auth\/login$/);
    expect(result).toEqual(TOKEN);
  });

  it('crea la cuenta en /v1/auth/register', async () => {
    fetch.mockResolvedValue(jsonResponse(201, TOKEN));

    await registerUser({ email: 'a@b.mx' });

    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/auth\/register$/);
  });

  it('cierra sesion en /v1/auth/logout con el token', async () => {
    fetch.mockResolvedValue({ status: 204, ok: true, headers: { get: () => null } });

    await logoutUser('jwt');

    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/auth\/logout$/);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
  });

  it('muestra el mensaje del sobre de error del backend', async () => {
    fetch.mockResolvedValue(
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' } })
    );

    await expect(loginUser({})).rejects.toThrow('Correo o contraseña incorrectos');
  });

  it('usa el mensaje por defecto si la respuesta no es JSON', async () => {
    fetch.mockResolvedValue({ status: 502, ok: false, headers: { get: () => 'text/html' }, text: async () => '<html>' });

    await expect(loginUser({})).rejects.toThrow('Credenciales inválidas');
  });
});
