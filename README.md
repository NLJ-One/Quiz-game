# WeddingQuiz

Quiz de mariage en direct, avec un site statique Netlify et un serveur Socket.IO déployé séparément.

## Lancer en local

1. Installer Node.js 20, puis exécuter `npm install`.
2. Copier `.env.example` vers `.env` et renseigner `HOST_PASSWORD` (au moins 12 caractères) ainsi qu'un secret aléatoire fort pour `SESSION_SECRET`.
3. Exécuter `npm run dev`, puis ouvrir <http://localhost:3000>.
4. Lancer les tests avec `npm test`.

En production, le serveur n'expose aucun fichier du site. Le dossier `/web` fonctionne indépendamment et est publié tel quel par Netlify.

## Quiz et images

Les quiz sont sauvegardés dans le navigateur via `localStorage`. Utilise les fonctions d'import/export JSON pour en conserver une copie; aucun quiz n'est envoyé au serveur avant la création d'une partie.

Ajoute les photos dans `web/assets/photos/`, puis renseigne leurs chemins dans `web/data/photos.json` au format tableau JSON. Les quiz peuvent aussi référencer une URL d'image. Le module `web/js/shared/image.js` exporte `resizeImage(file)` pour réduire une image à 1280 px maximum et la convertir en WebP.

Pour régénérer automatiquement `photos.json` après avoir ajouté ou retiré des fichiers, exécute `node scripts/list-photos.js`.

## Mise en ligne pas à pas

1. Pousse le dépôt sur GitHub.
2. Connecte le dépôt à Netlify et choisis `web` comme répertoire de publication. Aucune commande de build n'est nécessaire.
3. Crée un service web Node sur Render à partir du même dépôt. Render peut utiliser `render.yaml`; configure `HOST_PASSWORD` et `SESSION_SECRET` comme secrets, puis définis `CLIENT_ORIGINS` avec le domaine Netlify exact.
4. Copie l'URL du service Render dans `PROD_API_URL` de `web/js/config.js` et remplace également le domaine d'exemple dans la CSP de `netlify.toml`.
5. Configure `CLIENT_ORIGINS` avec le domaine Netlify exact (et le domaine personnalisé le cas échéant). N'utilise pas de joker.
6. Vérifie `https://<serveur>/health`, puis teste connexion host, création de partie et connexion Socket.IO depuis le domaine Netlify.

## Jour J

- Les hébergeurs gratuits peuvent mettre le serveur en veille après environ 15 minutes d'inactivité; le premier réveil peut prendre 30 à 60 secondes. Ouvre `/health` environ 10 minutes avant l'arrivée des invités. UptimeRobot ou un service équivalent peut ping `/health` toutes les 5 minutes pendant la soirée.
- Option recommandée pour la soirée : utiliser pendant un mois l'offre payante la moins chère du serveur pour éviter la veille et bénéficier de davantage de CPU.
- Teste le système 24 h avant avec `npm run loadtest -- --url https://<serveur>.onrender.com --players 100 --duration 60`, en fournissant `HOST_PASSWORD` dans l'environnement. Le test crée une partie de test conservée en mémoire jusqu'au redémarrage du serveur et connecte des clients Socket.IO; vérifie le Wi-Fi et la 4G de la salle, imprime le QR code et le code de secours sur chaque table, et exporte le quiz en JSON.
- Prévois un plan B si la connexion tombe : relancer une partie et exporter les scores lorsque les écrans de jeu seront implémentés.

## État actuel

L'architecture de déploiement, les bases de validation, d'authentification et de stockage local sont en place. Les pages `host.html`, `play.html` et `editor.html` restent des squelettes; les interactions de jeu, l'éditeur complet et le service worker restent à implémenter. Le test de charge valide la disponibilité HTTP et les connexions Socket.IO, pas encore les scénarios complets d'une partie.
