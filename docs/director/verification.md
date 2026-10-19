# ACTBYME Director — compte rendu de vérification

Date : 19 octobre 2026. Vérification du code local ; aucun déploiement, aucune migration de production et aucune génération vidéo facturable n’ont été effectués.

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

Les inspections, générations et exports sont confiés à un processus dédié. PostgreSQL fournit la file et les verrous `SKIP LOCKED`, ce qui évite une dépendance Redis et des rendus longs dans l’API ou une fonction serverless. Les tâches contiennent un snapshot ; changer le montage ne modifie pas une production déjà soumise. La prévisualisation 3D et l’export JSON n’appellent aucun fournisseur et fonctionnent sans ce worker.

## Résultats automatisés

| Vérification                                 | Résultat                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm db:generate`                           | Réussi                                                                                     |
| Migrations sur PostgreSQL isolé              | 22 migrations appliquées, dont Director ; PostgreSQL 18 local et PostgreSQL 16 dans Docker |
| `pnpm --filter @actbyme/shared test`         | 25 tests réussis, aucun ignoré                                                             |
| `pnpm --filter @actbyme/api test`            | 82 tests réussis, aucun ignoré, avec la base de test locale                                |
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

Le Dockerfile final a été construit depuis le dépôt avec son installation verrouillée, sa génération Prisma et sa compilation NestJS. Les migrations et les treize tests Director ont ensuite été exécutés dans cette image sur une nouvelle base éphémère. Le worker compilé a démarré avec FFmpeg, publié son heartbeat puis quitté proprement sur SIGTERM. Les conteneurs de recette ont été supprimés. Le premier téléchargement Docker Hub avait expiré ; la nouvelle tentative a abouti. L’architecture testée est ARM64 ; la construction native de l’hébergeur cible reste une étape de release.

Les tests navigateur traversent l’interface, les routes NestJS et la base. Ils vérifient la création, la caméra, le déplacement d’un waypoint, la lecture d’un véritable fichier audio, l’import de références et clips, la persistance après rechargement, le téléchargement JSON et MP4, le remplacement d’un seul plan, l’isolation entre propriétaires, les conflits de sauvegarde, l’acceptation explicite du coût, le mode mobile et le repli sans WebGL. Une vérification des pixels WebGL confirme que le décor 3D est réellement dessiné avant la capture. Les tests existants continuent de couvrir les prestations d’acteurs et leurs soumissions.

La démo a également été ouverte depuis le build optimisé avec `next start`, puis son rendu 3D vérifié dans Chromium et capturé après présentation des frames. La lecture audio prépare les métadonnées des pistes et précharge les médias avant leur arrivée sur la timeline ; les annulations volontaires de lecture ne produisent pas de fausses alertes.

## Ce que les tests ne prouvent pas

L’authentification Supabase, le transport des objets et les réponses des fournisseurs sont contrôlés par les fixtures de test. Les tests de contrats HTTP vérifient les endpoints, en-têtes, payloads et réponses documentés, mais n’attestent ni un accès payant, ni les droits régionaux, ni la qualité d’une génération réelle. Aucun substitut de test n’est utilisé dans le module de production.

L’intégration au bucket Supabase réel, la reconnexion avec un compte réel et le parcours d’acteur doivent être recettés en staging après configuration. La persistance et les contrôles d’accès ont été exercés sur des bases PostgreSQL réelles, avec des sessions d’authentification de test. La couverture navigateur utilise Chromium ; les contrôles de responsive et le repli WebGL ne remplacent pas une recette Safari/Firefox sur appareils réels.

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

Suivre les dix étapes du [guide d’activation](README.md#activation-et-mise-en-production) : migration additive, vérification du bucket privé, déploiement API puis frontend, démarrage du worker FFmpeg, recette des imports/exports et des autorisations. Les variables serveur et le Blueprint Render d’exemple sont documentés dans le même guide.

L’activation des générateurs est séparée : clés serveur et tarifs conservateurs vérifiés, limites de dépense sur les comptes concernés, puis une génération réelle à petit plafond explicitement approuvée. Sans cette activation, préparation, prévisualisation, dossier JSON et production à partir de clips importés restent utilisables.

Les principales limites fonctionnelles sont explicites dans l’interface et le guide : décor schématique, mannequins de repérage, trajectoire traduite en prompt sans garantie de reproduction exacte par l’IA, coupes et fondus au noir, aucune synthèse vocale ni génération de musique ajoutée. Les réservations de coût sont conservées après échec/annulation ; le rapprochement de facturation reste une opération d’exploitation.
