// En dev, Vite proxy /api et /socket.io vers le serveur Node.
// Si le front est hébergé ailleurs (ex. Vercel), définir VITE_API_URL=https://mon-api.onrender.com
const BASE = import.meta.env.VITE_API_URL || '';

export const socketUrl = BASE || undefined;

export async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'request_failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

// Téléchargement de fichiers protégés (export CSV)
export async function apiBlob(path, { token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = new Error('request_failed');
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export const storage = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // stockage indisponible (navigation privée) : on ignore
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
