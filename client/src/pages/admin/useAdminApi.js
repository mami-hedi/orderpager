import { useCallback } from 'react';
import { api } from '../../api.js';

// Appel API authentifié ; déconnecte automatiquement si le jeton a expiré (401)
export function useAdminApi(token, onLogout) {
  return useCallback(
    async (path, options = {}) => {
      try {
        return await api(path, { ...options, token });
      } catch (err) {
        if (err.status === 401) onLogout();
        throw err;
      }
    },
    [token, onLogout],
  );
}
