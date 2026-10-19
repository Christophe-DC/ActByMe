# AI Virtual Director

Une performance privée peut servir de référence à plusieurs variantes de plans. L’entrée est disponible dans **Projects → AI Virtual Director** et depuis un projet ouvert dans **Director Studio** (`/virtual-director/:projectId`). Aucun compte, service payant ou déploiement n’est créé automatiquement.

## Parcours livré

1. Créer un projet par le parcours existant ou ouvrir un projet enregistré.
2. Préparer les caméras depuis la dernière scène Director Studio, ou démarrer avec une mise en scène neutre. Le studio existant génère déjà ses scènes à partir du script et du Shooting Plan. En l’absence de scène, le cadrage textuel du premier plan initialise le nom du plan ; les caméras ne sont pas inventées à partir d’une vidéo 2D.
3. Importer un MP4/MOV privé de 4 à 120 secondes et 200 Mio maximum, ou réutiliser une performance du projet ayant passé la QA. Renseigner l’interprète, la base de son autorisation et attester explicitement les droits de transformation et de transfert au fournisseur. Pour une prise existante, le consentement accepté doit autoriser la transformation IA et correspondre au Shooting Plan approuvé.
4. Choisir un angle avant/gauche/droite/haut/serré/large, un mouvement fixe/rapprochement/travelling, le suivi d’un personnage et les limites des plans. Des réglages précis de position et de cible restent disponibles. Les modifications de cette copie de production ne changent pas les instructions déjà envoyées à l’acteur.
5. Enregistrer les caméras et prévisualiser immédiatement avec le moteur Three.js existant. Un worker Blender peut également produire une vraie vidéo de prévisualisation schématique.
6. Sélectionner les plans, l’extrait source et les instructions. Le même point de départ source permet de produire plusieurs angles de la même performance ; changer ce point permet de continuer la scène. Les durées acceptées par l’adaptateur Seedance sont des nombres entiers de 4 à 15 secondes.
7. Suivre les étapes de chaque tâche, annuler ou créer une nouvelle version sans perdre les résultats précédents. Comparer le résultat à l’original, approuver, puis demander un téléchargement privé valable cinq minutes.

## Architecture et analyse du projet

Le monorepo contient Next.js 16 / React 19 côté interface, NestJS 11 côté API et Prisma 7 / PostgreSQL. Le workflow `performance-projects` possède déjà les projets, le Shooting Plan Gemini, les prises, la QA, les consentements versionnés et les livraisons. `director-studio` possède des scènes structurées et validées, des révisions immuables et un lecteur React Three Fiber. Supabase fournit l’authentification et les vrais objets privés ; le service S3 existant est un substitut incomplet et n’est pas utilisé pour cette fonctionnalité. Les documents du dépôt décrivent une API Render et un frontend Vercel ; aucun rendu Blender n’est exécuté dans une requête HTTP ni dans une fonction Vercel.

Les intégrations OpenAI historiques ne sont pas modifiées. Gemini continue d’assurer les workflows existants. La génération vidéo utilise un adaptateur séparé parce que le fournisseur actuel de texte/QA ne constitue pas déjà une API de transformation de performances vidéo.

- `packages/shared/src/virtual-director.ts` : contrats Zod, limites, scène neutre et description de caméra.
- `apps/api/src/virtual-director/` : contrôleur propriétaire, persistance, budgets et worker.
- `video-provider.ts` : interface remplaçable `VideoProvider` et adaptateur REST fal / Seedance 2 reference-to-video. Le constructeur du worker reçoit l’adaptateur par injection.
- `video-processing.ts` : inspection, découpage, normalisation en 1280 × 720, contrôle de durée et conservation de l’audio original avec FFmpeg.
- `apps/api/workers/blender-preview.py` : scène Blender à personnages/objets simplifiés, caméras et animation ; rendu Cycles CPU à 640 × 360 / 8 images par seconde. Les positions, cibles et poses sont échantillonnées par les mêmes fonctions partagées que le navigateur, puis transmises sous forme de JSON. Aucune entrée utilisateur n’est exécutée comme du Python.
- Tables `VirtualDirector`, `VirtualDirectorReference`, `VirtualDirectorJob`, `VirtualDirectorWorker` : scène versionnée, preuves déclaratives de droits, tâches et disponibilité du worker. RLS est activé sans politique publique : seuls les accès de l’API et du worker via leur rôle serveur sont prévus.

