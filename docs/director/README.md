# ACTBYME Director

Éditeur publicitaire intégré à `/director`, avec démo libre à `/director/demo`. Le studio de tournage existant reste disponible à `/studio` et AI Virtual Director à `/virtual-director/:id`.

## Parcours

1. Se connecter avec le compte Supabase habituel, créer une publicité vide ou une copie de **The Coastal House** (projet de démonstration explicitement indiqué, sans faux acteur).
2. **Plan** : nom, catégorie publicitaire, brief, scénario, format paysage/vertical/carré et décor schématique.
3. **Direct** : ajouter des modèles cinématographiques, sélectionner un plan dans la timeline, déplacer les waypoints sur la carte ou saisir position, hauteur, cible, focale et heure d’arrivée. La spline cubique préserve les points d’arrivée et limite les dépassements. Les waypoints restent dans un seul plan continu.
4. Importer des photos JPEG/PNG/WebP, clips MP4/MOV, performances ou fichiers audio MP3/WAV/M4A/OGG dans **Ressources**. Déclarer les droits de chaque fichier ; le transfert aux fournisseurs IA est un choix séparé. Le worker inspecte réellement les fichiers avant de les rendre disponibles.
5. **Perform** : choisir un vrai profil ACTBYME publié et approuvé, lier une prestation existante et importer ses prises ayant passé la QA. Un lien ouvre le workflow de demande de prestation existant. Les mannequins restent des repères de prévisualisation. Les personnages virtuels exigent une attestation de droits. Ajouter des cues de jeu et des pistes voix, musique ou effets.
6. Glisser les plans pour les réordonner ; déplacer et redimensionner les éléments de pistes. Régler les timings, volumes, décalages source et fondus dans l’inspecteur. Copier/coller, dupliquer, découper au curseur, supprimer, annuler et rétablir sont disponibles. La prévisualisation synchronise les caméras, les mannequins et les véritables fichiers audio, sans API IA.
7. **Generate** : exporter le dossier JSON ; importer des clips créés ailleurs, ou vérifier les contraintes du fournisseur puis confirmer séparément la dépense. Les résultats restent distincts et doivent être vérifiés puis associés au montage. Remplacer un plan ne touche pas aux autres.
8. Associer un clip suffisamment long à chaque plan, confirmer les droits puis **Assembler le MP4**. FFmpeg respecte l’ordre, les décalages et les durées, applique les coupes/fondus au noir, mixe les voix, musiques, effets et l’audio original activé. Le résultat H.264/AAC est stocké dans le projet et téléchargeable par lien privé de cinq minutes.

## Architecture

- Next.js / React existants ; React Three Fiber / Three.js déjà installés. Pas de dépendance de montage payante ni de Blender nécessaire à la prévisualisation.
- Scène côtière et plateau produit construits par géométrie procédurale. Aucune photographie n’est présentée comme une reconstruction 3D.
- Contrats Zod et fonctions de trajectoire/timeline/prompt dans `packages/shared/src/director.ts`.
- Module NestJS indépendant `apps/api/src/director`, routes `/director-projects`. Authentification par le `RolesGuard` existant ; contrôle propriétaire à chaque opération, réponses privées sans cache.
- Tables Prisma `DirectorProject`, `DirectorRevision`, `DirectorAsset`, `DirectorJob`, `DirectorActorGrant`, `DirectorWorker`, ajoutées par `20261019160000_director`. Aucune ancienne migration n’est modifiée. RLS activé, sans politiques publiques ; l’accès se fait par le rôle DB serveur.
- Sauvegarde automatique avec numéro de version, révisions immuables, refus des écritures concurrentes et récupération locale du brouillon. Un conflit suspend l’écrasement automatique et permet l’export du brouillon avant rechargement.
- Stockage Supabase `actor-private/director/...`. Aucun objet public, lien permanent ou secret dans les documents exportés. Une ressource utilisée par une version ou une production reste conservée. Les fichiers inutilisés ou uploads abandonnés peuvent être retirés.
- File durable PostgreSQL avec `FOR UPDATE SKIP LOCKED`, bail renouvelable, jeton de revendication, horaires UTC et snapshots. Un worker dédié inspecte, suit les fournisseurs et assemble les vidéos. Aucun traitement long dans une route HTTP ou une fonction Vercel.

