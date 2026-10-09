# Projet : WeddingQuiz

WeddingQuiz est un quiz en direct pour un mariage, jusqu'à 150 joueurs, principalement sur smartphone. L'interface est en français.

## Architecture imposée

Le site et le serveur temps réel sont déployés séparément.

- `/web` est le site statique publié tel quel par Netlify, sans commande ni étape de build. Il contient `index.html`, `join.html`, `play.html`, `host.html`, `editor.html`, ainsi que `css`, `js`, `assets`, `vendor`, `shared` et `data`.
- `/server` contient le serveur Node.js 20, Express et Socket.IO, hébergé séparément sur Render, Railway ou Fly. En production, il ne sert aucune page web : uniquement le WebSocket et les routes API. En développement, il peut servir `/web` pour permettre `npm run dev` sur `http://localhost:3000`.
- `/web/shared` contient des modules JavaScript ES importés par le navigateur et par le serveur via `../web/shared/`: protocole, validation, textes français et calcul des scores.
- Les quiz sont stockés uniquement dans le navigateur de l'organisateur (`localStorage`), avec import/export JSON. Le serveur conserve les parties en mémoire et reçoit le quiz complet uniquement à la création de partie.
- Les photos versionnées sont placées dans `/web/assets/photos` et servies par le CDN Netlify. Les quiz peuvent les référencer par chemin ou URL.

## Technologies et règles

- Front : HTML5, CSS3 et JavaScript vanilla en modules ES (`<script type="module">`). Interdits : React, Vue, jQuery, Tailwind, TypeScript, Webpack/Vite et tout outil de build. Les bibliothèques autorisées sont copiées dans `/web/vendor` (Socket.IO client, éventuellement QR code et confettis).
- Serveur : Node.js 20, Express, Socket.IO, CORS et dotenv. Pas de base de données ni de stockage persistant.
- Aucune URL du serveur n'est dispersée dans le code. `/web/js/config.js` exporte `API_URL` et `apiFetch()`. En local, l'API est `http://localhost:3000`; en production, modifier `PROD_API_URL`.
- Le serveur est la seule source de vérité pour score, chronomètre et bonnes réponses. Le client n'envoie jamais de score et ne reçoit pas la bonne réponse avant la fin de la question.
- Toute donnée HTTP ou Socket.IO entrante est validée côté serveur. CORS accepte uniquement les origines de `CLIENT_ORIGINS`.
- Pas de cookies : le host s'authentifie avec un jeton signé HMAC-SHA256 via `Authorization: Bearer` et le handshake Socket.IO.
- Aucun quiz n'est stocké côté serveur. Ne pas ajouter de route d'upload ni d'écriture sur disque.
- Code simple et lisible, fonctions courtes, noms explicites en anglais. Les textes d'interface sont en français et regroupés dans `/web/shared/texts.fr.js`.
- Mobile-first à partir de 360 px, puis tablette et grand écran de projection.
- CSS : variables `:root`, Flexbox/Grid, `clamp()` pour les tailles de texte et unités `dvh`. Animations limitées à `transform` et `opacity`; respecter `prefers-reduced-motion`.
- Accessibilité : contraste AA, cibles tactiles d'au moins 48 px, et jamais de réponse indiquée par la couleur seule.
- Pas de secrets en dur : variables d'environnement et `.env.example`.
- Tester la logique de jeu avec le module natif `node:test`.

## Direction artistique

- Utiliser par défaut le thème `vert` (`data-theme="vert"`) et définir la palette dans `/web/css/theme.css` : `--green-950 #052e1f`, `--green-900 #0a3d2a`, `--green-800 #0f5132`, `--green-700 #146c43`, `--green-600 #198754`, `--green-500 #22a06b`, `--green-400 #4cc38a`, `--green-300 #86e0b0`, `--lime #b7f34d`, `--white`, `--gold #f4c430`, `--silver #c0c7cf`, `--bronze #d9822b`. Conserver les thèmes de mariage existants disponibles.
- Fond des écrans de jeu : `linear-gradient(135deg, #0b6b3a 0%, #064e2b 55%, #033a20 100%)`, avec 2 à 3 grandes formes translucides CSS (blanc 4 à 8 %) et, pour le classement, des facettes triangulaires discrètes. Aucun arrière-plan image pour ces écrans.
- Employer Montserrat (graisses 500/700/800) pour l’interface. Le wordmark est constitué uniquement des prénoms configurés des mariés, en blanc avec la police de titre du mariage. Ne jamais reprendre le nom, le logo ou les personnages d’une marque existante.
- Utiliser des cartes blanches nettes, coins de 6 px, contraste AA et relief bas sur les boutons. L’entrée joueur est une carte centrée d’environ 400 px (95 % mobile) en deux étapes : code numérique sur 6 chiffres, puis pseudo et choix d’avatar dans la même carte.
- Les questions ont une boîte blanche centrée et lisible, une image éventuelle dans un cadre blanc, un compte à rebours chiffré avec barre lime/orange/rouge, puis quatre grandes réponses à relief : émeraude `#22a06b` triangle, lime foncé `#7fb800` losange, teal `#0f8b8d` cercle, sapin `#146c43` carré. Montrer coche/croix après réponse, et un histogramme animé côté hôte.
- Le classement principal utilise des lignes arrondies d’environ 64 px, largeur 75 %, espacées de 14 px : première ligne blanche, suivantes vert profond. Montrer avatar, pseudo, score et variation de rang ; animer le réordonnancement FLIP en 600 ms, le compteur et l’éclat lime. Le Top 5 hôte n’apparaît que sur grand écran (>1280 px). La ligne du joueur reste visible et surlignée sur mobile.
- Le podium final suit l’ordre 2–1–3, avec la première place au centre et la plus haute, colonnes vertes, médailles pentagonales or/argent/bronze et liste des autres joueurs. Révéler 3e, 2e, puis 1er ; confettis locaux avec palette vert/lime/or/blanc/corail. Respecter `prefers-reduced-motion` et le mode économie. Sur téléphone, empiler les places dans l’ordre 2–1–3 et montrer rang/score du joueur.
- Les avatars sont exclusivement les 40 emojis d’animaux de `/web/shared/avatars.js`, avec fond clair ; transmettre `avatarIndex` dans `hello` et les résultats publics hôte. Ne jamais utiliser d’image d’avatar.
- Le bandeau hôte reste sombre, haut de 56 px, avec navigation de question à gauche, code de salle au centre et commandes son/réglages/plein écran à droite. Les composants réutilisables sont `.join-card`, `.question-box`, `.answer`, `.time-bar`, `.scoreboard`, `.scoreboard-row`, `.podium`, `.medal` et `.bottom-bar` ; éviter les styles inline.
- Concevoir mobile-first dès 360 px, puis tablette et projection 16:9. `/web/dev-components.html` présente les composants et jusqu’à 100 joueurs factices. Les animations utilisent uniquement `transform` et `opacity`, restent limitées à 12 éléments simultanés, et respectent `prefers-reduced-motion`.
