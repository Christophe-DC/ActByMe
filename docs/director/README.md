# ACTBYME Director

Éditeur publicitaire intégré à `/director`, avec démo libre à `/director/demo`. Le studio de tournage existant reste disponible à `/studio` et AI Virtual Director à `/virtual-director/:id`.

## Parcours

1. Se connecter avec le compte Supabase habituel, créer une publicité vide ou une copie de **The Coastal House** (projet de démonstration explicitement indiqué, sans faux acteur).
2. **Plan** : nom, catégorie publicitaire, brief, scénario, format paysage/vertical/carré et décor schématique.
3. **Direct** : ajouter des modèles cinématographiques, sélectionner un plan dans la timeline, déplacer les waypoints sur la carte ou saisir position, hauteur, cible, focale et heure d’arrivée. La spline cubique préserve les points d’arrivée et limite les dépassements. Les waypoints restent dans un seul plan continu.
4. Importer des photos JPEG/PNG/WebP, clips MP4/MOV, performances ou fichiers audio MP3/WAV/M4A/OGG dans **Ressources**. Déclarer les droits de chaque fichier ; le transfert aux fournisseurs IA est un choix séparé. L’API existante inspecte réellement les octets avec MediaInfo.js dans un thread isolé avant de rendre le fichier disponible (50 MiB maximum, 15 MiB par image). Aucun worker hébergé distinct n’est requis.
5. **Perform** : choisir un vrai profil ACTBYME publié et approuvé, lier une prestation existante et importer ses prises ayant passé la QA. Un lien ouvre le workflow de demande de prestation existant. Les mannequins restent des repères de prévisualisation. Les personnages virtuels exigent une attestation de droits. Ajouter des cues de jeu et des pistes voix, musique ou effets.
6. Glisser les plans pour les réordonner ; déplacer et redimensionner les éléments de pistes. Régler les timings, volumes, décalages source et fondus dans l’inspecteur. Copier/coller, dupliquer, découper au curseur, supprimer, annuler et rétablir sont disponibles. La prévisualisation synchronise les caméras, les mannequins et les véritables fichiers audio, sans API IA.
7. **Generate** : exporter le dossier JSON ; importer des clips créés ailleurs, ou vérifier les contraintes du fournisseur puis confirmer séparément la dépense. Les résultats restent distincts et doivent être vérifiés puis associés au montage. Remplacer un plan ne touche pas aux autres.
8. Associer un clip suffisamment long à chaque plan, confirmer les droits puis **Assembler le MP4**. FFmpeg.wasm s’exécute dans un Web Worker du navigateur et respecte l’ordre, les décalages et les durées, applique les coupes/fondus au noir, mixe les voix, musiques, effets et l’audio original activé. Le résultat H.264/AAC est téléchargeable immédiatement, puis vérifié dans l’API et stocké dans le projet avec sa version, accessible par lien privé de cinq minutes. Garder l’onglet ouvert pendant l’encodage ; les autres espaces de l’éditeur restent utilisables.

## Architecture

- Next.js / React existants ; React Three Fiber / Three.js déjà installés. Pas de dépendance de montage payante ni de Blender nécessaire à la prévisualisation.
- Scène côtière et plateau produit construits par géométrie procédurale. Aucune photographie n’est présentée comme une reconstruction 3D.
- Contrats Zod et fonctions de trajectoire/timeline/prompt dans `packages/shared/src/director.ts`.
- Module NestJS indépendant `apps/api/src/director`, routes `/director-projects`. Authentification par le `RolesGuard` existant ; contrôle propriétaire à chaque opération, réponses privées sans cache.
- Tables Prisma `DirectorProject`, `DirectorRevision`, `DirectorAsset`, `DirectorJob`, `DirectorActorGrant`, `DirectorWorker`, ajoutées par `20261019160000_director`. Aucune ancienne migration n’est modifiée. RLS activé, sans politiques publiques ; l’accès se fait par le rôle DB serveur.
- Sauvegarde automatique avec numéro de version, révisions immuables, refus des écritures concurrentes et récupération locale du brouillon. Un conflit suspend l’écrasement automatique et permet l’export du brouillon avant rechargement.
- Stockage Supabase `actor-private/director/...`. Aucun objet public, lien permanent ou secret dans les documents exportés. Une ressource utilisée par une version ou une production reste conservée. Les fichiers inutilisés ou uploads abandonnés peuvent être retirés.
- File durable PostgreSQL avec `FOR UPDATE SKIP LOCKED`, jeton de revendication, horaires UTC et snapshots. `DirectorInspectionService` traite un fichier à la fois par instance de l’API existante, hors route HTTP, sans FFmpeg/FFprobe système. MediaInfo.js est chargé dans un thread Node jetable limité à 96 MiB de heap JS et 30 secondes de parsing (la mémoire WASM est distincte). Le stockage dispose d’un délai de 60 secondes, le bail expire après 90 secondes et reprend après redémarrage. Les fichiers annulés ou malformés ne deviennent jamais lisibles.
- `director-render-plan.ts` partage réellement les règles d’assemblage audio/vidéo entre rendu navigateur et rendu natif optionnel. FFmpeg.wasm est chargé uniquement au clic d’export, en mode un seul thread, sans SharedArrayBuffer ni modification de l’isolation des pages d’authentification. Les fichiers du moteur sont servis par le même domaine, copiés depuis les dépendances npm verrouillées par `pnpm media:prepare` avant `dev`/`build` ; aucun CDN tiers n’est requis.
- L’export navigateur réserve un job à coût zéro contenant la version immuable. Il ne peut pas être revendiqué par un worker natif. Le MP4 sauvegardé est réinspecté côté serveur ; propriété, format, durée et dimensions sont vérifiés avant publication du résultat. Une annulation interrompt le Web Worker et le transfert ; fermer la page annule au mieux et les jobs orphelins expirent après deux heures. Le MP4 local reste téléchargeable si sa sauvegarde échoue. Aucune nouvelle migration n’est nécessaire pour ce changement.

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

