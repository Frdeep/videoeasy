# VideoEasy — plateforme et nouveau design

## Livré sur cette branche

L’accueil utilise les codes de navigation des plateformes vidéo : fond blanc, barre de recherche, rail latéral, catégories filtrables et grille de vignettes. La page Dailymotion fournie a été consultée dans Chromium. Il s’agit d’une interface VideoEasy, pas d’une reproduction certifiée à 100 % des deux services. Aucun logo, compte, contenu ou compteur de Dailymotion/YouTube n’est repris. Les photos d’inspiration sont identifiées comme telles ; aucune n’est présentée comme une génération ou un média client.

- Inscription et connexion par mot de passe Supabase, avec confirmation d’e-mail ; lien magique conservé pour accès sans mot de passe. Minimum de 12 caractères à l’inscription. La connexion reste compatible avec les mots de passe existants.
- Profil personnel modifiable, enregistré côté serveur pour l’utilisateur vérifié.
- Catalogue de modèles côté base : activation, coût en crédits et formules autorisées administrables. Un seul modèle **simulé**, désactivé par défaut, est initialisé. Aucun identifiant de modèle Kie.ai inventé.
- Demande de génération durable, idempotence par UUID et contenu, réservation des crédits et insertion de tâche dans une transaction, limites de simultanéité et suspension vérifiées côté serveur.
- Worker de test traitant les tâches simulées, succès ou échec non facturé. Aucun appel Kie.ai. Le succès produit un SVG technique clairement identifié, pas un résultat IA. Les crédits test restent requis : aucun abonnement gratuit n’est créé.
- Galerie privée avec tâches, statuts, filtre, téléchargement contrôlé par propriétaire et retrait des tâches terminées de la galerie. Le retrait est logique ; aucune suppression physique R2 n’est revendiquée.
- Adaptateur serveur R2 de téléchargement signé, limité à 60 secondes, après recherche du propriétaire en base. Le bucket reste privé. Aucun endpoint ne prend une clé d’objet ou une URL du navigateur.
- Administration réservée à une liste d’UUID configurée côté serveur : utilisateurs, suspension/réactivation, modèles, derniers jobs et audit des modifications.
- Ajustements de crédits administrateur sur une période payée active, justification obligatoire, verrou utilisateur et UUID d’opération idempotent. Un retrait ne peut pas rendre le solde négatif ni retirer les crédits réservés. Chaque ajustement inscrit un mouvement et un audit dans la même transaction.

## Configuration de test

1. Reprendre `docs/setup.md` pour Supabase et Stripe test. Appliquer dans l’ordre les migrations `202611160001_billing.sql`, puis `202611160002_platform.sql`, sur un projet de test. La seconde migration ajoute le schéma privé `platform` et le type de mouvement `admin_adjust` à la comptabilité existante.
2. Activer l’authentification e-mail/mot de passe et la confirmation e-mail dans Supabase. Conserver l’URL exacte `/auth/callback` dans les redirections autorisées. Le catalogue Stripe reste différé selon la décision fiscale précédente.
3. Configurer les UUID réellement autorisés dans `ADMIN_USER_IDS` (séparés par des virgules), exclusivement côté serveur. Le navigateur ne peut pas s’attribuer un rôle. Tous les modèles sont fermés par défaut.
4. Pour les simulations seulement : `APP_ENV=test`, `GENERATION_PROVIDER=mock`. Activer le modèle de test depuis `/admin`, avec sa justification et ses formules. Un utilisateur doit avoir un abonnement test payé et synchronisé récent (<15 minutes), donc une vraie allocation test éligible, pour réserver une tâche.
5. Exécuter `npm run worker:test` avec `.env.local` configuré. Un passage traite au plus 100 tâches. L’exécuteur est explicite : le navigateur ne déclenche aucun worker privilégié. Un prompt commençant par `[test-failure]` simule un échec non facturé avec restitution. Ne pas utiliser ce mécanisme comme adaptateur fournisseur réel.
6. Pour préparer R2, renseigner `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` dans les secrets serveur ; le bucket doit être privé. Les signatures R2 réelles restent à tester avec ce compte. Aucun secret ne doit être envoyé dans le chat ou ajouté au dépôt.