PostgreSQL sert de file durable ; Redis n’est pas nécessaire. Les dates de planification et les baux utilisent explicitement UTC, indépendamment du fuseau horaire de la base. Les workers revendiquent une tâche avec `FOR UPDATE SKIP LOCKED`, un jeton et un bail renouvelable. Une requête fournisseur persistée est interrogée à nouveau après redémarrage, sans nouvel achat. L’état `SUBMITTING` est enregistré avant l’appel payant : si son accusé de réception est perdu, la tâche échoue avec une instruction de vérification manuelle du tableau de bord fournisseur. Une soumission ambiguë n’est jamais renvoyée automatiquement. Les erreurs temporaires de suivi sont réessayées six fois, avec attente croissante. Une annulation révoque le jeton avant toute publication tardive et demande l’annulation fournisseur lorsque son identifiant est connu.

## Configuration externe

1. Appliquer les migrations `20261017120000_virtual_director` et `20261017130000_virtual_director_utc` avant de démarrer l’API mise à jour : `pnpm db:generate`, puis `pnpm db:deploy` sur la base cible. Ces commandes ont été testées sur une base locale isolée ; la base de production n’a pas été migrée.
2. Conserver `actor-private` en bucket privé. Autoriser les types MP4/MOV et une limite d’upload adaptée, dans les limites du plan Supabase. Vérifier que le rôle DB serveur dispose des droits nécessaires et que le Data API n’a aucune politique d’accès à ces nouvelles tables. Les secrets Supabase restent exclusivement sur les serveurs.
3. Créer un compte fal avec accès au modèle `bytedance/seedance-2.0/reference-to-video`, vérifier ses conditions, la disponibilité régionale, les restrictions relatives aux personnes réelles et la politique de traitement des vidéos. Mettre `FAL_KEY` dans l’API **et** dans le worker ; aucune clé n’est envoyée au navigateur.
4. Vérifier le tarif actuel de cet endpoint avec vidéo de référence à 720p. Définir `VIRTUAL_DIRECTOR_CENTS_PER_SECOND` en **centimes de dollar par seconde**, fractions acceptées. La valeur par défaut `0` désactive volontairement la génération payante. L’estimation est un plafond applicatif calculé sur la durée de sortie, pas un reçu fournisseur : configurer un tarif conservateur couvrant toute facturation additionnelle, et ajouter les limites de dépense du compte fal.
5. Définir `VIRTUAL_DIRECTOR_MONTHLY_BUDGET_CENTS` (défaut : 2500, soit 25 USD par propriétaire et mois UTC). Les échecs et annulations gardent leur réservation ; le système ne prétend pas réconcilier la facture du fournisseur. Limites complémentaires : trois tâches actives par propriétaire, cent tâches sur 24 heures, vingt références par projet.
6. Déployer **un worker dédié** avec le Dockerfile fourni, en partageant la base et le stockage de l’API. Le fichier `render-worker.yaml` de ce dossier est un exemple de service à ajouter au déploiement Render. Il ne crée ni ne modifie l’API existante. Prévoir la mémoire, le disque temporaire et la facturation du service ; les rendus utilisent deux threads CPU. Les sorties sont persistées en stockage privé et les fichiers de travail locaux sont effacés après chaque tâche.
7. Mettre à jour le frontend après l’API. Il affiche les capacités manquantes et permet de préparer les caméras même quand le worker ou l’API payante n’est pas configuré.

Exécution locale du worker après compilation, avec les variables de `.env` :

```bash
pnpm --filter @actbyme/api build
pnpm --filter @actbyme/api worker:video
```

Lancer depuis `apps/api` conserve la résolution du script Blender. Pour une exécution directe depuis un autre dossier, renseigner `BLENDER_PREVIEW_SCRIPT` avec son chemin absolu. `FFMPEG_PATH`, `FFPROBE_PATH` et `BLENDER_PATH` permettent d’utiliser des installations locales.

