# ACTBYME Director — publication en production

Vérification du 19 octobre 2026. Publication demandée par le propriétaire sur la production existante, sans staging ni nouveau service payant.

## Version sans worker supplémentaire

- Commit applicatif : `66bad13bf7d8f237686a9328f02d9bd597b03df7`, poussé sur `main` de `Christophe-DC/ActByMe`.
- Frontend Vercel `actbyme-web` : `dpl_9C9fNrndeTwNBXw7bAjFhURz79Yy`, état `READY`, cible `production`. Publication terminée le 19 octobre à 18:55:26 UTC ; statut GitHub Vercel réussi.
- Accueil : <https://www.actbyme.com/director>. Démo : <https://www.actbyme.com/director/demo>.
- API : <https://api.actbyme.com>. Le schéma public expose désormais dix-sept chemins Director, dont `POST /director-projects/{id}/jobs/{jobId}/browser-result`, ce qui confirme la publication du nouveau contrôleur.
- Moteur WebAssembly accessible sur le domaine de production, HTTP 200 et MIME `application/wasm`.

Les imports sont vérifiés par MediaInfo.js dans l’API existante. L’assemblage MP4 s’effectue avec FFmpeg.wasm dans un Web Worker du navigateur. **Aucun service Render supplémentaire n’est requis ou créé.** Les anciens fichiers de worker natif sont conservés comme option ; leur création et leur coût ne font plus partie de l’activation de Director.

La génération IA payante reste verrouillée par défaut (`DIRECTOR_ENABLE_PAID_GENERATION` absent ou `false`), même avec une clé et un prix renseignés. Aucun appel fournisseur payant n’a été effectué. Les services existants conservent leurs quotas de stockage, transfert et calcul.

## Vérifications de cette publication

- 26 tests partagés, 84 tests backend et 12 tests Chromium réussis, sans test ignoré ; format, lint, TypeScript et build complet réussis.
- Parcours local complet : création, caméra, imports privés inspectés, audio, persistance, dossier JSON, annulation d’export, véritable assemblage WebAssembly, sauvegarde et décodage du MP4, puis remplacement d’un seul plan sans perdre les autres. Aucun heartbeat Director n’est présent pour le parcours gratuit.
- Démo ouverte dans Chromium sur le domaine public : scène WebGL chargée, puis moteur de production chargé depuis le même domaine. Encodage et lecture d’un MP4 synthétique de **1 seconde, 1280×720, 14 585 octets** dans la mémoire du navigateur. Ce contrôle n’a créé ni compte, ni projet, ni upload en production et n’a appelé aucune IA.
- Schéma public de l’API : nouvelle route de finalisation présente après déploiement. Les contrôles d’accès et de stockage sont couverts par la recette locale ; ils ne sont pas présentés comme intégralement recettés avec un compte de production.

Détails des tests, de l’architecture et des limites : [verification.md](verification.md) et [guide d’exploitation](README.md).

## Base et stockage

Cette adaptation n’ajoute aucune migration. Le pipeline de la livraison initiale avait appliqué `20261017120000_virtual_director`, `20261017130000_virtual_director_utc` et `20261019160000_director`. La dernière est enregistrée comme terminée à `2026-10-19T18:13:55.442621Z` dans `_prisma_migrations`. Les six tables Director sont présentes dans la base ACTBYME. Aucune réinitialisation ni suppression de données existantes n’a été exécutée.

Le contrôle initial du bucket Supabase `actor-private` confirmait `public: false`. Aucune politique publique n’a été ajoutée ou modifiée. Ses limites locales de fichier et MIME héritent des réglages globaux Supabase ; l’application borne désormais les imports et résultats à 50 MiB, les images à 15 MiB. La préparation peut atteindre dix minutes ; l’export navigateur est borné à 120 secondes, trente plans, 128 MiB de clips/sons utilisés et une sortie 720p de 50 MiB maximum. Garder l’onglet ouvert pendant le rendu.

## Limite de recette authentifiée

La création puis la suppression d’un compte et d’un projet temporaires en production avaient été refusées par la vérification automatique d’approbation, qui exigeait une autorisation distincte du déploiement. Cette opération n’a pas été réessayée ; aucun compte ou projet de recette n’a été créé en production. La reconnexion et l’import dans le bucket réel restent à recetter sur un compte autorisé. Les sessions et le transport du stockage sont contrôlés par des fixtures dans les tests locaux, avec une véritable base PostgreSQL et les véritables moteurs de traitement.

Aucune nouvelle variable ni clé n’est nécessaire au parcours gratuit si le stockage Supabase privé existant est déjà configuré. Le [guide courant](README.md#activation-et-mise-en-production) documente le build, la vérification du bucket et les éventuelles activations futures, qui restent séparées du mode gratuit.