## Acteurs et autorisations

Sélectionner un acteur n’autorise aucune synthèse de son identité. Le créateur propose les conditions d’usage. L’acteur se connecte à `/director`, consulte le dossier puis accepte explicitement usage commercial, transformation IA et transfert fournisseur. L’API exige cette acceptation avant la soumission et avant la publication du résultat. L’acteur peut révoquer les prochaines générations. Une modification de direction, références, trajectoire, performances ou casting invalide l’autorisation ; changer seulement le clip associé ne l’invalide pas.

La réservation/prestation continue d’utiliser le workflow ACTBYME existant et son acceptation séparée. Les attestations et acceptations sont enregistrées, mais ne constituent pas une vérification automatique de contrats, de paiement, de l’identité civile ou de restrictions juridiques. Aucun email n’est envoyé automatiquement par Director pour une autorisation ; la demande est visible dans l’espace acteur.

## Fournisseurs vérifiés dans la documentation

Consultation : 19 octobre 2026. Les connecteurs utilisent les API publiques documentées ; aucun achat réel n’a été effectué pour les tester.

| Connecteur                | Endpoint                                                                | Capacités retenues                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Veo 3.1            | Gemini REST `v1beta/models/veo-3.1-generate-preview:predictLongRunning` | Plans de 4, 6 ou 8 s ; 720p ; 16:9/9:16. Jusqu’à 3 JPEG/PNG de référence, uniquement avec 8 s. Les bytes privés sont transmis par le serveur. Les vidéos/performance de référence ne sont pas prises en charge par ce connecteur. |
| Seedance 2.0 / Higgsfield | `https://api.higgsfield.ai/bytedance/seedance-2.0/reference-to-video`   | Plans entiers de 4 à 15 s ; 720p ; 16:9/9:16/1:1. Jusqu’à 3 références dans ce connecteur, images/vidéos/audio. URLs privées signées une heure. Statut et annulation par `requests/:id/status` et `requests/:id/cancel`.          |

Veo publie actuellement 0,40 USD/s pour le modèle standard 720p avec audio. Higgsfield publie des prix variables selon mode/résolution, remises et présence de références. **Les tarifs ne sont pas automatiquement activés** : configurer un plafond conservateur vérifié sur le compte concerné. Les modèles de préversion et les conditions d’accès peuvent changer. Veo requiert un compte Gemini payant et une région autorisée ; vérifier aussi les restrictions sur les personnes réelles. Un abonnement grand public Higgsfield ne prouve pas l’accès API ou le crédit du compte API.

Les endpoints de statut sont reconstruits à partir d’identifiants strictement validés, sans suivre d’URL de contrôle fournie par un tiers. Les téléchargements limitent taille, redirections et hôtes HTTPS. Les clés Google ne sont envoyées qu’à `generativelanguage.googleapis.com`. Si Higgsfield utilise un autre CDN, vérifier son hôte exact puis le renseigner dans `DIRECTOR_HIGGSFIELD_MEDIA_HOSTS` ; ne jamais mettre un joker ou un domaine arbitraire.

Les références visuelles du casting et les performances qui chevauchent le plan rejoignent ses références explicites, sans doublons. Pour Higgsfield, le worker découpe réellement l’extrait de performance selon le décalage source et la durée de chevauchement ; le prompt indique son placement dans le plan. Ces copies privées temporaires sont supprimées après réussite ; les échecs et annulations sont nettoyés après une heure par le worker. Les ressources originales et les résultats sont conservés.

Sources :

