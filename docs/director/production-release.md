# ACTBYME Director — publication en production

Vérification du 19 octobre 2026. Publication demandée par le propriétaire sur la production existante, sans environnement de staging.

## Version publiée

- Commit applicatif : `81d9f24e54ce699b6657427c02d0a4ade7d3127b`, poussé sur `main` de `Christophe-DC/ActByMe`.
- Frontend Vercel `actbyme-web` : déploiement `dpl_8iJ1eYsEfn9ZPQ5zjyWVmQrJjuWt`, état `READY`, cible `production`.
- Accueil Director : <https://www.actbyme.com/director>.
- Démo : <https://www.actbyme.com/director/demo>.
- API : <https://api.actbyme.com>. Son schéma public contient les seize chemins Director et les douze chemins Virtual Director attendus.

Le pipeline existant a appliqué les migrations additives `20261017120000_virtual_director`, `20261017130000_virtual_director_utc` et `20261019160000_director`. La dernière est enregistrée comme terminée à `2026-10-19T18:13:55.442621Z` dans `_prisma_migrations`. Les six tables Director sont présentes dans la base réellement utilisée par ACTBYME. Aucune réinitialisation ni suppression de données existantes n’a été exécutée.

## Contrôles effectués sur les services réels

- Réponses HTTP 200 sur Director, le catalogue d’acteurs et le Studio existant après les redirections vers le domaine canonique.
- Démo ouverte dans Chromium sur le domaine de production : rendu WebGL, modification de hauteur caméra, annulation et lecture de la timeline validés. Aucune requête de génération payante.
- Lecture du schéma API déployé et des migrations de production, sans modification des données applicatives.
- Accès aux routes Director sans authentification : HTTP 401.
- Bucket Supabase `actor-private` accessible par le serveur et toujours privé (`public: false`). Aucune politique de publication ajoutée. Ses limites locales de taille et MIME sont actuellement héritées des paramètres globaux du projet ; les limites applicatives ne remplacent pas celles de l’hébergeur.

Le connecteur Supabase disponible dans cette session expose un autre projet. Les contrôles ACTBYME ont utilisé uniquement les identifiants serveur déjà présents dans la configuration locale, après correspondance avec le projet Supabase référencé par le frontend public. Les secrets ne sont ni inscrits dans ce compte rendu ni ajoutés au dépôt.

## État historique avant l’adaptation gratuite

Le 19 octobre, aucun heartbeat n’était présent dans `DirectorWorker`. Les imports inspectés, les générations et les exports MP4 nécessitent ce worker ; ils ne sont donc pas déclarés opérationnels sur cette production. La préparation, la prévisualisation locale et les routes de sauvegarde/export JSON sont publiées ; leur parcours authentifié réel reste à recetter.

Le worker dédié est fourni et validé localement dans `apps/api/workers/director.Dockerfile`. Le fichier `render-worker.yaml` décrit un service sans disque persistant, une instance `1c-2g` et des générateurs désactivés par défaut. Le tarif de calcul public vérifié est de **25 USD/mois** pour 1 CPU et 2 Go, en supplément des services existants, hors éventuel trafic ou dépassement de quotas. [Tarification Render](https://render.com/pricing).

Avant sa création, il reste à obtenir la confirmation de l’espace Render « My Workspace » et l’accord sur cette nouvelle dépense. Le CLI Render temporaire a été préparé ; sa session n’est pas authentifiée. Le connecteur Render est accessible mais ne possède pas encore d’espace sélectionné. Aucun nouveau service payant n’a été créé, et aucune synchronisation de Blueprint n’a été lancée.

Après activation, vérifier un heartbeat récent et réaliser un import suivi d’un assemblage MP4 avec des médias de recette licenciés. Réutiliser la base et le bucket privés existants ; configurer uniquement côté serveur `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` et `STORAGE_PROVIDER=supabase`. Conserver les clés Director vides et les tarifs à zéro pour la recette manuelle.

## Limite de recette authentifiée

La vérification automatique d’approbation a refusé la création puis la suppression d’un compte client et d’un projet temporaires en production : elle exige une autorisation explicite distincte du déploiement. La commande n’a pas été exécutée et aucun compte de recette n’a été créé. L’accord demandé couvre uniquement des données temporaires clairement identifiées, sans profil d’acteur public, email automatique ni appel IA payant.

Les 25 tests partagés, 82 tests backend, 12 tests navigateur et 13 tests Director dans l’image Docker restent les preuves automatisées locales décrites dans [verification.md](verification.md). Ils ne constituent pas une recette complète de l’authentification, du stockage et du worker de cette production. Ne pas présenter l’import ou le MP4 comme validés en production avant la fin des étapes ci-dessus.

## Adaptation sans nouveau service payant

Le propriétaire a demandé de remplacer la dépendance au worker supplémentaire et de pousser le code. La nouvelle architecture inspecte les imports dans l’API existante et assemble le MP4 dans le navigateur. Aucun service Render n’a été créé et aucune modification d’espace Render n’est requise. Les instructions de création du worker ci-dessus décrivent l’ancienne architecture et sont remplacées par le [guide courant](README.md#activation-et-mise-en-production).

Les générateurs payants sont verrouillés par défaut via `DIRECTOR_ENABLE_PAID_GENERATION=false`. L’édition, la prévisualisation, les imports, le JSON et le MP4 à partir de clips importés utilisent les services existants. Les limites du rendu navigateur et les quotas de stockage/transfer existants restent applicables. Aucune nouvelle migration n’est nécessaire. Les tests de l’architecture gratuite sont détaillés dans [verification.md](verification.md). La validation authentifiée de production n’est pas déclarée réalisée ; aucun compte ni projet de recette n’a été créé en production.
