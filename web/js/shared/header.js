import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { TEXTS } from '/shared/texts.fr.js';

export function renderHeader() {
  const header = document.createElement('header');
  header.className = 'site-header';

  const brand = document.createElement('a');
  brand.className = 'site-brand';
  brand.href = '/index.html';
  brand.textContent = WEDDING_CONFIG.coupleNames;
  brand.setAttribute('aria-label', `${WEDDING_CONFIG.coupleNames} — accueil`);

  const homeLink = document.createElement('a');
  homeLink.className = 'site-home';
  homeLink.href = '/index.html';
  homeLink.textContent = TEXTS.homeLink;

  header.append(brand, homeLink);
  document.body.prepend(header);
}
