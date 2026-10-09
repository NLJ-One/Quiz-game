import { apiFetch } from '../config.js';

const TOKEN_KEY = 'weddingquiz.hostToken';

export async function login(password) {
  const response = await apiFetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const { token } = await response.json();
  if (typeof token !== 'string' || !token) {
    throw new Error('Le serveur a renvoyé un jeton de connexion invalide.');
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}
