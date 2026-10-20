# ACTBYME Director — publication en production

Publication vérifiée le 19 octobre 2026, complétée par une recette authentifiée le 20 octobre 2026. Publication demandée par le propriétaire sur la production existante, sans staging ni nouveau service payant.

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
- Schéma public de l’API : nouvelle route de finalisation présente après déploiement. La recette authentifiée ci-dessous vérifie ensuite les imports, la reconnexion, le stockage privé et deux exports sur la production réelle.

Détails des tests, de l’architecture et des limites : [verification.md](verification.md) et [guide d’exploitation](README.md).

## Base et stockage

Cette adaptation n’ajoute aucune migration. Le pipeline de la livraison initiale avait appliqué `20261017120000_virtual_director`, `20261017130000_virtual_director_utc` et `20261019160000_director`. La dernière est enregistrée comme terminée à `2026-10-19T18:13:55.442621Z` dans `_prisma_migrations`. Les six tables Director sont présentes dans la base ACTBYME. Aucune réinitialisation ni suppression de données existantes n’a été exécutée.

Le contrôle initial du bucket Supabase `actor-private` confirmait `public: false`. Aucune politique publique n’a été ajoutée ou modifiée. Ses limites locales de fichier et MIME héritent des réglages globaux Supabase ; l’application borne désormais les imports et résultats à 50 MiB, les images à 15 MiB. La préparation peut atteindre dix minutes ; l’export navigateur est borné à 120 secondes, trente plans, 128 MiB de clips/sons utilisés et une sortie 720p de 50 MiB maximum. Garder l’onglet ouvert pendant le rendu.

## Recette authentifiée du 20 octobre 2026

Après autorisation explicite du propriétaire, un seul compte client temporaire et un seul projet privé ont été créés puis supprimés. Le navigateur Chromium utilisait le domaine public, l’authentification Supabase réelle, l’API publiée et le bucket privé réel. Les médias étaient synthétiques : une image PNG, deux clips de couleurs distinctes et un WAV. Aucun email de confirmation, profil d’acteur public, demande de prestation ou appel IA payant n’a été déclenché. Les réponses réseau d’authentification, de stockage et d’API n’étaient pas simulées ; seuls les éventuels appels de génération payante étaient bloqués par la recette, et aucun n’a été tenté.

**19 contrôles réussis, aucun échec fonctionnel, aucune exception JavaScript.**

| Parcours                   | Résultat observé                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connexion et création      | Connexion par mot de passe dans l’interface ; projet enregistré côté serveur. Aucun worker Director disponible, export navigateur disponible.                                                                                     |
| Caméra et timeline         | Hauteur modifiée, waypoint ajouté, deux plans de quatre secondes ; sauvegarde automatique puis récupération après rechargement.                                                                                                   |
| Ressources et audio        | PNG, deux MP4 et WAV inspectés `READY` par l’API ; associations indépendantes des plans et véritable lecture audio synchronisée.                                                                                                  |
| Reconnexion                | Session révoquée, état navigateur effacé, nouvelle connexion ; caméra, clips et piste audio récupérés depuis le serveur.                                                                                                          |
| Dossier de production      | Téléchargement JSON réel, deux plans et références sauvegardées ; aucune URL privée ou signature exportée.                                                                                                                        |
| Premier MP4                | Assemblage dans le navigateur, sauvegarde privée puis téléchargement ; H.264/AAC, **8 secondes, 1280×720**, ordre des couleurs vérifié par décodage.                                                                              |
| Remplacement individuel    | Seul le second plan changé ; premier plan et premier résultat conservés. Second MP4 vérifié avec la nouvelle image et la même durée.                                                                                              |
| Confidentialité et erreurs | Lien signé valide pendant 300 secondes ; accès public et signature altérée refusés. Lecture directe des tables via Data API refusée. Écriture sur ancienne version : HTTP 409 ; faux MP4 : inspection `FAILED`, lecture HTTP 404. |

Les cycles complets d’export, comprenant encodage, transfert, inspection et publication du résultat, ont pris environ 41 puis 34 secondes dans le navigateur automatisé utilisé. Ces valeurs portent sur ce petit montage synthétique ; elles ne prédisent pas le temps de traitement de médias plus lourds ou sur un autre ordinateur.

Le nettoyage a initialement rencontré une ancienne session déjà révoquée pendant le test de reconnexion. Une nouvelle session temporaire a permis la révocation globale, puis **sept objets de stockage, le projet et le compte ont été supprimés**. L’absence du compte Auth, de l’utilisateur applicatif, du projet, de ses assets et de ses jobs a été vérifiée, ainsi que le répertoire d’uploads vide. Aucun identifiant secret ni état d’authentification n’a été conservé dans le rapport.