Construction du conteneur depuis la racine :

```bash
docker build -f apps/api/workers/Dockerfile -t actbyme-video-worker .
```

Le contexte Docker exclut tous les `.env`, les clés n’entrent pas dans l’image. Le processus s’exécute sous l’utilisateur `node`, sans port entrant. SIGTERM interrompt les sous-processus et conserve les checkpoints pour reprise. Le heartbeat est considéré hors ligne après trente secondes. Les configurations multi-workers doivent être homogènes, notamment pour Blender, car le signal de disponibilité est partagé.

## Confidentialité et fichiers

Les routes exigent un utilisateur authentifié **propriétaire du projet**, y compris pour la lecture, la prévisualisation, l’approbation et le téléchargement. Les réponses utilisent `private, no-store`. Les listes n’exposent ni clés de stockage, ni URL fournisseur, ni requêtes techniques. Une prise importée est copiée en objet privé indépendant et reste liée au consentement et à la tentative d’upload d’origine. Les références utilisées restent conservées pour la provenance des générations.

Les extraits destinés à fal utilisent des URL signées d’une heure. Les résultats fournisseur sont téléchargés avec limite de taille et contrôle d’hôte HTTPS, vérifiés comme vidéos, puis copiés dans `actor-private`. Le navigateur reçoit uniquement un lien signé de cinq minutes à la demande. Le fournisseur reçoit nécessairement la performance autorisée ; les liens signés ActByMe ne garantissent pas sa politique de conservation ou de confidentialité. L’attestation du propriétaire est enregistrée avec son identifiant et sa date ; l’application ne vérifie pas automatiquement un contrat ni l’identité du signataire.

Les extraits intermédiaires sont supprimés après réussite et nettoyés pour les tâches terminées depuis plus d’une heure. Les références d’uploads abandonnés peuvent être retirées depuis l’interface. Prévoir une politique opérationnelle de conservation/suppression des productions, ainsi qu’un nettoyage des objets orphelins si un projet est supprimé directement en base. Il n’existe pas de publication automatique de ces productions dans le portfolio public.

## Capacités vérifiées et limites

L’endpoint Seedance documente les vidéos de référence MP4/MOV, les consignes de caméra et les sorties de 4 à 15 secondes. L’adaptateur envoie un extrait normalisé, la description du plan et l’identifiant du propriétaire ; il ne prétend pas transmettre une matrice caméra reconnue par le modèle. L’audio généré est désactivé puis remplacé par celui de la référence quand il est présent.

La conservation exacte d’un visage, d’un décor invisible, des gestes et de la synchronisation labiale n’est **pas garantie**. De nouveaux angles impliquent des détails inférés ; la vérification humaine reste nécessaire. La géométrie et la trajectoire Blender guident la préparation, mais ne conditionnent pas numériquement les images du fournisseur. Le décor et les mannequins ne sont pas une reconstruction fidèle de la vidéo 2D. Les variantes sont des fichiers séparés ; aucun montage automatique ni recalage multi-caméra n’est fourni. Une génération trop longue pour l’API doit être découpée ; aucun allongement ou résultat fictif ne remplace un échec.

Pour une continuité strictement reproductible, l’alternative reste une captation réelle avec plusieurs caméras, ou une production 3D avec personnage, décor et animation contrôlés. Cette intégration ne promet pas de remplacer ces sources à partir d’une seule vidéo.

Sources fournisseur consultées lors de l’implémentation :

- [Seedance 2 reference-to-video : schéma exact des entrées et sorties](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/api)
- [File asynchrone fal : soumission, suivi et annulation](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [Kling O3 edit : alternative étudiée, non activée](https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/edit/api)
- [Supabase : envoi d’un objet privé](https://supabase.com/docs/reference/javascript/storage-from-upload)

## Vérification

Voir [verification.md](verification.md) pour les résultats détaillés, les commandes et la distinction entre traitements réellement exécutés et fournisseur vidéo simulé dans les tests. Aucune génération vidéo payante n’a été effectuée sans configuration externe.
