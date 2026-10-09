import { WEDDING_CONFIG } from '/js/wedding.config.js';

const THEMES = new Set(['romantique', 'champetre', 'dore', 'minimal']);

export function applyTheme(theme) {
  const requestedTheme = typeof theme === 'string'
    ? theme
    : theme?.theme || theme?.settings?.theme || theme?.settings?.weddingTheme;
  const normalizedTheme = String(requestedTheme || WEDDING_CONFIG.theme).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const selectedTheme = THEMES.has(normalizedTheme) ? normalizedTheme : WEDDING_CONFIG.theme;
  document.documentElement.dataset.theme = selectedTheme;
  return selectedTheme;
}
