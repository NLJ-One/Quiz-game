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

## Quiz préenregistré Chloé et Gilles (Supabase)

Le quiz **Connaissez vous vraiment Chloé et Gilles** est inclus automatiquement dans l'espace organisateur. Ses 15 questions et leurs réponses sont installées par la migration Supabase; aucune création dans l'éditeur n'est nécessaire. Ce parcours utilise Supabase Auth, Postgres et Realtime depuis le site statique Netlify et ne nécessite pas de serveur Node permanent.

### Configuration Supabase

1. Crée un projet Supabase et un compte Auth pour le créateur. Désactive l'inscription publique des utilisateurs une fois ce compte créé.
2. Applique les deux fichiers `supabase/migrations/` dans l'ordre de leur nom. Avec Supabase CLI, applique le dossier des migrations; dans le SQL Editor, exécute les deux fichiers dans l'ordre.
3. Dans Supabase Auth, récupère l'UUID du compte créateur. Exécute le `UPDATE private.wedding_quiz_owner` commenté à la fin de la migration en remplaçant `UUID-DU-COMPTE-AUTH` par cet UUID.
4. Renseigne l'URL du projet et sa clé anon/publishable dans `web/js/supabase.config.js`. Ces deux valeurs sont publiques côté navigateur; n'y place jamais la clé `service_role`, un mot de passe ni un secret de base de données.
5. Déploie `web` sur Netlify comme ci-dessus. Les règles CSP de `netlify.toml` autorisent le client Supabase et ses connexions Realtime; vérifie qu'elles restent présentes si la CSP est gérée ailleurs.
6. Connecte-toi à `/editor.html` avec le compte du créateur et sélectionne la carte du quiz. Le RPC sécurisé prépare ou réutilise la session et son code; ouvre ensuite la salle et clique sur « Lancer la partie ».
7. Les invités ouvrent `/join.html`, saisissent le code affiché par l'organisateur et leur pseudo. Leur écran attend le lancement et reçoit les questions et transitions par Supabase.

Les changements d'état de la session, les réponses et les scores passent par `wedding_quiz_action`, une fonction `SECURITY DEFINER` qui vérifie l'identité Auth et le propriétaire enregistré. L'accès direct aux tables est révoqué; les réponses correctes sont conservées dans un schéma privé et ne sont fournies aux invités qu'une fois la question close. La base applique aussi l'unicité des pseudos, l'unicité de la réponse par joueur et question, les transitions de session et le calcul du score.

Le compte créateur, l'affectation de son UUID et l'application de la migration sont indispensables avant utilisation. Le parcours existant des quiz personnalisés reste distinct et conserve son serveur Render et son authentification actuels. `npm test` comprend des tests statiques sur les questions seedées, les paramètres et les contrôles SQL; l'intégration réelle doit être vérifiée dans le projet Supabase après sa configuration.

## Jour J

- Les hébergeurs gratuits peuvent mettre le serveur en veille après environ 15 minutes d'inactivité; le premier réveil peut prendre 30 à 60 secondes. Ouvre `/health` environ 10 minutes avant l'arrivée des invités. UptimeRobot ou un service équivalent peut ping `/health` toutes les 5 minutes pendant la soirée.
- Option recommandée pour la soirée : utiliser pendant un mois l'offre payante la moins chère du serveur pour éviter la veille et bénéficier de davantage de CPU.
- Teste le système 24 h avant avec `npm run loadtest -- --url https://<serveur>.onrender.com --players 100 --duration 60`, en fournissant `HOST_PASSWORD` dans l'environnement. Le test crée une partie de test conservée en mémoire jusqu'au redémarrage du serveur et connecte des clients Socket.IO; vérifie le Wi-Fi et la 4G de la salle, imprime le QR code et le code de secours sur chaque table, et exporte le quiz en JSON.
- Prévois un plan B si la connexion tombe : relancer la session depuis l'espace organisateur après rétablissement de la connexion. Les scores de la session Supabase ne sont pas encore exportables depuis l'interface.

## Vérification

Exécute `npm test` pour lancer les tests Node. Le quiz préenregistré utilise la migration Supabase et ses interfaces de salle d'attente, de jeu, de commande organisateur, de chronomètre et de classement. La migration n'a pas été appliquée à un projet distant dans ce dépôt; suis les étapes de configuration avant le premier essai en production.
