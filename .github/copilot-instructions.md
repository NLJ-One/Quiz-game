# Projet : WeddingQuiz

Projet : "WeddingQuiz", un quiz en direct façon Kahoot pour un mariage (jusqu'à 150 joueurs, surtout sur smartphone). Interface en français.

Stack imposée, SANS exception :
- Front : HTML5, CSS3 et JavaScript vanilla en modules ES (<script type="module">). INTERDIT : React, Vue, jQuery, Tailwind, TypeScript, Webpack/Vite ou tout outil de build. Seules bibliothèques front autorisées, chargées en local (copiées dans /public/vendor) : socket.io-client, et éventuellement qrcode-generator et canvas-confetti.
- Serveur : Node.js 20, Express, Socket.IO, multer pour les uploads. Données en fichiers JSON dans /data. Pas de base de données, pas d'ORM.
- Le dossier /shared contient du JS importable des deux côtés (modules ES) : constantes d'événements, validation du quiz, calcul des scores.

Règles de code :
- Code simple et lisible, fonctions courtes, noms explicites en anglais, textes d'interface en français regroupés dans /shared/texts.fr.js.
- Le serveur est la SEULE source de vérité : score, chrono, bonne réponse. Le client n'envoie jamais de score et ne reçoit jamais la bonne réponse avant la fin de la question.
- Toute donnée reçue (HTTP ou socket) est validée côté serveur avant usage.
- Mobile-first : conçu d'abord pour 360 px de large, puis tablette, puis grand écran projeté.
- CSS : variables CSS (:root) pour toutes les couleurs et polices (changement de thème en un endroit), Flexbox/Grid, clamp() pour les tailles de texte, unités dvh pour la hauteur mobile. Animations uniquement avec transform et opacity. Respecter prefers-reduced-motion.
- Accessibilité : contrastes AA, cibles tactiles ≥ 48 px, ne jamais indiquer une réponse par la couleur seule (ajouter formes/icônes).
- Pas de secrets en dur : variables d'environnement + fichier .env.example.
- Tests avec le module natif node:test pour toute la logique de jeu.
