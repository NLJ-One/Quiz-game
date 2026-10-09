import '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { ANIMAL_AVATARS, normalizeAvatarIndex } from '/shared/avatars.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';

const PLAYER_SESSION_KEY = 'weddingquiz.playerSession';
const code = new URLSearchParams(location.search).get('code') || '';
const status = document.querySelector('#play-status');
const codeElement = document.querySelector('#play-code');
const title = document.querySelector('#play-title');
const avatar = document.querySelector('#play-avatar');

applyTheme(WEDDING_CONFIG);
renderHeader();
status.textContent = TEXTS.loading;

let session;
try {
  session = JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) || 'null');
} catch (error) {
  console.error('La session joueur enregistrée est illisible.', error);
}

if (!/^\d{6}$/.test(code) || !session || session.code !== code || typeof session.token !== 'string' || !session.token) {
  status.textContent = TEXTS.playerTokenInvalid;
  title.textContent = 'Rejoignez la partie';
  location.replace(`/join.html${/^\d{6}$/.test(code) ? `?code=${encodeURIComponent(code)}` : ''}`);
} else {
  codeElement.textContent = code;
  avatar.textContent = ANIMAL_AVATARS[normalizeAvatarIndex(session.avatarIndex)];
  title.textContent = `Bienvenue, ${session.pseudo} !`;
  status.textContent = 'Vous êtes dans la salle. La partie commencera bientôt.';
}
