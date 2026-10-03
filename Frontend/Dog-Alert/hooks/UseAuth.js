import { useState } from 'react';

import { loginUser, registerUser, logoutUser } from '../apis/API_Client';

export function readTokenSubject(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const { sub } = JSON.parse(atob(padded));
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

// El token vive solo en memoria: cerrar la app cierra la sesion.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);

  const startSession = (result, email) => {
    const token = result && result.accessToken;
    const userId = token ? readTokenSubject(token) : null;

    if (!userId) {
      throw new Error('El servidor no devolvió una sesión válida.');
    }

    setSession({ token, userId, email });
    setResponse(result);
    return result;
  };

  const authenticate = async (request, payload, fallbackMessage) => {
    setLoading(true);
    setError('');

    try {
      return startSession(await request(payload), payload.email);
    } catch (e) {
      setError(e.message || fallbackMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = (payload) => authenticate(loginUser, payload, 'Error al iniciar sesión');

  const register = (payload) => {
    if (payload.confirmPassword !== undefined && payload.confirmPassword !== payload.password) {
      setError('Las contraseñas no coinciden.');
      return Promise.resolve(null);
    }

    return authenticate(registerUser, payload, 'No se pudo crear la cuenta');
  };

  // El JWT no tiene estado en el servidor: la sesion local se cierra aunque falle la llamada.
  const logout = async () => {
    setLoading(true);
    setError('');

    if (session) {
      await logoutUser(session.token).catch(() => null);
    }

    setSession(null);
    setResponse(null);
    setLoading(false);
    return true;
  };

  const clearError = () => setError('');

  return {
    user: session ? { id: session.userId, email: session.email } : null,
    session,
    login,
    register,
    logout,
    loading,
    error,
    response,
    clearError,
  };
}
