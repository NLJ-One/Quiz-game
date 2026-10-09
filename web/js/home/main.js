import '/js/config.js';
import { TEXTS } from '/shared/texts.fr.js';
import { WEDDING_CONFIG } from '/js/wedding.config.js';
import { renderHeader } from '/js/shared/header.js';
import { applyTheme } from '/js/shared/theme.js';

document.title = `${TEXTS.appTitle} — ${WEDDING_CONFIG.coupleNames}`;
applyTheme(WEDDING_CONFIG);
renderHeader();
