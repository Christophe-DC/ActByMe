# ACTBYME Director — compte rendu de vérification

Date : 19 octobre 2026. Ce compte rendu décrit la validation locale précédant la publication. Le déploiement de production intervenu ensuite est suivi dans [production-release.md](production-release.md). Aucune génération vidéo facturable n’a été effectuée.

## Intégration livrée

- Entrée **Director** dans la navigation principale, l’accueil et les projets. Routes `/director`, `/director/demo`, `/director/:id`, avec le projet de démonstration **The Coastal House** clairement identifié.
- Espaces **Plan**, **Direct**, **Perform**, **Generate** ; treize modèles de plans ; éditeur de caméra 3D et carte avec waypoints déplaçables, timings, cibles, focale, suivi de personnage et vue libre.
- Timeline à six pistes, lecture synchronisée, réorganisation, découpe, copie/collage, duplication, redimensionnement, réglages audio, coupes/fondus au noir, annulation/rétablissement.
- Import privé avec droits déclarés, inspection réelle des fichiers, réutilisation du catalogue d’acteurs et des prises QA du workflow existant, autorisations explicites acceptables/révocables par l’acteur.
- Sauvegarde versionnée, historique, restauration, récupération des brouillons et protection des conflits ; contrôle propriétaire dans l’API et RLS sur les nouvelles tables.
- Export du dossier de production JSON, import et remplacement individuel des clips, assemblage MP4 H.264/AAC avec FFmpeg et téléchargement privé.
- Adaptateurs REST Veo 3.1 et Seedance 2.0 via Higgsfield, validation des limites et références, estimation configurable, confirmation facturable, budget, idempotence, file durable, reprise et annulation. Les identifiants et l’accès réel de ces fournisseurs restent à configurer et à valider.

## Choix d’architecture et réemploi de l’existant

Le frontend conserve Next.js, React, Three.js et React Three Fiber déjà présents. Les règles de document, trajectoires, timeline et prompts sont partagées en TypeScript/Zod. Le module NestJS utilise l’authentification Supabase et le `RolesGuard` existants ; les fichiers passent par l’abstraction de stockage existante vers le bucket privé `actor-private`.

Les six nouvelles tables Prisma sont ajoutées par `20261019160000_director`. Les projets de publicité sont indépendants des prestations d’acteurs ; une prestation existante et ses prises validées peuvent être liées sans créer un second système de commande ou de paiement. Les autres modules Studio et AI Virtual Director sont conservés et inclus dans les tests de régression.

Depuis l’adaptation sans hébergement supplémentaire, les inspections sont confiées à MediaInfo.js dans l’API existante et les MP4 à FFmpeg.wasm dans le navigateur. Le processus natif est conservé uniquement comme option. PostgreSQL fournit la file et les verrous `SKIP LOCKED`, ce qui évite une dépendance Redis et des rendus longs dans l’API ou une fonction serverless. Les tâches contiennent un snapshot ; changer le montage ne modifie pas une production déjà soumise. La prévisualisation 3D, les imports vérifiés, l’export JSON et l’assemblage navigateur ne nécessitent aucun worker Director dédié ni fournisseur IA.

## Résultats automatisés

