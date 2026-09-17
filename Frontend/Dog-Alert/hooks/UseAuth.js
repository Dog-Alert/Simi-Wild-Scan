import { useState } from 'react';

import { loginUser, registerUser, logoutUser } from '../apis/API_Client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);

  const login = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const result = await loginUser(payload);
      setResponse(result);
      setUser(result?.user || result || { email: payload.email });
      return result;
    } catch (e) {
      setError(e.message || 'Error al iniciar sesión');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    setError('');

    try {
      const result = await registerUser(payload);
      setResponse(result);
      setUser(result?.user || result || { email: payload.email });
      return result;
    } catch (e) {
      setError(e.message || 'No se pudo crear la cuenta');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError('');

    try {
      await logoutUser();
      setUser(null);
      setResponse(null);
      return true;
    } catch (e) {
      setError(e.message || 'No se pudo cerrar la sesión');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError('');

  return {
    user,
    login,
    register,
    logout,
    loading,
    error,
    response,
    clearError,
  };
}
