import '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';

const PLAYER_SESSION_KEY = 'weddingquiz.playerSession';
const form = document.querySelector('#join-form');
const status = document.querySelector('#join-status');
const codeInput = document.querySelector('#room-code');

applyTheme(WEDDING_CONFIG);
renderHeader();

const requestedCode = new URLSearchParams(location.search).get('code');
if (requestedCode) codeInput.value = requestedCode.replace(/\D/g, '').slice(0, 6);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();
  const pseudo = String(new FormData(form).get('pseudo') || '').trim();

  if (!/^\d{6}$/.test(code)) {
    status.textContent = TEXTS.roomCodeInvalid;
    status.classList.add('error-message');
    codeInput.focus();
    return;
  }
  if (pseudo.length < 2 || pseudo.length > 20) {
    status.textContent = TEXTS.nicknameInvalid;
    status.classList.add('error-message');
    form.elements.pseudo.focus();
    return;
  }

  const token = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ code, pseudo, token }));
  status.classList.remove('error-message');
  status.textContent = TEXTS.loading;
  location.assign(`/play.html?code=${encodeURIComponent(code)}`);
});