| Vérification                                 | Résultat                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm db:generate`                           | Réussi                                                                                     |
| Migrations sur PostgreSQL isolé              | 22 migrations appliquées, dont Director ; PostgreSQL 18 local et PostgreSQL 16 dans Docker |
| `pnpm --filter @actbyme/shared test`         | 26 tests réussis, aucun ignoré                                                             |
| `pnpm --filter @actbyme/api test`            | 84 tests réussis, aucun ignoré, avec la base de test locale                                |
| `pnpm --filter @actbyme/web test:e2e`        | 12 tests Chromium réussis : 3 Director et 9 parcours existants                             |
| `pnpm format:check`                          | Réussi                                                                                     |
| `pnpm lint`                                  | Réussi                                                                                     |
| `pnpm typecheck`                             | Réussi                                                                                     |
| `pnpm build`                                 | Réussi pour l’ensemble du monorepo                                                         |
| Image `apps/api/workers/director.Dockerfile` | Construction complète réussie, Linux ARM64 / Node 24                                       |
| Tests Director dans l’image finale           | 13 tests réussis, aucun ignoré, avec PostgreSQL 16 et FFmpeg du conteneur                  |
| Démarrage et arrêt du worker compilé         | Heartbeat PostgreSQL vérifié ; SIGTERM avec code de sortie 0                               |
| Schéma Render du Blueprint d’exemple         | Valide selon le schéma JSON officiel                                                       |

Les tests partagés couvrent les treize modèles, les arrivées exactes et interpolations sans dépassement, la découpe d’un plan continu, les contraintes de fournisseur, les validations de médias, les références du casting, les segments de performance et les données du dossier de production.

Les tests backend utilisent réellement PostgreSQL, FFprobe et FFmpeg : propriété des projets, écritures concurrentes, révisions, droits des acteurs, révocation, inspection des fichiers, confirmation des coûts, budget concurrent, déduplication, snapshots, reprise après interruption, annulation, extraits de performance, assemblage, ordre des images, fondus, mixage audio et export vertical. Les données et les fichiers sont créés dans des environnements de test isolés.

Lors de la livraison initiale (avant l’adaptation navigateur), le Dockerfile final avait été construit depuis le dépôt avec son installation verrouillée, sa génération Prisma et sa compilation NestJS. Les migrations et les treize tests Director ont ensuite été exécutés dans cette image sur une nouvelle base éphémère. Le worker compilé a démarré avec FFmpeg, publié son heartbeat puis quitté proprement sur SIGTERM. Les conteneurs de recette ont été supprimés. Le premier téléchargement Docker Hub avait expiré ; la nouvelle tentative a abouti. L’architecture testée est ARM64 ; la construction native de l’hébergeur cible reste une étape de release.

Les tests navigateur traversent l’interface, les routes NestJS et la base. Ils vérifient la création, la caméra, le déplacement d’un waypoint, la lecture d’un véritable fichier audio, l’import de références et clips, la persistance après rechargement, le téléchargement JSON et MP4, le remplacement d’un seul plan, l’isolation entre propriétaires, les conflits de sauvegarde, l’acceptation explicite du coût, le mode mobile et le repli sans WebGL. Une vérification des pixels WebGL confirme que le décor 3D est réellement dessiné avant la capture. Les tests existants continuent de couvrir les prestations d’acteurs et leurs soumissions.

La démo a également été ouverte depuis le build optimisé avec `next start`, puis son rendu 3D vérifié dans Chromium et capturé après présentation des frames. La lecture audio prépare les métadonnées des pistes et précharge les médias avant leur arrivée sur la timeline ; les annulations volontaires de lecture ne produisent pas de fausses alertes.

## Recette spécifique sans worker supplémentaire

Le parcours Chromium de Director démarre avec zéro heartbeat Director récent et aucun processus de génération/rendu Director actif. L’API inspecte les vrais PNG, MP4 et WAV dans son service d’inspection. Le navigateur charge le vrai core WebAssembly depuis le serveur Next local, assemble deux plans avec musique, sauvegarde le résultat, puis décode le MP4 produit pour vérifier 1280×720 et sa durée. L’audio est confirmé par l’inspection serveur. Le test annule également un premier export et en relance un ; aucune tâche annulée ne publie de résultat. Le worker simulant un fournisseur est activé seulement pour le test distinct de confirmation payante, jamais pour le parcours gratuit.

Les nouveaux tests backend vérifient les neuf formats acceptés, les faux MIME, les octets malformés, les limites de taille et l’annulation du parsing. Un test PostgreSQL sans heartbeat couvre les imports vérifiés, l’export à coût zéro, les doubles soumissions, l’isolation des propriétaires, le refus d’un résultat incompatible, la publication idempotente et la conservation de la version d’origine pendant une modification concurrente. Le verrou payant reste fermé même avec une clé et un tarif configurés. Les tests backend utilisant une file partagée de fixtures s’exécutent en série pour éviter qu’un adaptateur de test ne revendique les tâches d’un autre test.

## Ce que les tests ne prouvent pas

L’authentification Supabase, le transport des objets et les réponses des fournisseurs sont contrôlés par les fixtures de test. Les tests de contrats HTTP vérifient les endpoints, en-têtes, payloads et réponses documentés, mais n’attestent ni un accès payant, ni les droits régionaux, ni la qualité d’une génération réelle. Aucun substitut de test n’est utilisé dans le module de production.

L’intégration au bucket Supabase réel, la reconnexion avec un compte réel et le parcours d’acteur restent à recetter sur un compte autorisé de la production existante ; aucun staging n’est configuré. La persistance et les contrôles d’accès ont été exercés sur des bases PostgreSQL réelles, avec des sessions d’authentification de test. La couverture navigateur utilise Chromium ; les contrôles de responsive et le repli WebGL ne remplacent pas une recette Safari/Firefox sur appareils réels.

## Reproduire la recette locale

Utiliser une base dédiée **locale** dont le nom commence par `studio_test`, jamais une copie connectée à la production. FFmpeg et FFprobe doivent être disponibles. Depuis la racine du dépôt :

```sh
pnpm install --frozen-lockfile
pnpm db:generate
export STUDIO_TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/studio_test_director'
DATABASE_URL="$STUDIO_TEST_DATABASE_URL" pnpm db:deploy
pnpm --filter @actbyme/shared test
pnpm --filter @actbyme/api test
pnpm --filter @actbyme/web exec playwright install chromium
pnpm --filter @actbyme/web test:e2e
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Le harness navigateur lance des serveurs de test sur `127.0.0.1:4401` et `127.0.0.1:3401`. Arrêter un autre serveur Next.js du même checkout avant cette commande. Les fixtures ne contactent ni API IA, ni email, ni stockage de production. Les captures sont écrites dans le répertoire ignoré `apps/web/test-results/`.

## Ouverture en production

Suivre les étapes du [guide d’activation](README.md#activation-et-mise-en-production) : migration additive, vérification du bucket privé, déploiement API puis frontend avec moteur navigateur préparé, recette des imports/exports et des autorisations. Les variables serveur et le Blueprint Render d’exemple sont documentés dans le même guide.

L’activation des générateurs est séparée : clés serveur et tarifs conservateurs vérifiés, limites de dépense sur les comptes concernés, puis une génération réelle à petit plafond explicitement approuvée. Sans cette activation, préparation, prévisualisation, dossier JSON et production à partir de clips importés restent utilisables.

Les principales limites fonctionnelles sont explicites dans l’interface et le guide : décor schématique, mannequins de repérage, trajectoire traduite en prompt sans garantie de reproduction exacte par l’IA, coupes et fondus au noir, aucune synthèse vocale ni génération de musique ajoutée. Les réservations de coût sont conservées après échec/annulation ; le rapprochement de facturation reste une opération d’exploitation.
