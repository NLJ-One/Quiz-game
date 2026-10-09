const PROD_API_URL = 'https://your-server.onrender.com';

const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_URL = isLocalhost ? 'http://localhost:3000' : PROD_API_URL;

export async function apiFetch(path, options = {}) {
  const url = new URL(path, `${API_URL}/`);
  if (url.origin !== new URL(API_URL).origin) {
    throw new Error('Les requêtes API doivent rester sur le serveur configuré.');
  }

  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('weddingquiz.hostToken');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (error) {
    throw new Error('Impossible de joindre le serveur. Vérifie ta connexion.', { cause: error });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = Array.isArray(payload.error) ? payload.error.join(' ') : payload.error;
    throw new Error(message || `Erreur serveur (${response.status}).`);
  }
  return response;
}
