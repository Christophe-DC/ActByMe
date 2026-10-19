# Vérification — AI Virtual Director

Vérification locale du 17 octobre 2026. Base PostgreSQL 18 dédiée : `studio_test_virtual_director`, sur une instance locale créée pour ces tests. Les données du projet et les services de production ne sont pas utilisés.

## Résultats

| Vérification           | Résultat                 | Preuve / portée                                                                                                                                       |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration Prisma       | Réussie                  | Les 21 migrations, dont les nouvelles tables, appliquées sur la base isolée ; RLS vérifié pour les quatre tables.                                     |
| `pnpm lint`            | Réussi                   | Les cinq packages du monorepo.                                                                                                                        |
| `pnpm typecheck`       | Réussi                   | Les cinq packages, dont les nouveaux contrats et composants.                                                                                          |
| `pnpm build`           | Réussi                   | API NestJS, frontend Next.js et packages ; nouvelle route dynamique incluse.                                                                          |
| Tests partagés         | 16 réussis               | Validations de scène, animations existantes, limites vidéo et droits requis.                                                                          |
| Tests API              | 69 réussis, aucun ignoré | Workflows existants et nouveaux tests de stockage, concurrence, budget et reprise.                                                                    |
| Tests navigateur       | 9 réussis                | Sept scénarios existants et deux parcours Virtual Director ; bureau, mobile et erreurs.                                                               |
| FFmpeg réel            | Réussi                   | Découpage d’une vidéo synthétique, normalisation 1280 × 720, restauration ou absence d’audio selon la référence ; métadonnées vérifiées avec FFprobe. |
| Image Docker           | Construite               | Node 24, FFmpeg/FFprobe et Blender sous Linux ; aucun fichier `.env` dans le contexte.                                                                |
| Blender réel           | Réussi                   | Rendu Cycles CPU de 40 images, assemblé en vidéo H.264 640 × 360 de 5,000 secondes, contrôlé avec FFprobe et inspection visuelle d’une image.         |
| Démarrage du worker    | Réussi                   | Code compilé exécuté dans le conteneur ; connexion PostgreSQL, Blender disponible, heartbeat UTC récent, puis arrêt SIGTERM propre.                   |
| Fournisseur vidéo réel | Non exécuté              | Aucun appel payant ; un compte fal, une clé et une configuration tarifaire restent nécessaires.                                                       |

## Couverture des tests de production vidéo

Les tests API passent par les vrais services et tables PostgreSQL. Ils vérifient l’accès propriétaire et le refus d’un autre utilisateur, les versions concurrentes, l’inspection du fichier et sa copie privée, la déduplication des demandes, les snapshots immuables, la réservation de coût, la reprise d’un identifiant fournisseur après redémarrage, les délais de reprise après une panne temporaire, les erreurs sans résultat de remplacement, l’approbation avant téléchargement et l’annulation pendant une soumission. Ils vérifient aussi le refus d’une prise existante sans consentement autorisant la transformation. Une connexion PostgreSQL explicitement réglée en Europe/Paris vérifie qu’un bail futur et un délai de suivi UTC ne sont pas exécutés prématurément.

Les tests de l’adaptateur contrôlent le schéma exact envoyé à Seedance et les appels de statut/résultat/annulation, ainsi que le refus d’hôtes permettant une fuite de la clé API. Les réponses de fal et le stockage sont simulés **dans ces tests seulement**. Les fichiers utilisés sont des aplats de couleur et un signal audio synthétique, sans faux acteur présenté comme réel.

Les tests navigateur utilisent le vrai contrôleur HTTP, Prisma et les services. L’authentification, le stockage et le fournisseur sont des fixtures isolées ; FFmpeg traite réellement leurs fichiers. Ils couvrent l’import depuis le navigateur, les autorisations obligatoires, la sauvegarde des caméras, la génération asynchrone, la comparaison, l’approbation, le lien de téléchargement, la confidentialité des réponses et l’affichage mobile sans débordement. Ils contrôlent aussi la conservation d’un brouillon sur conflit et l’affichage d’un échec fournisseur. Les tests existants couvrent le studio, l’envoi à l’acteur, les guides, les retours, les sauvegardes et la perte de WebGL.

## Reproduction

Prérequis locaux : PostgreSQL isolé, FFmpeg/FFprobe disponibles dans `PATH`, dépendances pnpm installées et Chromium Playwright. Ne jamais utiliser une base de production comme base de tests.

```bash
pnpm db:generate
# Définir DATABASE_URL sur une base locale dont le nom commence par studio_test,
# puis appliquer ses migrations :
pnpm db:deploy
pnpm --filter @actbyme/shared test
# Définir STUDIO_TEST_DATABASE_URL sur cette même base :
pnpm --filter @actbyme/api test
pnpm build
pnpm --filter @actbyme/web exec playwright install chromium
pnpm --filter @actbyme/web test:e2e
pnpm lint
pnpm typecheck
```

Les ports de la suite navigateur sont 3401 et 4401. Le serveur de fixtures ne fait jamais partie du démarrage normal de l’API. Il crée et supprime ses comptes et projets uniquement dans la base de tests. L’arrêt du serveur de fixtures attend la fin de son worker et supprime les projets de test ; l’absence de projets Virtual Director restants a été vérifiée en base. Les captures sont enregistrées dans `apps/web/test-results/virtual-director-desktop.png` et `virtual-director-mobile.png`.

Le rendu Blender a été exécuté avec le conteneur fourni, sans réseau, en donnant uniquement un dossier temporaire et une scène de mannequin issue du même échantillonneur que le navigateur. Il valide l’exécution réelle de Blender/FFmpeg, pas la fidélité visuelle d’une génération IA à un acteur.

## Limites de la validation

Une simulation du fournisseur valide la plomberie, la persistance et les erreurs, pas la qualité ou l’accès commercial au modèle. Aucun succès de génération Seedance réelle, aucune facture fournisseur, aucune permission de traitement de personnes réelles et aucun déploiement Render/Vercel ne sont attestés ici. Les actions externes requises sont décrites dans le [guide de configuration](README.md).