## Points à améliorer et limites de recette

Ces constats proviennent de la recette initiale ; les correctifs d’interface livrés ensuite sont décrits ci-dessous.

- **Démarrage de l’API :** le contrôle initial de cette recette a pris environ 52 secondes ; les contrôles publics précédents avaient déjà observé un premier appel expiré à 35 secondes, puis des réponses rapides une fois l’API réveillée. Afficher un état de réveil explicite et proposer une reprise du chargement. La cause exacte et le plan d’hébergement n’ont pas été confirmés par les logs Render.
- **Retour après connexion :** la connexion ouverte depuis Director redirige actuellement vers `/profile`. Préserver la destination demandée éviterait de devoir revenir à Director.
- **Accessibilité de la connexion :** la fenêtre existante ne présente pas de rôle de dialogue, ne transfère pas le focus et ne se ferme pas avec Échap dans la recette publique. Corriger la sémantique et la gestion du clavier.
- **Responsive :** la recette publique relève un débordement horizontal de 9 à 10 pixels sur certains écrans et espaces, notamment Generate, y compris à 1440 pixels. Corriger les contraintes de largeur sans supprimer le défilement nécessaire à la timeline.

Pour la suite du produit : mettre en avant le parcours gratuit « importer → affecter → prévisualiser → exporter », guider la préparation des références, puis ajouter miniatures, formes d’onde audio et outils de texte/logo/CTA. Améliorer aussi l’estimation du rendu et la réutilisation des segments inchangés pour accélérer les exports suivants.

Cette recette confirme le parcours gratuit sur Chromium. Les moteurs IA restent désactivés et non validés par une génération réelle ; le consentement et les prestations avec un véritable acteur, Safari/Firefox, les projets aux limites de taille et la charge concurrente n’ont pas été recettés en production. Les tests locaux restent la couverture de ces règles et des autres cas automatisés documentés, sans remplacer ces validations externes.

## Correctifs d’interface après la recette

- **Connexion au studio :** message explicite après huit secondes, possibilité de relancer le chargement et annulation de la lecture précédente. Les lectures initiales des projets disposent de deux essais maximum, de 45 secondes chacun, pour les interruptions réseau et les erreurs de passerelle temporaires. Les créations, sauvegardes et générations ne sont jamais soumises à nouveau automatiquement. La consultation périodique ne démarre pas lorsqu’un projet n’a pas pu être chargé et ne superpose pas ses requêtes.
- **Connexion utilisateur :** retour à Director après authentification, y compris depuis la démo. L’enregistrement d’une démo anonyme ouvre maintenant la connexion avant de soumettre une création ; les réglages restent présents après la connexion par mot de passe. Le callback Google existant `/profile` est conservé, avec une destination interne à usage unique, limitée à cinq minutes dans le même onglet. Les destinations externes ou expirées sont ignorées.
- **Accessibilité :** véritable dialogue modal nommé, focus initial sur l’email, boucle Tab/Maj+Tab, fermeture par Échap et retour du focus au bouton d’origine. Les raccourcis de montage ne se déclenchent pas pendant un dialogue.
- **Largeur :** le champ d’import est réellement masqué. La règle générale de largeur des champs ne peut plus étendre cet élément invisible au-delà du panneau Ressources. La timeline conserve son défilement horizontal propre.
- **Production simplifiée :** l’export MP4 gratuit et l’état des plans sont placés en premier. La génération IA facultative et les limites détaillées restent repliées. La confirmation des droits est maintenue. L’avancement d’encodage utilise le temps de sortie signalé par FFmpeg, avec pourcentage et temps écoulé ; aucune estimation arbitraire du temps restant n’est affichée.

La recette automatisée comprend désormais **18 parcours Chromium**, dont le montage MP4 réel, l’annulation, le remplacement d’un plan, le clavier, le retour après connexion, les destinations de redirection, les connexions lentes, la reprise manuelle et l’absence de débordement de 320 à 1440 pixels. Les neuf parcours existants de Director Studio et Virtual Director font partie de cette suite. Aucune migration, dépendance ou configuration serveur supplémentaire n’est nécessaire à ces correctifs.

Aucune nouvelle variable ni clé n’est nécessaire au parcours gratuit si le stockage Supabase privé existant est déjà configuré. Le [guide courant](README.md#activation-et-mise-en-production) documente le build, la vérification du bucket et les éventuelles activations futures, qui restent séparées du mode gratuit.