- [Veo : génération, références et contraintes](https://ai.google.dev/gemini-api/docs/veo)
- [Gemini : tarifs](https://ai.google.dev/gemini-api/docs/pricing)
- [Higgsfield : contrat Seedance](https://open.higgsfield.ai/models/bytedance/seedance-2.0/reference-to-video/api-reference)
- [Higgsfield : statut](https://docs.higgsfield.ai/docs/api-reference/requests/get-request-status)
- [Higgsfield : annulation](https://docs.higgsfield.ai/docs/api-reference/requests/cancel-a-queued-request)
- [Higgsfield : tarifs](https://open.higgsfield.ai/pricing)

## Dépenses, reprise et annulation

Aucune génération au chargement ni pendant le montage. Le serveur exige fournisseur, version, confirmation facturable, droits et plafond en centimes USD. Les coûts sont réservés sous verrou propriétaire : 25 USD/mois par défaut, trois tâches actives et cent traitements de production par jour. Une clé UUID empêche de facturer deux fois la même demande. Les mêmes identifiants avec un contenu différent sont refusés.

Le worker persiste `SUBMITTING` **avant** l’appel payant. Un accusé de réception perdu ou un redémarrage à ce stade entraîne un échec à vérifier manuellement ; aucune nouvelle soumission automatique. Un reçu enregistré est interrogé après redémarrage. Six reprises avec attente croissante sont possibles pour les erreurs temporaires de suivi. Une annulation révoque le jeton local et empêche la publication tardive ; Higgsfield reçoit aussi une demande d’annulation. La documentation Veo ne garantit pas cette annulation distante : le traitement peut rester facturable. Les échecs/annulations gardent la réservation de coût ; prévoir un rapprochement avec les factures et des limites externes sur les comptes fournisseurs.

## Activation et mise en production

Le frontend, l’API et les migrations de la version `81d9f24` ont été publiés le 19 octobre 2026 à la demande du propriétaire. L’activation du worker et la recette authentifiée restent à finaliser. Le statut vérifié et les accords nécessaires sont détaillés dans [production-release.md](production-release.md). Aucun générateur vidéo payant n’a été activé.

1. Utiliser Node 24 et pnpm 11.3.0, installer depuis la racine : `pnpm install --frozen-lockfile`.
2. Sauvegarder la base cible selon le processus de release habituel. Générer Prisma puis appliquer les migrations via le rôle serveur : `pnpm db:generate`, `pnpm db:deploy`. Utiliser la connexion de migration adaptée à votre hébergeur. Les migrations sont additives ; ne pas utiliser `db push` ni réinitialiser la production.
3. Conserver les variables Supabase de l’API et de l’authentification frontend existantes. `SUPABASE_SECRET_KEY` et `DATABASE_URL` restent uniquement serveur. Vérifier le bucket **privé** `actor-private`, sa limite de fichier et ses types autorisés : JPEG/PNG/WebP, MP4/MOV, MP3/WAV/M4A/OGG. Maximum applicatif : 15 MiB par image, 200 MiB par média, 200 ressources et 2 GiB par projet. Ne créer aucune politique publique de lecture/écriture pour les chemins Director ni pour les nouvelles tables.
4. Construire le monorepo : `pnpm build`. Déployer l’API NestJS avec son module Director avant le frontend Vercel. Préserver les réglages de domaine, CORS et authentification existants. L’API peut servir la préparation sans fournisseur configuré.
5. Construire le worker depuis la racine : `docker build -f apps/api/workers/director.Dockerfile -t actbyme-director-worker .`. Démarrer avec `STORAGE_PROVIDER=supabase`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Le conteneur n’ouvre aucun port ; il traite la file PostgreSQL. Il contient FFmpeg/FFprobe et s’exécute sous l’utilisateur `node`.
6. Pour Render, ajouter le service distinct décrit dans [render-worker.yaml](render-worker.yaml) au déploiement voulu après validation de la dépense d’hébergement. Ne pas synchroniser ce fichier partiel sur un Blueprint qui retirerait d’autres services. Le plan d’exemple est `1c-2g`, sans disque persistant ; les sorties sont copiées dans Supabase avant suppression des fichiers temporaires. Définir les secrets dans le service ou un groupe d’environnement contrôlé. `sync: false` ne les configure que lors de la première création. `autoDeployTrigger: off` évite un lancement automatique non demandé.
7. Pour une exécution locale compilée : `pnpm --filter @actbyme/api worker:director`. `FFMPEG_PATH` et `FFPROBE_PATH` permettent des chemins locaux. Le worker doit afficher un heartbeat récent dans `DirectorWorker` et l’UI indiquer « worker disponible » pour autoriser les imports et exports. Les baux sont renouvelés toutes les cinq secondes et expirent après 45 secondes. SIGTERM interrompt les sous-processus et conserve les checkpoints.
8. Sans générateur, laisser toutes les variables `DIRECTOR_*_API_KEY` vides et les tarifs à zéro. Import et assemblage MP4 restent disponibles ; la prévisualisation et l’export JSON fonctionnent sans worker.
9. Pour activer Veo, renseigner **dans l’API et le worker** `DIRECTOR_VEO_API_KEY` et `DIRECTOR_VEO_CENTS_PER_SECOND` après vérification des accès et du tarif conservateur. Pour Higgsfield : `DIRECTOR_HIGGSFIELD_API_KEY` (clé complète) et `DIRECTOR_HIGGSFIELD_CENTS_PER_SECOND`. Fixer `DIRECTOR_MONTHLY_BUDGET_CENTS` dans l’API. Ne jamais utiliser `NEXT_PUBLIC_` pour ces variables. Une clé présente indique seulement une configuration ; l’accès réel se vérifie par un appel explicitement autorisé.
10. Effectuer le parcours de recette avec un projet de staging, des ressources licenciées et un export manuel, puis tester une seule génération réelle avec un petit plafond approuvé. Vérifier la facture fournisseur, la copie privée, le téléchargement et l’annulation avant ouverture générale.

Documentation Render vérifiée : [Blueprint](https://render.com/docs/blueprint-spec), [plans de calcul](https://render.com/docs/compute-plans), [variables](https://render.com/docs/configure-environment-variables), [déploiements et SIGTERM](https://render.com/docs/deploys).

## Limites explicites

- La 3D est une prévisualisation de mise en scène simplifiée. Les personnages sont des mannequins, même lorsqu’un acteur réel est sélectionné. Aucun mouvement facial ni reconstruction de bâtiment à partir de photos.
- L’IA interprète des prompts ; les trajectoires ne conditionnent pas numériquement le moteur. L’identité exacte, les détails cachés, la performance et la synchronisation labiale exigent une validation humaine.
- Deux transitions d’export : coupe et fondu au noir, avec durée finale conservée. Pas de fondu enchaîné avec chevauchement, étalonnage avancé, rendu typographique ni édition de waveform.
- Les fichiers audio importés sont réellement mixés ; aucune génération de voix ou musique payante n’est ajoutée. Les performances vidéo servent de références et de sources audio ; elles ne deviennent pas un squelette 3D reconstruit.
- Un import de clip est requis pour chaque plan si l’API vidéo ne supporte pas sa durée. Les durées ou formats incompatibles provoquent un message explicite, sans recadrage silencieux ni segmentation facturable automatique.
- Limite de projet : dix minutes, soixante plans, vingt personnages, 120 éléments de pistes, export de 200 MiB. Cible principale : navigateur de bureau avec WebGL2. Sans WebGL, carte, directions, timeline et production restent accessibles.
- Les brouillons locaux sont des données de projet sur l’appareil, sans clés ni URL signées. Prévoir une politique de conservation et un nettoyage des objets orphelins après suppressions manuelles en base ; aucun nettoyeur récurrent externe n’est créé.
- Le contrôle de coût est applicatif et conservateur ; il ne remplace pas une limite chez le fournisseur et ne garantit pas sa facture.

Les résultats de tests et les limites de vérification sont consignés dans [verification.md](verification.md).