Le mode gratuit est la configuration par défaut : `DIRECTOR_ENABLE_PAID_GENERATION` absent ou `false` interdit la soumission même si une clé et un tarif sont présents. Aucune génération au chargement ni pendant le montage. Le serveur exige fournisseur, version, confirmation facturable, droits et plafond en centimes USD. Les coûts sont réservés sous verrou propriétaire : 25 USD/mois par défaut, trois tâches actives et cent traitements de production par jour. Une clé UUID empêche de facturer deux fois la même demande. Les mêmes identifiants avec un contenu différent sont refusés.

Le worker persiste `SUBMITTING` **avant** l’appel payant. Un accusé de réception perdu ou un redémarrage à ce stade entraîne un échec à vérifier manuellement ; aucune nouvelle soumission automatique. Un reçu enregistré est interrogé après redémarrage. Six reprises avec attente croissante sont possibles pour les erreurs temporaires de suivi. Une annulation révoque le jeton local et empêche la publication tardive ; Higgsfield reçoit aussi une demande d’annulation. La documentation Veo ne garantit pas cette annulation distante : le traitement peut rester facturable. Les échecs/annulations gardent la réservation de coût ; prévoir un rapprochement avec les factures et des limites externes sur les comptes fournisseurs.

## Activation et mise en production

Le mode courant utilise uniquement le frontend Vercel, l’API NestJS persistante et le stockage privé déjà déployés. **Ne pas créer le service Render optionnel** pour utiliser Director gratuitement. Le statut réel de publication est suivi dans [production-release.md](production-release.md).

1. Utiliser Node 24 et pnpm 11.3.0 : `pnpm install --frozen-lockfile`, puis `pnpm db:generate` et `pnpm db:deploy` selon le pipeline existant. Les migrations Director précédentes restent nécessaires sur une nouvelle installation ; cette modification n’en ajoute pas. Ne pas réinitialiser la production.
2. Conserver `DATABASE_URL`, `STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` dans l’API, les variables publiques d’authentification et `NEXT_PUBLIC_API_URL` dans le frontend. Aucun nouvel identifiant requis. Le secret Supabase ne doit jamais être public.
3. Conserver le bucket **privé** `actor-private`. Vérifier les limites globales Supabase (au moins la taille souhaitée jusqu’à 50 MiB) et les types JPEG/PNG/WebP, MP4/MOV, MP3/WAV/M4A/OGG. Aucune politique publique de lecture ou d’écriture. Les URLs signées doivent accepter la lecture CORS depuis le domaine frontend. Les quotas de stockage, trafic et hébergement existants restent applicables ; « sans worker payant » ne signifie pas quotas illimités.
4. Laisser `DIRECTOR_ENABLE_PAID_GENERATION=false`, les clés Director vides et les tarifs à zéro. **Aucune génération IA gratuite n’est promise.** Importer des clips produits séparément ou déjà disponibles.
5. `pnpm build` prépare automatiquement les fichiers du moteur dans `apps/web/public/director-media/v1/`, puis compile Next/Nest. Déployer par les pipelines habituels de l’API et du frontend. Le runtime API a besoin de `mediainfo.js` et de son WASM, installés par pnpm, sans binaire natif. Ne pas remplacer la commande de build web par `next build` seul. Un démarrage direct `next dev` exige au préalable `pnpm --filter @actbyme/web media:prepare`.
6. Effectuer la recette sur un compte autorisé : créer un projet, importer photos/vidéo/audio, attendre la vérification, associer chaque clip, exporter le JSON puis assembler le MP4. Le bouton ne dépend plus de `DirectorWorker`. L’export local conserve le montage et les métadonnées de la version d’origine, même si l’utilisateur poursuit son édition.

