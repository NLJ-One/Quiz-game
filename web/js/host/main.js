import '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';

const code = new URLSearchParams(location.search).get('code') || '';
const hostCode = document.querySelector('#host-code');
const status = document.querySelector('#host-status');

applyTheme(WEDDING_CONFIG);
renderHeader();

if (new URLSearchParams(location.search).get('seed') === 'chloe-gilles') {
  import('/js/wedding/host.js')
    .then(({ mountWeddingHost }) => mountWeddingHost())
    .catch((error) => {
      status.textContent = error.message || 'Impossible de charger la salle organisateur.';
      status.classList.add('error-message');
    });
} else if (!/^\d{6}$/.test(code)) {
  status.textContent = 'Aucune salle n’a été sélectionnée.';
  location.replace('/editor.html');
} else {
  hostCode.textContent = code;
  status.textContent = TEXTS.loading;
  requestAnimationFrame(() => {
    status.textContent = 'La salle est prête à accueillir les invités.';
  });
}