`KIE_API_KEY` est préparée dans l’exemple mais **n’est pas encore utilisée**. Une valeur ajoutée ne déclenche pas de dépense. `GENERATION_PROVIDER=kie` n’active rien : le serveur refuse les adaptateurs non implémentés.

## Résilience et limites explicites

Une tâche est claimée par verrou `FOR UPDATE SKIP LOCKED`, puis marquée running avant traitement. Plusieurs workers ne la prennent pas deux fois. Une interruption après claim laisse volontairement la tâche running et la réservation conservée : un opérateur doit vérifier son résultat avant toute récupération. Aucune nouvelle tentative de fournisseur ni restitution aveugle n’est faite.

Le débit est un coût fixe capturé à la réservation ; la vérification de coût réel Kie.ai, les échecs facturés, la récupération des tâches au résultat incertain, les callbacks, l’import de médias fournisseur vers R2 et les suppressions physiques/rétention restent à réaliser. Les coûts fournisseur et marges financières ne sont pas inventés à partir des seuls crédits. Une interface financière complète nécessite des coûts réels vérifiés. Les listes courantes sont plafonnées à 100 lignes ; pagination et recherche administrateur à étendre avant montée en charge.

L’API ne propose pas d’upload d’image de référence non validé. L’adaptateur R2 ne télécharge aucune URL fournisseur arbitraire, évitant d’introduire une surface SSRF incomplète. Le schéma `platform` est privé, RLS activée et aucun droit accordé aux rôles navigateur.

## Vérifications

63 tests réussis, dont les tests PostgreSQL de demandes concurrentes, idempotence, paiement requis, suspension, modèle fermé, worker refusé hors test, succès/échec simulé, ajustement administrateur unique et refus des écritures client. Les tests de routes vérifient le contrôle propriétaire avant toute signature de téléchargement et le refus des identifiants invalides. Les téléchargements R2 de ces tests utilisent un signataire simulé ; aucun accès réel à R2.

TypeScript et build Next.js passent. Smoke Chromium sur ordinateur et mobile : recherche, filtre, navigation, formulaire d’inscription, accès privés redirigés sans session, aucun débordement horizontal à 390 px et aucune erreur JavaScript. Captures dans `docs/previews/`.

Non réalisés : inscription réelle dans le projet Supabase, tests avec compte administrateur connecté, souscription réelle test, récupération/suppression d’un véritable fichier R2, génération Kie.ai, hébergement et production. Les 63 tests ne constituent pas une validation de ces services externes.

## Sources des photos

Photographies téléchargées depuis Unsplash, utilisées comme illustrations d’inspiration, sans les présenter comme des productions IA VideoEasy. Licence et conditions : https://unsplash.com/license . Sources des fichiers (suffixe `?w=900&q=85&fit=crop`) :

- lake.jpg : https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1
- city.jpg : https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b
- night.jpg : https://images.unsplash.com/photo-1519608487953-e999c86e7455
- mountain.jpg : https://images.unsplash.com/photo-1501785888041-af3ef285b470
- ocean.jpg : https://images.unsplash.com/photo-1500530855697-b586d89ba3ee
- stars.jpg : https://images.unsplash.com/photo-1469474968028-56623f02e42e

Les noms de fichiers sont des identifiants internes ; ils ne définissent pas le résultat attendu d’un modèle.

## Correctif du parcours d’inscription

Les journaux Supabase ont confirmé des inscriptions réussies suivies de connexions refusées avec `email_not_confirmed`. Le parcours affiche désormais une page dédiée de confirmation, les étapes à suivre dans la boîte mail et un message spécifique pour une adresse non confirmée ou une limitation d’envoi. L’écran de confirmation ne réaffiche plus le formulaire d’inscription. Un état de soumission désactive le bouton pendant la demande.

Les pages compte et administration redirigent elles-mêmes les visiteurs non connectés, car leur rendu peut démarrer indépendamment du layout. La connexion accepte aussi les mots de passe existants de moins de 12 caractères ; l’inscription conserve le minimum de 12.

Validation du correctif : 72 tests passent, compilation réussie, smoke Chromium mobile des messages et de la redirection du compte. Aucun e-mail supplémentaire n’a été envoyé par les tests ; les résultats du fournisseur sont simulés dans la suite automatisée.