### Option conservée pour un besoin futur

Le processus `pnpm --filter @actbyme/api worker:director`, son Dockerfile et [l’exemple Render](render-worker.yaml) restent disponibles pour les rendus serveur ou les API vidéo payantes. Ils ne démarrent pas automatiquement et ne sont pas nécessaires au parcours gratuit. Ne créer aucun service supplémentaire sans décision distincte du propriétaire.

Pour une activation future volontaire des API vidéo : configurer `DIRECTOR_ENABLE_PAID_GENERATION=true` **dans l’API et le worker optionnel**, les clés serveur et les prix conservateurs `DIRECTOR_VEO_*` ou `DIRECTOR_HIGGSFIELD_*`, puis le plafond mensuel. Ne jamais utiliser `NEXT_PUBLIC_`. Vérifier les droits régionaux, accès API et coût réel avec une génération explicitement autorisée. Les connecteurs et leurs contraintes documentées sont conservés ; aucune dépense n’a été exécutée pendant cette adaptation.

### Logiciels libres distribués

Versions verrouillées : `@ffmpeg/ffmpeg` 0.12.15, `@ffmpeg/core` 0.12.10 et `mediainfo.js` 0.3.7. Notices et licences accessibles dans `/director-media/NOTICES.md` et `apps/web/public/director-media/licenses/`, avec liens vers les sources et instructions de construction correspondantes. Le wrapper est MIT, MediaInfo.js BSD-2-Clause et le core FFmpeg suit la GPL et les licences de ses bibliothèques. Voir [FAQ officielle FFmpeg.wasm](https://ffmpegwasm.netlify.app/docs/faq/) et [API MediaInfo.js](https://mediainfo.js.org/docs/getting-started/usage/).

## Limites explicites

- La 3D est une prévisualisation de mise en scène simplifiée. Les personnages sont des mannequins, même lorsqu’un acteur réel est sélectionné. Aucun mouvement facial ni reconstruction de bâtiment à partir de photos.
- L’IA interprète des prompts ; les trajectoires ne conditionnent pas numériquement le moteur. L’identité exacte, les détails cachés, la performance et la synchronisation labiale exigent une validation humaine.
- Deux transitions d’export : coupe et fondu au noir, avec durée finale conservée. Pas de fondu enchaîné avec chevauchement, étalonnage avancé, rendu typographique ni édition de waveform.
- Les fichiers audio importés sont réellement mixés ; aucune génération de voix ou musique payante n’est ajoutée. Les performances vidéo servent de références et de sources audio ; elles ne deviennent pas un squelette 3D reconstruit.
- Un import de clip est requis pour chaque plan si l’API vidéo ne supporte pas sa durée. Les durées ou formats incompatibles provoquent un message explicite, sans recadrage silencieux ni segmentation facturable automatique.
- Projet éditable : dix minutes, soixante plans, vingt personnages et 120 éléments de pistes. Export navigateur : 120 secondes, trente plans, 128 MiB cumulés de clips/sons utilisés, sortie 720p H.264/AAC à 24 images/s et 50 MiB maximum. Ces limites sont affichées et contrôlées côté client et à la réservation serveur ; aucun tronquage silencieux. Un fichier est limité à 50 MiB (image : 15 MiB), le projet à 200 ressources / 2 GiB. L’encodage est plus lent que sur un serveur natif et dépend de la mémoire disponible ; l’onglet doit rester ouvert. Un délai de vingt minutes par commande et de 110 minutes pour le moteur borne les traitements bloqués. Les projets plus grands gardent préparation, prévisualisation et dossier JSON. Cible principale : navigateur de bureau avec WebGL2. Sans WebGL, carte, directions, timeline et production restent accessibles.
- Les brouillons locaux sont des données de projet sur l’appareil, sans clés ni URL signées. Prévoir une politique de conservation et un nettoyage des objets orphelins après suppressions manuelles en base ; aucun nettoyeur récurrent externe n’est créé.
- Le contrôle de coût est applicatif et conservateur ; il ne remplace pas une limite chez le fournisseur et ne garantit pas sa facture.

Les résultats de tests et les limites de vérification sont consignés dans [verification.md](verification.md).
