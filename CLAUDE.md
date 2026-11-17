# VIDEOEASY — Bible de reprise pour Claude Code

**Fondateur : Cisco. Langue de travail : français. État de référence : 17 novembre 2026.**

Ce document est une consigne de travail complète. Lis-le avant de modifier le projet. Il distingue la vision commerciale, le code effectivement livré, les connexions observées et les travaux restants. Ce n’est pas une attestation que toute la plateforme est prête à vendre.

## 1. Ta mission et ta façon de travailler

Tu es le développeur principal de VideoEasy. Reprends le dépôt existant et transforme progressivement la base actuelle en plateforme commerciale fiable de génération privée de vidéos et d’images IA.

Travaille concrètement : inspecte, développe, migre, teste, corrige et documente. Ne te limite pas à proposer un plan. Ne recommence pas tout dans un nouveau framework et ne remplace pas une intégration fonctionnelle sans raison vérifiée.

Cisco est débutant sur les interfaces techniques. Explique ce qu’il doit faire avec des mots simples et une manipulation à la fois. Donne le nom exact du service, du projet, du bouton et du champ. Appuie-toi sur les captures reçues ; n’invente pas l’emplacement d’un bouton. Après une action utilisateur, vérifie le résultat disponible avant de lui annoncer qu’une connexion fonctionne.

Avance de façon autonome sur les tâches réversibles déjà autorisées. N’interromps pas le travail pour chaque choix technique courant. Demande seulement les informations ou décisions qui bloquent réellement la prochaine étape. Une dépense réelle, une modification financière irréversible ou un élargissement d’accès ne doivent jamais être présentés comme une simple vérification technique.

À chaque étape importante, distingue :

- code écrit ;
- configuration enregistrée ;
- migration appliquée ;
- test simulé réussi ;
- test réellement effectué sur le service externe ;
- vérification restant à faire avec le compte du propriétaire.

Ne prétends jamais avoir testé un paiement, une génération, un e-mail reçu ou une connexion réelle lorsque seuls des mocks ou des métadonnées ont été vérifiés.

## 2. Correction prioritaire : Stripe est désormais annoncé en réel

**Dernière correction de Cisco : « Stripe n’est plus en test ». Cette information remplace l’ancienne intention de rester uniquement en sandbox.**

Trois faits distincts doivent être conservés :

1. Cisco indique avoir passé Stripe en mode réel.
2. Lors de la dernière lecture, le MCP Stripe de cette session ne donnait accès qu’au compte nommé « environnement de test Video Easy », avec `livemode=false`. Cela décrit les permissions de cette connexion, pas l’ensemble des comptes possédés par Cisco.
3. Le code actuellement livré refuse encore les clés, événements et ressources Stripe live. Il a initialement été développé pour le test.

**Ne présente donc pas Stripe comme toujours volontairement limité au test, mais ne présente pas non plus les paiements réels comme opérationnels.** Il existe une transition vers le réel à terminer et à valider.

Aucune variable `STRIPE_*` n’apparaissait dans la dernière liste de variables Vercel consultée pendant la préparation de cette bible. Cisco a pu configurer des éléments directement dans Stripe ; il faut les inspecter, sans supposer qu’ils sont raccordés à l’application.

Avant toute action Stripe spécifique : identifier le bon compte réel, son environnement, les produits et tarifs existants, le portail et les destinations webhook. Ne pas réutiliser l’identifiant du sandbox pour le réel. Ne pas créer de doublons. Ne pas déclencher un encaissement réel pour « voir si ça marche » sans accord explicite sur cette dépense.

## 3. Vision produit

VideoEasy est un SaaS commercial privé. Le client :

1. crée son compte et confirme son adresse e-mail ;
2. choisit un abonnement mensuel ;
3. paie via Stripe ;
4. reçoit des crédits après confirmation serveur d’une facture éligible payée ;
5. choisit un modèle IA autorisé pour sa formule ;
6. décrit une image ou une vidéo et règle les paramètres réellement disponibles ;
7. lance une génération avec réservation de crédits ;
8. suit son avancement ;
9. retrouve le résultat dans sa galerie privée et peut le télécharger.

Le client ne fournit jamais sa propre clé Kie.ai et n’a pas à ouvrir de compte fournisseur. Les dépenses API sont gérées par VideoEasy.

Le service ne doit pas ouvrir de génération gratuite au lancement. Pas de crédits illimités, d’essai gratuit, de packs supplémentaires ni d’abonnements annuels dans le périmètre initial. Les simulations techniques ne sont jamais présentées comme des créations IA réelles.

La galerie est privée. La page d’accueil d’inspiration n’autorise pas la publication des médias des clients. Ne transforme pas implicitement VideoEasy en réseau social public.

Modes de création cibles : texte vers vidéo, image vers vidéo, texte vers image et image vers image lorsque le modèle le permet. Les uploads de référence, durées, résolutions et options doivent être validés pour chaque modèle. Ils ne sont pas encore tous présents dans l’API actuelle.

Une ouverture sur invitation ou validation manuelle avait été envisagée pour le lancement. Ce contrôle n’est pas livré : les inscriptions e-mail sont actuellement activées. Distinguer galerie privée, accès à la génération payante et inscription sur invitation ; ce sont trois règles différentes.

## 4. Offres commerciales de référence

| Formule  | Prix mensuel envisagé | Crédits mensuels | Générations simultanées |
| -------- | --------------------: | ---------------: | ----------------------: |
| Standard |                  23 € |            1 000 |                       1 |
| Metal    |                  35 € |            1 500 |                       2 |
| Gold     |                  56 € |            2 500 |                       3 |

Les prix sont envisagés TTC. La situation fiscale de l’entreprise n’est pas documentée comme finalisée dans cette reprise. **Ne configure pas automatiquement une TVA française de 20 %.**

Les modèles accessibles sont contrôlés côté serveur par formule. Orientation prévue : économiques pour Standard, économiques et standards pour Metal, modèles premium compatibles pour Gold. Aucun modèle précis n’est garanti avant vérification de disponibilité, coût et droits d’utilisation.

Ne promets pas une priorité de traitement si le fournisseur et notre ordonnanceur ne permettent pas de la garantir.

Changements de formule et proratisations : désactivés dans l’implémentation initiale. Annulation à la fin de la période déjà payée. Une nouvelle politique de changement doit définir explicitement sa facturation et son effet sur les crédits avant activation.

## 5. Économie des crédits et rentabilité

Les crédits VideoEasy sont des unités internes d’usage, pas des euros détenus pour le client, un portefeuille Stripe, une carte prépayée ou une créance remboursable.

Hypothèse de gestion initiale : **100 crédits représentent 1 € de budget fournisseur estimé**. Ce n’est ni un taux de remboursement client ni une preuve de coût réel.

| Formule  | Enveloppe API théorique avec cette hypothèse |
| -------- | -------------------------------------------: |
| Standard |                               10 € / période |
| Metal    |                               15 € / période |
| Gold     |                               25 € / période |

Objectif : au moins **30 % de marge contributive sur le chiffre d’affaires HT**, après coûts variables directs. La marge contributive n’est pas le bénéfice net.

Coûts à prendre en compte : générations réellement facturées, taux de change éventuel, frais de paiement et de Billing applicables, stockage/transfert, remboursements, litiges et autres coûts directement liés à l’usage. Ajouter ensuite les frais fixes : hébergement, outils, comptabilité, support, assurances, etc.

Le document commercial initial utilisait, à titre de simulation seulement, une TVA de 20 % et des frais Stripe de 1,5 % + 0,25 € :

| Hypothèse de simulation             | Standard |   Metal |    Gold |
| ----------------------------------- | -------: | ------: | ------: |
| CA HT si TVA 20 %                   |  19,17 € | 29,17 € | 46,67 € |
| Frais de paiement estimés           |   0,60 € |  0,78 € |  1,09 € |
| Budget API théorique                |     10 € |    15 € |    25 € |
| Reste avant les autres coûts        |   8,57 € | 13,39 € | 20,58 € |
| Marge provisoire avant autres coûts |   44,7 % |  45,9 % |  44,1 % |

Ces chiffres ne valident ni le régime fiscal réel, ni les tarifs Stripe du compte, ni la rentabilité. Recalculer avec les paramètres réels. Seuil de rentabilité : dépenses fixes mensuelles divisées par contribution moyenne réelle par client, arrondie au supérieur.

Le catalogue doit pouvoir faire évoluer les coûts futurs sans modifier rétroactivement les réservations et débits déjà enregistrés. Prévoir une marge de sécurité et des plafonds fournisseur. Ne pas activer un modèle coûteux sur la seule base d’un prix historique.

## 6. Architecture retenue

| Composant                    | Rôle                                                                    |
| ---------------------------- | ----------------------------------------------------------------------- |
| Next.js / React / TypeScript | Interface, pages privées, endpoints serveur, actions d’authentification |
| Supabase Auth                | Comptes, confirmation e-mail, sessions                                  |
| PostgreSQL Supabase          | Abonnements synchronisés, crédits, réservations, jobs, profils et audit |
| Stripe                       | Encaissement, abonnements, factures, portail client                     |
| Kie.ai                       | Fournisseur IA principal, appelé exclusivement côté serveur             |
| Cloudflare R2                | Stockage privé durable des médias                                       |
| Vercel                       | Hébergement de l’application                                            |
| GitHub                       | Source, branches, PR et CI                                              |
| Claude Code                  | Développement et maintenance ; aucun usage direct par les clients       |

Flux visé :

```text
Navigateur authentifié
  → endpoint Next.js
  → vérification utilisateur, suspension, abonnement, période et coût
  → réservation atomique des crédits + création d’un job durable
  → worker / adaptateur fournisseur
  → tâche Kie.ai asynchrone
  → vérification de l’état et du résultat
  → import du média dans R2 privé
  → finalisation des crédits et des métadonnées
  → galerie personnelle et téléchargement autorisé
```

Stripe synchronise les droits en parallèle via ses webhooks et une réconciliation périodique. L’architecture future doit permettre un autre fournisseur sans reconstruire l’authentification, les crédits ou la galerie.

## 7. Dépôt, branches et version réellement livrée

Dépôt : https://github.com/Frdeep/videoeasy

**Branche contenant l’application complète à la date de reprise : `feat/platform-workflows`.**

Dernier commit fonctionnel contrôlé et déployé :

```text
8cfdd3a7f1ad32479cb2e93aacc1c95f587e2317
fix: recover expired confirmation links and persist auth sessions
```

Cette bible peut être ajoutée dans un commit documentaire ultérieur sans changer le commit fonctionnel de référence.

Branches observées :

| Branche                        | Contenu                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `main`                         | Amorce du dépôt ; ne contient pas encore l’application complète     |
| `feat/stripe-test-integration` | Base Next.js et intégration Stripe initiale                         |
| `feat/videoeasy-studio`        | Première interface du studio et étude HeliosGen                     |
| `feat/platform-workflows`      | Ensemble cumulé : design actuel, workflows privés, corrections auth |

PR existantes :

- https://github.com/Frdeep/videoeasy/pull/1 — base Stripe ;
- https://github.com/Frdeep/videoeasy/pull/2 — première interface, empilée sur la branche Stripe ;
- https://github.com/Frdeep/videoeasy/pull/3 — plateforme et correctifs suivants, empilée sur la branche studio.

Elles ont été ouvertes en brouillon ; relire leur état courant avant fusion. Ne pas supposer qu’elles ont été fusionnées parce que le site est en ligne.

**Piège important : Vercel indiquait encore `main` comme branche suivie automatiquement pour Production. Le site a été déployé manuellement depuis la branche contenant le code.** Aligner proprement la stratégie Git/Vercel après revue des PR ; ne pas déployer aveuglément `main` et ne pas remplacer le code par l’amorce vide.

Première prise en main, dans un checkout propre :

```sh
git fetch origin
git status --short
git branch --show-current
git log -5 --oneline
```

Si tu pars d’un nouveau clone :

```sh
git clone https://github.com/Frdeep/videoeasy.git
cd videoeasy
git fetch origin
git switch feat/platform-workflows
```

Créer ensuite une branche de travail dédiée depuis cette base actuelle si nécessaire. Ne pas utiliser `reset --hard`, nettoyer des fichiers non suivis ou forcer une branche distante pour contourner une différence de versions. Si la branche a avancé depuis cette bible, analyser les nouveaux commits et préserver le travail plus récent.

## 8. Connexions et identifiants utiles

Ces identifiants servent à retrouver les bonnes ressources. **Aucune valeur de clé ou de mot de passe ne figure dans cette bible.**

### GitHub

- Propriétaire/dépôt : `Frdeep/videoeasy`.
- Branche de reprise : `feat/platform-workflows`.

### Vercel

- Compte utilisé : connexion nommée `verceldeepgitalcontact` dans l’environnement précédent.
- Équipe : `deepgitalcontact-3911s-projects`.
- Team ID : `team_GSbHooIZTHIdACd5NBTRo26M`.
- Projet : `videoeasy`.
- Project ID : `prj_UBuxufyuYNnXPowu1A1OnIV5pjNE`.
- Site : https://videoeasy-gamma.vercel.app
- Tableau de bord : https://vercel.com/deepgitalcontact-3911s-projects/videoeasy
- Réglages des environnements : https://vercel.com/deepgitalcontact-3911s-projects/videoeasy/settings/environments
- Framework : Next.js ; version Node configurée : `24.x`.
- Dernier déploiement fonctionnel contrôlé : `dpl_6rvn79doDJeKPs67jZJwAGUHmY1f`, état `READY`, cible `production`, commit `8cfdd3a…`.

Cisco a explicitement autorisé le déploiement de l’interface en production Vercel. Cela n’atteste pas que toute la plateforme est commercialement opérationnelle et n’autorise pas des achats ou encaissements de test non sollicités.

### Supabase

- Connexion Composio demandée par Cisco : **`videoeasy`**.
- Projet : **`VideoEasy`**.
- Référence du projet : `pchdggpprfnyzmcnpigy`.
- URL publique : `https://pchdggpprfnyzmcnpigy.supabase.co`.
- Dashboard : https://supabase.com/dashboard/project/pchdggpprfnyzmcnpigy
- Région observée : `eu-west-1` ; statut observé : `ACTIVE_HEALTHY`.
- Auth, base et pooler ont été contrôlés comme sains pendant la configuration.

La connexion Composio peut rendre plusieurs projets visibles : toujours sélectionner le projet VideoEasy par sa référence. Ne pas toucher à un autre projet au seul motif qu’il apparaît dans la même liste.

### Stripe

- Information actuelle de Cisco : **mode réel**.
- Seul compte visible dans la connexion MCP précédente : `acct_1UcDn8E8CwFcF746`, nommé « environnement de test Video Easy », `livemode=false`.
- Cet ID est celui du sandbox observé, **pas un identifiant à réutiliser pour un compte live non vérifié**.
- Compte réel, Price IDs réels, portail réel, secret de signature réel et raccordement effectif : à inspecter et confirmer.

Le planificateur officiel Stripe avait été utilisé et son plan accepté pour la phase initiale. Voir `docs/architecture.md`. Ne pas recycler automatiquement un `guide_id` d’une ancienne session dans un nouvel appel de planification.

### Kie.ai

- Site : https://kie.ai/
- Documentation : https://docs.kie.ai/
- Catalogue : https://kie.ai/market
- Tarifs : https://kie.ai/pricing
- Clé enregistrée par Cisco dans Vercel sous `KIE_API_KEY`, comme variable sensible de Production.
- La présence de cette variable a été vérifiée sans afficher sa valeur.
- **Validité auprès de Kie.ai, crédit fournisseur, modèle activé et génération réelle : non validés.**

### Cloudflare R2

Architecture choisie et dépendances S3 présentes. Aucun bucket, compte R2, credential, objet réel ou transfert fournisseur→R2 n’est documenté comme effectivement validé. Il faut inspecter les ressources disponibles, sans en inventer les identifiants.

### Portabilité des MCP

Claude Code n’hérite pas automatiquement des connexions du précédent assistant. Découvrir les outils disponibles, leurs schémas et les comptes autorisés dans la nouvelle session. Les alias de compte et identifiants de ressource ci-dessus servent à retrouver la cible ; les IDs de session des outils ne sont pas portables.

Si Composio est disponible, rechercher Supabase et sélectionner la connexion `videoeasy`. Ne pas conclure à une absence d’accès Supabase avant cette recherche. Si un outil permet l’action, le privilégier à un script API improvisé. Après une écriture au résultat incertain, vérifier l’état avant toute relance.

## 9. Variables d’environnement et secrets

Dernière lecture des métadonnées Vercel pendant cette reprise :

| Variable                        | État observé | Environnement | Type observé |
| ------------------------------- | ------------ | ------------- | ------------ |
| `KIE_API_KEY`                   | Présente     | Production    | Sensitive    |
| `DATABASE_URL`                  | Présente     | Production    | Sensitive    |
| `NEXT_PUBLIC_SUPABASE_URL`      | Présente     | Production    | Encrypted    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Présente     | Production    | Encrypted    |
| `APP_URL`                       | Présente     | Production    | Encrypted    |

`APP_URL` a été réglée sur `https://videoeasy-gamma.vercel.app`. La variable au nom historique `NEXT_PUBLIC_SUPABASE_ANON_KEY` reçoit la clé publique/publishable du projet ; ce nom est celui attendu par le code existant.

**Présence de `DATABASE_URL` ne signifie pas que sa syntaxe, le mot de passe, le mode pooler et la connexion depuis Vercel ont été entièrement validés.** Cisco l’a saisie lui-même. Il faut vérifier réellement l’accès du serveur à la base, sans lui demander de copier cette adresse dans le chat.

Variables prévues dans `.env.example`, à inspecter/configurer selon la phase :

| Variable                         | Usage et règle                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `APP_URL`                        | Origine exacte de l’application, utilisée pour les liens et contrôles d’origine        |
| `NEXT_PUBLIC_SUPABASE_URL`       | URL publique du bon projet                                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Clé publique/publishable ou anon ; jamais une clé privilégiée                          |
| `DATABASE_URL`                   | Connexion PostgreSQL serveur privilégiée, directe ou pooler Session                    |
| `STRIPE_SECRET_KEY`              | Clé serveur du compte et du mode effectivement ciblés                                  |
| `STRIPE_ACCOUNT_ID`              | ID du même compte Stripe, utilisé comme garde-fou                                      |
| `STRIPE_WEBHOOK_SECRET`          | Secret de signature de la destination exacte et du même environnement                  |
| `STRIPE_PRICE_STANDARD`          | Price ID correspondant à Standard dans ce mode Stripe                                  |
| `STRIPE_PRICE_METAL`             | Price ID correspondant à Metal                                                         |
| `STRIPE_PRICE_GOLD`              | Price ID correspondant à Gold                                                          |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Configuration de portail du même compte/mode                                           |
| `KIE_API_KEY`                    | Clé fournisseur serveur ; jamais exposée au navigateur                                 |
| `ADMIN_USER_IDS`                 | Liste d’UUID Supabase autorisés, séparés par des virgules ; serveur uniquement         |
| `APP_ENV`                        | Garde du simulateur ; le worker actuel exige `test`                                    |
| `GENERATION_PROVIDER`            | `disabled` par défaut dans l’exemple ; `mock` pour la simulation explicitement activée |
| `R2_ENDPOINT`                    | Endpoint S3 du compte/bucket concerné                                                  |
| `R2_ACCESS_KEY_ID`               | Identifiant d’accès serveur au stockage                                                |
| `R2_SECRET_ACCESS_KEY`           | Secret serveur du stockage                                                             |
| `R2_BUCKET`                      | Nom du bucket privé                                                                    |

Aucune variable Stripe, R2, `ADMIN_USER_IDS`, `APP_ENV` ou `GENERATION_PROVIDER` n’était visible dans la dernière liste Vercel observée. Revérifier avant d’agir : Cisco peut modifier ses réglages indépendamment.

Le projet ne nécessite pas actuellement de `SUPABASE_SERVICE_ROLE_KEY` : il utilise `pg` pour ses transactions. Ne pas ajouter une clé privilégiée dans une variable `NEXT_PUBLIC_*` pour contourner un problème.

Règles de secrets :

- Ne jamais demander un mot de passe, une clé ou un lien de confirmation dans le chat.
- Ne jamais versionner `.env.local`, les tokens, les cookies, une URI PostgreSQL complète ou les fichiers `.vercel` contenant des réglages privés.
- Ne pas afficher la valeur d’une variable sensible pour confirmer sa présence ; utiliser ses métadonnées.
- Seules les URL/clés conçues comme publiques peuvent apparaître dans le bundle client.
- Les secrets doivent être injectés par Vercel ou un mécanisme local sécurisé.
- `.env.example` contient uniquement des exemples fictifs ; ne pas prendre `REPLACE_ME` ou les identifiants `fixture` pour des paramètres utilisables.
- Une modification de variable Vercel doit être appliquée par un nouveau déploiement de la bonne version du code. L’environnement Production Vercel et le mode test/live Stripe sont deux notions différentes.

## 10. PostgreSQL : connexion, droits et migrations

Le serveur utilise `pg`, pas un accès client direct aux tables financières.

**Connexion obligatoire : PostgreSQL direct ou Supabase pooler en mode Session.** Ne pas utiliser le mode Transaction pour ce code : les verrous de session doivent rester attachés à la même connexion pendant certains appels et commits.

Le port 6543 avait été observé pour une configuration Transaction. Dans Supabase, ouvrir `Connect` et sélectionner explicitement `Session pooler` pour récupérer les bons paramètres. Ne pas déduire que la connexion est correcte simplement en changeant un numéro de port sans vérifier le mode et les autres paramètres.

Dans une URI, remplacer uniquement le placeholder de mot de passe. Un mot de passe avec caractères réservés doit être correctement encodé. Ne pas confondre mot de passe de la base, mot de passe du compte Supabase et mot de passe client VideoEasy. Ne pas réinitialiser un mot de passe existant sans prendre en compte les autres connexions qui l’utilisent.

Vérifier TLS et les certificats pour les connexions distantes. Ne pas résoudre un échec en désactivant arbitrairement leur vérification.

Migrations présentes et appliquées dans le projet VideoEasy :

1. `supabase/migrations/202611160001_billing.sql`
2. `supabase/migrations/202611160002_platform.sql`

Historique retourné par Supabase lors de l’application :

- `videoeasy_202611160001_billing` — version `20261116104603` ;
- `videoeasy_202611160002_platform` — version `20261116104621`.

Les noms/versions de suivi Management API ne sont pas forcément identiques aux noms locaux du CLI. Comparer les objets réellement présents et l’historique avant toute nouvelle application. Ne pas réexécuter aveuglément ces fichiers `CREATE TABLE` sur la base déjà préparée.

Les 12 tables ont été vérifiées avec RLS activée et aucun privilège direct de lecture/écriture pour `anon` et `authenticated`. Les fonctions de réservation ne sont pas exécutables par ces rôles. Ne pas exposer les schémas privés dans PostgREST pour « faire marcher » l’interface.

Toute évolution de schéma doit être une migration versionnée, testée sur une base jetable et non destructive par défaut. Ne jamais exécuter les scripts de réinitialisation des tests sur le projet hébergé.

## 11. Dictionnaire des données existantes

### Schéma privé `billing`

| Table               | Contenu principal                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `customers`         | UUID utilisateur → Customer Stripe unique, intention durable de création, e-mail capturé pour les répétitions de requête |
| `checkout_attempts` | UUID d’opération, utilisateur, formule, Price ID, origine, expiration, Session ID éventuel, clôture                      |
| `subscriptions`     | Identifiant Stripe, propriétaire, statut, prix, formule, période, dates d’annulation, date de synchronisation            |
| `invoices`          | Factures utiles à la synchronisation, statut, montant payé, devise, rattachement abonnement et URL de facture            |
| `events`            | Event IDs Stripe traités, type, date de création et de traitement                                                        |
| `credit_grants`     | Allocation par facture et période, quantité attribuée et quantité disponible                                             |
| `reservations`      | UUID de job, utilisateur, allocation source, quantité réservée, état reserved/consumed/released                          |
| `credit_movements`  | Historique d’attribution, expiration, réservation, consommation, restitution et ajustement administrateur                |

Fonctions SQL :

```text
billing.reserve_credits(user_uuid, job_uuid, server_cost)
billing.settle_reservation(user_uuid, job_uuid, success)
```

La seconde règle actuellement un coût fixe. Elle ne réalise pas encore le rapprochement d’un coût fournisseur variable.

### Schéma privé `platform`

| Table      | Contenu principal                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `profiles` | Nom affiché, suspension et date de création, liés à `auth.users`                                                              |
| `models`   | ID, nom, type image/vidéo, fournisseur mock/kie, activation, coût fixe en crédits, formules autorisées                        |
| `jobs`     | UUID, propriétaire, modèle, prompt, coût capturé, fournisseur, statut, clé objet, indicateur mock, suppression logique, dates |
| `audit`    | Acteur administrateur, action, cible, justification, date, UUID idempotent éventuel et delta de crédits                       |

États de jobs définis : `queued`, `running`, `succeeded`, `failed`, `uncertain`. `uncertain` est prévu dans le schéma mais la récupération complète de ces cas n’est pas livrée.

Modèle initial : `mock-image`, simulation technique, coût 10 crédits, désactivé par défaut. Ce n’est pas un modèle IA Kie.ai.

## 12. Authentification : incident connu et correctif à préserver

L’incident signalé par Cisco était : clic sur une confirmation, puis impossibilité de se connecter et impression de recevoir constamment des e-mails.

Le diagnostic réel a montré :

- inscription existante ;
- une vérification Supabase refusée avec « email link has expired » ;
- des connexions par mot de passe refusées avec `email_not_confirmed` ;
- à cette lecture, aucun compte n’était enregistré comme confirmé ;
- l’ancien handler serveur ne pouvait pas lire l’erreur située après `#` dans l’URL et la rendait mal visible.

Le clic sur le lien n’avait donc pas été une preuve de confirmation réussie. Ne pas affirmer que le propriétaire est désormais connecté sans validation de son parcours réel après le correctif.

Code à lire :

```text
src/app/login/actions.ts
src/app/login/page.tsx
src/components/auth-submit.tsx
src/components/auth-callback.tsx
src/lib/auth-callback.ts
src/app/auth/callback/page.tsx
src/app/auth/exchange/route.ts
src/lib/auth.ts
src/lib/page-user.ts
src/proxy.ts
```

Comportement attendu et couvert en simulation :

1. Inscription par e-mail/mot de passe : mot de passe d’au moins 12 caractères.
2. Confirmation e-mail obligatoire ; ne pas activer `mailer_autoconfirm` pour cacher un bug.
3. Connexion par mot de passe : `signInWithPassword`, sans appeler signup, OTP ou resend, même en cas d’échec.
4. Les mots de passe existants plus courts sont acceptés au login ; le minimum de création ne doit pas bloquer une ancienne connexion valide.
5. Renvoi de confirmation : action séparée, appel explicite de `resend` avec type signup, seulement après un clic utilisateur.
6. Lien magique facultatif et clairement présenté comme une demande d’e-mail ; `shouldCreateUser: false` évite de créer un compte implicitement.
7. Après une demande d’e-mail, afficher les instructions et ne pas remettre automatiquement l’utilisateur dans un formulaire de création de compte.
8. Callback : lire les erreurs de la query string ET du fragment ; nettoyer l’URL ; messages distincts pour lien expiré et session non terminée.
9. Échange du code PKCE : POST de même origine, vérification d’une session puis de l’utilisateur avant réussite.
10. Cookies conservés et navigation vers `/account` ; session toujours valide après rechargement.
11. Lien ouvert dans un autre navigateur sans vérificateur PKCE : récupération explicite par mot de passe après confirmation, pas de boucle d’e-mails.
12. Un lien expiré reste invalide. Demander un lien neuf explicitement ; ne pas fabriquer une confirmation côté base.

Configurer l’authentification observée :

- Site URL : `https://videoeasy-gamma.vercel.app`.
- Redirect URL : `https://videoeasy-gamma.vercel.app/auth/callback`.
- Connexion e-mail activée.
- Confirmation obligatoire, connexion d’adresses non vérifiées interdite.
- Minimum de mot de passe côté Supabase : 12.

Le proxy rafraîchit les cookies avant les pages privées ; les pages/API vérifient encore leurs autorisations. Les pages et layouts pouvant se rendre indépendamment, une page qui lit des données privées doit rediriger elle-même si nécessaire, pas compter exclusivement sur le layout.

`requireUser()` vérifie via `auth.getUser()`. Ne pas remplacer cette vérification par la confiance dans un cookie décodé ou `getSession()` seul. Les identifiants utilisateur ne viennent pas du navigateur.

SMTP personnalisé : aucun n’était configuré lors de la dernière inspection. Des événements d’envoi de confirmation ont été observés, mais la réception finale et les restrictions de l’envoi par défaut doivent être testées avec le propriétaire. Préparer un service d’e-mails adapté avant une ouverture commerciale ; ne pas annoncer qu’il est déjà configuré.

Voir `docs/auth-confirmation-fix.md`. Ne pas réintroduire le handler de callback ancien ni un renvoi automatique de mails lors du login.

## 13. Design : exigence forte de Cisco

Cisco veut une plateforme esthétique, sobre, crédible et centrée sur les contenus. Il a demandé les références **Dailymotion et YouTube**, avec une fidélité visuelle élevée, et rejeté une présentation générique « IA slop ».

Référence fournie : https://www.dailymotion.com/fr

À conserver/améliorer :

- fond clair et surfaces neutres ;
- navigation latérale compacte ;
- barre de recherche identifiable ;
- catégories/filtres compréhensibles ;
- grille de vignettes avec hiérarchie claire ;
- titres lisibles, métadonnées utiles et espaces cohérents ;
- navigation mobile utilisable, menu accessible et absence de débordement ;
- marque VideoEasy et terminologie propre au service.

Ne pas remettre les grandes sphères violettes, les halos gratuits, les énormes slogans promotionnels, les effets sans utilité et les blocs génériques qui avaient été remplacés. Ne pas ajouter de faux avis, faux utilisateurs, faux compteurs de vues, faux résultats IA ou fausses statistiques financières.

Cisco a formulé une demande de copie « à 100 % » des références. L’implémentation actuelle reprend leurs codes de présentation ; elle n’a pas été validée pixel par pixel. Comparer les captures et les interactions avant d’annoncer une fidélité exacte. Ne pas faire passer VideoEasy pour un service affilié aux marques de référence.

La recherche actuelle de l’accueil filtre une petite collection d’inspirations statiques. Ce n’est pas encore un moteur de recherche dans des médias publics ou dans toutes les créations des clients.

Les six photographies de `public/editorial/` viennent d’Unsplash et sont utilisées comme inspirations explicitement étiquetées, pas comme des résultats IA. Leurs sources sont consignées dans `docs/platform-workflows.md`. Les captures de référence du design livré sont dans `docs/previews/`.

Les formulaires doivent afficher un état d’attente, des erreurs compréhensibles et une réussite identifiable. Aucun bouton ne doit sembler faire une génération lorsqu’il ne fait qu’enregistrer un brouillon local.

## 14. Pages et endpoints livrés

### Pages

| Route                | État / rôle                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `/`                  | Accueil d’inspiration, recherche et filtres de la collection statique     |
| `/explore`           | Aperçu public interactif : prompt, inspirations, formats, brouillon local |
| `/login`             | Connexion par mot de passe                                                |
| `/login?mode=signup` | Inscription                                                               |
| `/login?mode=magic`  | Demande volontaire de lien de connexion                                   |
| `/login?mode=resend` | Demande volontaire de renvoi de confirmation                              |
| `/auth/callback`     | Traitement client des erreurs/lien PKCE puis échange serveur              |
| `/studio`            | Espace authentifié de demande de job sur catalogue activé                 |
| `/gallery`           | Liste privée des jobs et résultats disponibles                            |
| `/account`           | Abonnement, crédits, profil et gestion du compte                          |
| `/admin`             | Administration, refusée sans UUID autorisé côté serveur                   |
| `/pricing`           | Trois offres et parcours Checkout/Portal préparés                         |
| `/billing/success`   | Attente/lecture de l’état serveur, aucun crédit attribué par la page      |
| `/billing/cancel`    | Retour d’une commande interrompue                                         |

Les formats visibles dans l’aperçu public sont des choix de composition et ne certifient pas les capacités d’un modèle actif. Le brouillon est conservé sur l’appareil, pas comme une sauvegarde cloud garantie.

### API / routes serveur

```text
POST   /auth/exchange
POST   /auth/signout
POST   /api/billing/checkout
POST   /api/billing/portal
GET    /api/billing/status
POST   /api/stripe/webhook
GET    /api/platform/models
GET    /api/platform/jobs
POST   /api/platform/jobs
DELETE /api/platform/jobs/[id]
GET    /api/platform/jobs/[id]/download
POST   /api/platform/profile
GET    /api/platform/admin
POST   /api/platform/admin
```

Les actions d’inscription/connexion/renvoi de confirmation se trouvent dans `src/app/login/actions.ts` ; elles ne sont pas des endpoints publics à remplacer arbitrairement.

Le POST de création de job n’accepte actuellement que :

```json
{ "id": "UUID_DE_DEMANDE", "model": "ID_DU_MODELE", "prompt": "Description" }
```

Le coût et le fournisseur sont décidés côté serveur. Les réglages de durée, résolution, image de référence et variantes de modèle ne sont pas encore implémentés dans le contrat réel des jobs.

## 15. Stripe : code existant et passage réel à terminer

Fichiers centraux :

```text
src/lib/stripe.ts
src/lib/billing.ts
src/lib/sync.ts
src/lib/invoice-policy.ts
src/lib/plans.ts
src/lib/config.ts
src/app/api/billing/
src/app/api/stripe/webhook/route.ts
scripts/check-stripe.ts
scripts/reconcile.ts
```

SDK installé : Stripe `23.1.0`. Version d’API explicitement fixée : `2026-10-28.endive`. Le catalogue des outils MCP observé pouvait utiliser une autre version preview ; ne pas la confondre avec celle du code. Toute montée de version demande lecture du changelog, validation des types et mise à jour des fixtures/tests.

Le code contient encore des refus du live dans plusieurs endroits :

- préfixes de clés dans `src/lib/stripe.ts` ;
- Customer, Price, Session et configuration Portal dans `src/lib/billing.ts` ;
- événements, clients, abonnements et factures dans `src/lib/sync.ts` ;
- facture live dans `src/lib/invoice-policy.ts` ;
- webhook live dans sa route ;
- vérificateur `scripts/check-stripe.ts` ;
- tests qui encadrent ces comportements.

**Ne pas simplement supprimer toutes les vérifications `livemode`.** Concevoir un mode Stripe explicite et vérifier que clé, compte, tarifs, portail, factures, événements et secret de webhook correspondent tous au même environnement. Une variable telle que `STRIPE_MODE` peut être ajoutée si le design la retient ; elle n’existe pas actuellement dans le code et ne doit pas être présentée comme déjà opérationnelle.

Conserver l’isolation des tests automatisés et des données de test. Ne pas transformer les fixtures en appels live. Les identifiants test et live ne sont pas interchangeables.

Avant création de catalogue réel : inspecter l’existant et la fiscalité. La liste produits/tarifs avait été vide dans le sandbox au début ; elle ne prouve rien sur le catalogue réel actuel. Ne jamais inventer de `price_`, `prod_`, `cus_`, `sub_` ou `bpc_`.

### Checkout

- Authentifier l’utilisateur et vérifier l’origine des requêtes mutantes.
- Le navigateur envoie une formule ; le serveur choisit le prix autorisé.
- Le Customer vient du mapping serveur unique, pas de l’e-mail seul ni d’un identifiant transmis par le navigateur.
- Vérifier les métadonnées de propriété du Customer.
- Empêcher les souscriptions concurrentes, y compris lorsqu’un abonnement est incomplet ou impayé.
- Utiliser les intentions et clés d’idempotence durables.
- Réutiliser une session ouverte compatible ; ne pas créer une autre commande pour contourner un timeout.
- Les tentatives actuelles conservent leur formule, leur prix, leur origine et leur expiration. En cas d’incertitude hors fenêtre sûre, bloquer pour réconciliation.
- Mode abonnement, facturation flexible ; aucune période d’essai ni promotion initiale.

### Portal

Factures consultables, moyen de paiement modifiable, annulation `at_period_end`, changement de formule désactivé. Vérifier ces caractéristiques côté serveur avant ouverture. Ne pas développer une seconde facturation parallèle aux factures Stripe.

### Webhooks

Signature vérifiée sur le corps brut. La notification n’est pas un snapshot d’état à réappliquer aveuglément : récupérer les ressources actuelles sous verrou utilisateur. Transaction pour événement traité, factures, état et crédits ; erreur réessayable si le traitement échoue.

Événements gérés dans le code actuel :

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.paused
customer.subscription.resumed
invoice.paid
invoice.payment_failed
invoice.payment_action_required
invoice.voided
invoice.marked_uncollectible
```

Adresse prévue : `https://videoeasy-gamma.vercel.app/api/stripe/webhook`. Vérifier la version d’API et le secret de la destination réelle. Un secret CLI local n’est pas le secret de l’endpoint déployé.

Une notification pour un Customer sans mapping n’autorise pas à chercher arbitrairement un utilisateur par son e-mail. Le traitement actuel renvoie une erreur pour inspection/récupération. Des objets créés par `stripe trigger` ne constituent pas forcément une souscription VideoEasy valide.

### Réconciliation

`scripts/reconcile.ts` recharge les abonnements et factures des mappings connus sans créer d’objet Stripe. Prévoir un ordonnanceur sécurisé et des alertes. Une périodicité de cinq minutes était envisagée ; elle n’est pas documentée comme déployée. Le garde-fou de génération refuse un abonnement non synchronisé depuis plus de quinze minutes : sans réconciliation ni événement récent, un compte pourtant payé peut être bloqué.

L’implémentation recharge tout l’historique par Customer sous verrou. Pour la montée en charge : file sérialisée par utilisateur, synchronisation incrémentale, pagination durable et supervision des durées. Ne pas affaiblir l’idempotence pour réduire le temps de traitement.

## 16. Crédits : invariants à préserver

1. Aucun crédit sur une redirection Checkout ou un affichage de page.
2. Une facture éligible payée n’attribue qu’une fois les crédits, même avec deux événements différents ou deux workers concurrents.
3. Les contraintes d’unicité portent sur la facture et sur la période d’un abonnement.
4. Une proratisation, une mise à jour d’abonnement, une facture manuelle ou non éligible ne créent pas automatiquement une allocation mensuelle.
5. Les crédits disponibles expirent à la fin de leur période, sans report. Les anciennes réservations restent identifiables et ne sont pas réécrites dans le nouveau mois.
6. Une réservation retire le disponible ; une consommation finale ne doit pas le retirer une deuxième fois.
7. Un remboursement de réservation échouée ne revient dans le disponible que si la période source est encore valide. Après expiration, clôturer sans alimenter le nouveau mois.
8. Solde non négatif ; pas de retrait administrateur sur des crédits déjà réservés.
9. La simultanéité est contrôlée en base, pas seulement par un bouton désactivé.
10. Une annulation programmée ne supprime pas immédiatement les droits payés. Respecter `cancel_at` et `cancel_at_period_end`, notamment en facturation flexible.
11. Le statut payé/actif, la formule, la période et la fraîcheur de synchronisation sont vérifiés pour tout nouveau lancement.
12. Une suspension empêche les nouvelles demandes. Définir explicitement les autres effets plutôt que supprimer des médias ou des réservations sans politique commerciale.

La politique d’allocation actuelle exige notamment : facture payée, EUR, montant payé positif, motif création ou cycle d’abonnement, une ligne non proratisée de quantité 1 et de montant nominal correspondant à un tarif autorisé. Les factures à zéro et les remises complètes ne donnent pas automatiquement de crédits. Revoir explicitement cette règle si les promotions sont ajoutées ultérieurement.

Aujourd’hui, le code bloque les factures live par conception initiale ; adapter cette condition par comparaison au mode attendu lors du passage réel, sans modifier les autres invariants.

Les opérations prennent un verrou PostgreSQL par utilisateur, partagé entre facturation et réservations. La connexion de session est gardée lorsque des commits durables doivent précéder un appel externe.

## 17. Génération IA : existant et travaux réels

`src/lib/platform.ts` contient :

- validation stricte de l’UUID, du modèle et du prompt ;
- contrôle de propriété lors d’une répétition du même UUID ;
- contrôle de suspension ;
- lecture du modèle activé et du coût côté base ;
- contrôle des formules autorisées ;
- réservation atomique et création du job ;
- worker simulé et ajustements administrateur.

**Le code actuel ne sait traiter que `provider=mock`, avec `GENERATION_PROVIDER=mock` et `APP_ENV=test`. La valeur `kie` est prévue dans le schéma mais n’a pas d’adaptateur opérationnel.** Enregistrer une clé ou mettre la variable à `kie` n’active donc aucune génération.

Le worker de test :

- traite au plus 100 tâches par exécution du script ;
- réclame les jobs avec `FOR UPDATE SKIP LOCKED` ;
- marque la tâche running avant sa finalisation ;
- consomme la réservation au succès ;
- simule un échec non facturé si le prompt commence par `[test-failure]` ;
- produit un SVG explicitement marqué test technique ;
- n’appelle pas Kie.ai et ne réalise aucun résultat IA.

Si un worker s’arrête après la prise du job, la tâche peut rester running et conserver sa réservation. Cette prudence évite de relancer/refinancer aveuglément une action incertaine, mais le mécanisme de récupération opérateur et automatique fiable reste à développer.

### Adaptateur réel à construire

Séparer le catalogue, la validation des paramètres, l’estimation, la soumission, la lecture d’état, la normalisation du résultat et la finalisation. L’interface exacte doit suivre les contrats vérifiés du fournisseur ; ne pas supposer qu’un modèle Veo utilise les mêmes routes et réponses qu’un autre modèle.

Enregistrer durablement avant et après les appels : ID interne, version du modèle/configuration, estimation, coût en crédits réservé, ID fournisseur lorsque disponible, tentative, statut, dates et information de facturation vérifiable.

En cas de timeout à la soumission, un job peut avoir été créé chez le fournisseur. Ne pas le relancer sous un nouvel identifiant sans rapprochement. N’utiliser une clé d’idempotence fournisseur que si l’API concernée la supporte réellement. À défaut, conserver l’état incertain et une procédure de réconciliation.

Une réussite de soumission signifie qu’une tâche a été acceptée, pas qu’un média est disponible. Ne pas laisser un navigateur attendre la fin dans une requête HTTP longue. Ne pas utiliser une boucle uniquement en mémoire Vercel comme ordonnanceur durable.

Choisir un exécuteur récupérable : file et worker, outbox PostgreSQL avec consommateur, ou mécanisme adapté aux limites réelles de l’hébergement. Définir les reprises, timeouts, limites globales fournisseur, alertes et stratégie de fermeture des réservations.

## 18. Kie.ai : conditions avant activation

Le compte fournisseur appartient à VideoEasy. La clé reste serveur. Les utilisateurs finaux n’ont pas de compte Kie.ai à fournir.

Avant d’activer un premier modèle :

1. confirmer les conditions autorisant l’usage commercial mutualisé pour plusieurs clients ;
2. vérifier l’accès effectif du compte et son crédit fournisseur ;
3. lire la documentation actuelle du modèle exact ;
4. confirmer son ID, ses endpoints, paramètres, formats, durées, résolutions et limitations ;
5. vérifier son prix actuel, sa devise, la facturation des échecs et les règles de remboursement fournisseur ;
6. définir une configuration serveur autorisée et un tarif en crédits conservant la marge ;
7. fixer un budget/plafond de test réel avant une demande payante ;
8. tester une génération contrôlée, sa récupération et son stockage privé avant l’ouverture aux autres utilisateurs.

Kling, Veo, Seedance, Wan et des modèles image sont des familles souhaitées, pas une liste d’intégrations déjà disponibles ni une promesse d’accès. Commencer par un seul modèle correctement intégré.

Les callbacks fournisseur doivent être authentifiés selon les capacités réellement documentées, ou recoupés avec une lecture de tâche côté serveur. Aucun callback client ne peut attribuer un job à un autre utilisateur, finaliser arbitrairement des crédits ou fournir une URL de fichier à importer sans contrôle.

Le coût fournisseur réel, le crédit client et l’état du stockage sont trois informations distinctes. Un échec technique avec une dépense fournisseur avérée ne doit pas entraîner automatiquement une restitution intégrale. Une politique commerciale doit préciser ce traitement.

## 19. R2 et galerie privée

État livré :

- bibliothèque AWS S3 et presigner installés ;
- `src/lib/storage.ts` sait produire une URL GetObject signée, durée 60 secondes ;
- le téléchargement vérifie d’abord le job, son propriétaire, sa réussite et l’absence de suppression logique ;
- la clé d’objet vient de la base, jamais d’un paramètre libre du navigateur ;
- le résultat mock renvoie un SVG de test, pas un fichier R2 ;
- le retrait d’un résultat de la galerie est une suppression logique.

À réaliser :

- vérifier/créer le bucket privé et les accès serveur minimaux nécessaires ;
- importer les résultats fournisseur avant leur expiration ;
- limiter taille, type, durée de transfert et consommation mémoire ;
- contrôler les URL et redirections pour prévenir SSRF et téléchargements arbitraires ;
- vérifier type réel du fichier et intégrité, ne pas faire confiance seulement au Content-Type annoncé ;
- générer les clés d’objet côté serveur, avec isolation par utilisateur/job ;
- gérer de façon récupérable les états résultat prêt / import en cours / stocké / import échoué ;
- produire les vignettes et previews autorisées ;
- gérer la suppression physique, les erreurs de purge et la politique de conservation ;
- tester les vraies signatures, les fichiers et l’accès depuis deux comptes distincts.

Ne jamais rendre le bucket public pour contourner un souci de téléchargement. Une URL signée déjà délivrée reste utilisable pendant sa courte durée de validité : ne pas promettre une révocation instantanée différente du comportement réel.

Décider la conservation des médias et les droits de consultation après résiliation avant de les annoncer. Une expiration d’abonnement bloque les nouveaux lancements ; elle ne justifie pas une purge immédiate inventée des créations existantes.

## 20. Administration et finances

L’administration existe sous forme d’une première interface et d’API protégées. L’autorité actuelle vient de `ADMIN_USER_IDS`, comparée à l’UUID utilisateur vérifié côté serveur. Aucune attribution d’administrateur au fondateur n’a été documentée comme terminée.

Ne pas déduire un rôle administrateur d’une valeur `user_metadata` modifiable par le client, d’un e-mail envoyé dans un formulaire ou de l’accès à une URL cachée.

Fonctions existantes :

- liste des utilisateurs et profils ;
- suspension/réactivation ;
- activation/désactivation des modèles existants ;
- coût fixe et formules autorisées ;
- consultation des derniers jobs ;
- historique des actions ;
- ajustement de crédits sur une période payée active, motif obligatoire, UUID idempotent et mouvement journalisé.

Limites : listes plafonnées à 100 éléments, pas de tableau financier complet ni de coût fournisseur réel enregistré par génération, pas de création de modèle Kie.ai validé via l’interface actuelle, pas de suivi complet des remboursements/litiges.

À compléter progressivement : pagination/recherche, filtres des échecs et renouvellements, distinction coûts estimés/réels, factures et frais correspondants, consommation par compte, alertes d’abus et de budget, estimation de marge justifiée par des données réelles.

Ne pas calculer un « bénéfice réel » à partir de crédits consommés seuls, ni confondre toutes les factures payées depuis l’origine avec du MRR. Prendre en compte devises, TVA, remises, remboursements et périodes.

## 21. Sécurité et exploitation indispensables

- Authentification et autorisation côté serveur sur chaque action privée.
- Vérification propriétaire avant lecture, téléchargement, suppression et finalisation d’un job.
- Validation stricte des entrées ; requêtes SQL paramétrées.
- Coût, prix, Customer et rôle décidés côté serveur.
- Contrôle d’origine sur les routes mutantes ; signatures pour Stripe ; traitement documenté du fournisseur.
- Idempotence et transactions sur les opérations monétaires ou de crédits.
- Limites utilisateur, capacité globale fournisseur et plafond financier surveillés.
- Aucun secret, cookie, mot de passe, lien de confirmation ou payload brut sensible dans les logs.
- Messages d’erreur utiles mais ne permettant pas l’énumération gratuite de comptes.
- Aucun script de test destructif sur un projet hébergé.
- Migrations et restauration préparées ; politique de sauvegarde à vérifier réellement, pas supposée à partir du nom du service.
- Journaux exploitables par identifiants de job, facture, événement et corrélation, sans exposer les données inutiles.
- Avant ouverture commerciale : finaliser les mentions de facture, conditions d’abonnement/crédits, confidentialité et droits des médias, avec les informations réelles de l’entreprise.

L’offre Vercel observée était Hobby. Vérifier les conditions, limites et coûts réellement adaptés à l’usage commercial prévu ; ne pas engager un changement payant de plan automatiquement.

## 22. Versions, installation et commandes

Référence actuelle du lockfile/dépendances : Next.js 16.4.6, React 19.3.1, TypeScript 7.0.2, Supabase SSR 0.12.7, Supabase JS 2.119.0, pg 8.23.1, Stripe 23.1.0, Vitest 5.1.0 et Playwright 1.65.1. Vérifier l’installation effective avec `package-lock.json` ; certains manifestes utilisent des plages de versions. Ne pas mettre à jour tout le socle sans nécessité.

Node.js 24 est la référence d’hébergement. Lire `AGENTS.md` et toute instruction locale applicable. Next.js fournit des guides dans `node_modules/next/dist/docs/` : consulter ceux de la version installée, en particulier actions serveur, routes, proxy et authentification.

Commandes :

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm start
npm test
```

Créer un `.env.local` uniquement sur la machine d’exécution sécurisée si nécessaire. Cisco travaillait surtout via GitHub et Vercel : ne pas lui faire chercher un fichier local qui n’existe pas sur son ordinateur.

Outils opérationnels existants :

```sh
npm run check:stripe
npm run reconcile
npm run reconcile -- UUID_UTILISATEUR_SUPABASE
npm run worker:test
npm run test:auth-browser
```

Les trois premiers scripts serveur métier chargent `.env.local` selon leur définition dans `package.json`. Vérifier les variables ciblées avant lancement. `check:stripe` est un contrôle en lecture du compte, tarifs et portail ; il ne valide pas un paiement ni un webhook complet. Il contient encore des restrictions au mode test à adapter pour le réel.

`worker:test` est seulement un simulateur. Ne pas le renommer « worker production » sans construire les garanties manquantes.

## 23. Tests : ce qui a été fait et ce qui manque

Au commit fonctionnel de référence :

- **84 tests automatisés réussis** ;
- tests PostgreSQL exécutés sur PostgreSQL 17 local dans Docker ;
- contrôle TypeScript et compilation Next.js réussis ;
- CI GitHub verte, incluant le test navigateur d’authentification ;
- vérification en lecture du site déployé : traitement visible du lien expiré, formulaire de renvoi séparé, connexion par mot de passe séparée ;
- aucun e-mail réel envoyé par les tests navigateur de ce correctif.

### Base jetable uniquement

```sh
docker run --name videoeasy-billing-test \
  -e POSTGRES_PASSWORD=local-test-only \
  -p 127.0.0.1:55432:5432 -d postgres:17-alpine

docker exec videoeasy-billing-test pg_isready -U postgres

TEST_DATABASE_URL=postgresql://postgres:local-test-only@localhost:55432/postgres npm test
```

Les tests bootstrapent des objets Supabase minimaux et recréent les schémas de cette base locale. Sans `TEST_DATABASE_URL`, les suites PostgreSQL sont ignorées ; un résultat vert partiel ne prouve donc pas qu’elles ont tourné.

### Navigateur avec fournisseur simulé

```sh
npm exec -- playwright install chromium
npm run test:auth-browser
```

Le script utilise les ports locaux 3010 et 54329 et un vrai navigateur avec SDK Supabase, fournisseur simulé et cookies de fixture. Fermer un serveur Next dev dans ce checkout avant de le lancer. Chromium déjà installé peut être sélectionné avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Il vérifie : inscription, refus d’un login non confirmé sans nouveau mail, lien expiré, renvoi volontaire, session PKCE, rechargement, déconnexion/reconnexion par mot de passe et récupération depuis un autre navigateur. Cela ne prouve pas que le propriétaire a terminé sa confirmation réelle ni que Vercel se connecte effectivement à PostgreSQL.

### Matrice à compléter sur les services configurés

| Domaine        | Vérifications                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | Confirmation réelle, lien expiré/réutilisé, absence de renvoi automatique, cookies après reload et navigation, logout, autre navigateur, erreur lisible |
| Isolation      | Deux comptes distincts : impossible de voir, télécharger, retirer ou finaliser le job de l’autre                                                        |
| Stripe         | Souscription, authentification de paiement, refus, renouvellement, récupération, annulation à échéance                                                  |
| Webhooks       | Signature invalide, doublons, concurrence de deux workers sur une facture, désordre, panne puis reprise                                                 |
| Crédits        | Solde insuffisant, absence d’abonnement, simultanéité, expiration et réservation conservée, restitution unique, ajustement admin unique                 |
| Kie.ai         | Soumission acceptée sans résultat immédiat, succès réel, échec facturé/non facturé, timeout incertain, panne worker et rapprochement                    |
| Stockage       | Import complet, fichiers volumineux dans les limites fixées, lien signé, propriétaire, expiration, purge récupérable                                    |
| Administration | Non-admin refusé, actions justifiées et auditées, suspension, configuration de modèle sans effet rétroactif                                             |
| Interface      | Recherche/filtres honnêtes, mobile, navigation clavier, états d’attente/erreur, pas de faux résultat                                                    |

Les cartes de test Stripe appartiennent aux environnements de test. Ne jamais les utiliser pour certifier un paiement live. Les simulations live dans les fixtures ne doivent pas contacter un compte Stripe réel.

## 24. Étude HeliosGen : conclusions à conserver

Référence étudiée : https://github.com/SegFault42/HeliosGen

Commit inspecté : `99dd5b12c05d5e883e03e9c9ea5a8e88120bf273`.

Constats : Next.js/React/TypeScript, emballage Tauri, stockage SQLite local, clé personnelle Kie.ai, catalogue de capacités de modèles et polling de tâches en mémoire. Certains modèles, notamment Veo, n’utilisent pas le même contrat.

Idées intéressantes : catalogue central, validation des capacités, séparation des fournisseurs et visualisation des résultats. À remplacer pour VideoEasy : identité locale, clé personnelle, SQLite et ordonnanceur en mémoire.

Le README indiquait MIT, mais aucun fichier LICENSE autonome n’avait été trouvé à la racine et le manifeste ne renseignait pas de licence. **Aucun code, composant ni asset HeliosGen n’a été copié.** Ne pas commencer une reprise de composants sans vérifier les droits et attributions. Les dépendances du projet de référence n’ont pas été installées/auditées transitivement dans VideoEasy.

Le champ ISC du manifeste VideoEasy provient de l’initialisation npm ; ne pas le présenter comme une décision juridique validée du fondateur. Clarifier la licence du projet si nécessaire.

## 25. Ordre de travail recommandé pour la reprise

### Étape A — Audit de reprise

1. Lire cette bible, `AGENTS.md`, le code et les documents référencés.
2. Vérifier branche, commits, PR, déploiement actuel et état de travail local.
3. Découvrir les outils réellement accessibles, sélectionner les bonnes connexions et vérifier les variables par leurs noms/types sans afficher leurs valeurs.
4. Produire un résumé court : fonctionnel, préparé, manquant, prochain blocage réel.

### Étape B — Finir le parcours compte réel et la connexion base

1. Vérifier avec Cisco le parcours après le correctif déjà livré, sans lui demander son mot de passe.
2. En cas de refus, distinguer lien expiré, adresse non confirmée, identifiants invalides, absence de session, cookie et erreur de base.
3. Tester l’accès réel de Vercel à PostgreSQL et le mode Session/TLS.
4. Garder les protections. Ne pas confirmer le compte à la main ni ouvrir les droits client pour masquer l’erreur.
5. Attribuer l’UUID administrateur seulement après identification du compte propriétaire vérifié et selon ses autorisations.

### Étape C — Aligner Stripe sur la décision réelle de Cisco

1. Retrouver le bon compte live et ses ressources ; le MCP sandbox précédent ne suffit pas.
2. Inspecter prix, portail, fiscalité, destination et version du webhook.
3. Implémenter un mode cohérent test/live dans tout le code et ses tests.
4. Ajouter les bonnes variables de façon sécurisée.
5. Vérifier en simulation puis avec des parcours de test séparés ; encaissement réel contrôlé seulement lorsqu’il est explicitement autorisé.
6. Installer la réconciliation et les alertes avant de dépendre du garde-fou de quinze minutes.

Les questions fiscales réellement nécessaires sont : pays/statut de l’entreprise, régime de TVA, clientèle B2C/B2B, pays de vente et mentions de facture. Ne pas poser des dizaines de questions sans avancer sur le code indépendant.

### Étape D — Première génération Kie.ai réelle

1. Confirmer les droits commerciaux et choisir un modèle exact avec coût actuel.
2. Définir le budget du test, le coût en crédits et les formules autorisées.
3. Construire adaptateur, tâches durables, états incertains, rapprochement et worker récupérable.
4. Préserver les réservations et l’idempotence.
5. Tester un résultat réel sans ouvrir immédiatement tous les modèles.

### Étape E — Stocker les vrais résultats

Configurer et tester R2 privé, transfert, métadonnées et téléchargement propriétaire. Ajouter previews et suppression récupérable ; finaliser la conservation et les quotas avant de les annoncer aux clients.

### Étape F — Administration, coûts et qualité produit

Compléter catalogue/paramètres, coûts réels, filtres, suivi, alertes et marge. Améliorer le design existant avec comparaison visuelle et tests mobile. Supprimer les comportements ambigus et états techniques mal expliqués, sans prétendre qu’un simulateur est une fonction réelle.

### Étape G — Préparation commerciale

Achever les tests de bout en bout, l’envoi e-mail, les politiques de paiement/remboursement/crédits/médias, les sauvegardes/restauration, la supervision et les plafonds. Vérifier les conditions d’hébergement et de fournisseurs. Ouvrir progressivement au lieu d’exposer un service sans parcours complet vérifié.

## 26. Déploiement et stratégie Git à régulariser

Le site public utilise déjà la cible Production Vercel, sur autorisation de Cisco. La branche fonctionnelle est encore une branche de travail et les PR sont empilées. Ce désalignement doit être traité explicitement.

Avant un prochain déploiement :

- vérifier le commit source réellement construit ;
- ne pas laisser un `main` vide devenir accidentellement la source d’une nouvelle production ;
- comparer la configuration de suivi Git aux déploiements manuels ;
- préparer une stratégie de revue/fusion ou une branche de livraison stable ;
- ne pas forcer les historiques ou fusionner à l’aveugle les PR empilées ;
- vérifier les variables de l’environnement ciblé ;
- attendre `READY`, puis contrôler les pages et actions concernées.

Un build vert prouve la compilation, pas une connexion utilisateur, un paiement ou une génération. Une variable présente prouve son enregistrement, pas sa validité. Conserver un chemin de retour à la version fonctionnelle précédente.

Éviter un redéploiement de production pour un simple document si aucun comportement ni réglage d’exécution ne change. Ne pas passer une intégration financière en réel par effet de bord d’un changement d’interface.

## 27. Documents et fichiers à lire en priorité

1. `CLAUDE.md` — cette reprise et les décisions les plus récentes.
2. `AGENTS.md` — instructions locales et particularités de Next.js installé.
3. `README.md` — entrée du dépôt, mais contient des descriptions historiques.
4. `docs/auth-confirmation-fix.md` — incident auth et correctif actuel.
5. `docs/platform-workflows.md` — plateforme, simulateur, design, limites et sources des photos.
6. `docs/architecture.md` — architecture et plan Stripe initial.
7. `docs/setup.md` — paramètres initiaux ; plusieurs paragraphes sont historiques.
8. `docs/operations.md` — réconciliation et opérations incertaines.
9. `docs/validation.md` — validations des premières livraisons, pas le compte rendu le plus récent.
10. `docs/heliosgen-review.md` et `docs/studio-progress.md` — historique de la première étude/interface.
11. `supabase/migrations/` — schéma de référence ; comparer à la base déjà migrée.
12. `tests/`, `scripts/` et `.github/workflows/ci.yml` — preuves et reproductibilité.

**Attention aux documents historiques :** des phrases comme « aucun déploiement production réalisé », « uniquement Preview », « aucun endpoint IA » ou « ne jamais accepter une clé live » décrivaient une phase antérieure. L’interface est maintenant déployée, des endpoints de jobs existent, et Cisco demande Stripe réel. Ne pas remettre le projet en arrière sur la seule base de ces anciennes phrases. Inversement, le fait que le besoin ait évolué ne rend pas le code actuel compatible avec les nouvelles décisions par magie : analyser et corriger les écarts.

## 28. Définition du résultat attendu

VideoEasy est réellement prêt lorsque, avec des services configurés et des preuves de tests adaptés :

- un utilisateur crée son compte, confirme son e-mail et garde sa session ;
- un paiement éligible active les droits une seule fois ;
- un compte non payé ou suspendu ne lance pas de génération ;
- le coût et la simultanéité sont imposés côté serveur ;
- une demande est envoyée une seule fois au fournisseur ou maintenue explicitement en état incertain ;
- l’état asynchrone est récupérable après interruption ;
- les crédits sont réglés selon la politique et le coût effectivement établis ;
- un média réel est stocké durablement dans R2 privé ;
- seul son propriétaire peut le consulter, télécharger ou supprimer ;
- l’administrateur autorisé gère les modèles et les comptes, avec audit ;
- les coûts et la marge affichés reposent sur des données identifiées comme réelles ou estimées ;
- l’interface correspond à la direction visuelle demandée et explique les erreurs ;
- un opérateur peut rapprocher Stripe, les jobs, les crédits et les médias sans modifier arbitrairement les soldes ;
- les services restent exploitables lorsque des webhooks arrivent en double, en retard ou après une panne.

À chaque livraison, fournir à Cisco : ce qui a changé, ce qui est réellement connecté, les tests exécutés, les limites restantes, la branche/PR, le déploiement éventuel et **une seule prochaine action utilisateur clairement expliquée** s’il en reste une.

## 29. Première consigne d’exécution

Commence maintenant par auditer le dépôt existant et les connexions disponibles, sans réécrire la plateforme. Vérifie que tu travailles à partir de `feat/platform-workflows` ou d’un successeur plus récent qui contient son code. Lis en priorité le correctif d’authentification et les restrictions Stripe encore présentes.

Présente à Cisco un état court, puis avance sur les réparations et compléments indépendants déjà autorisés. Ne demande pas ses secrets. Ne prétends pas que Kie.ai, R2, le compte Stripe réel ou son propre login sont fonctionnels avant les vérifications correspondantes. Conserve les garanties transactionnelles et la séparation des données pendant toute la reprise.

## 30. Évolutions possibles après stabilisation

Ces pistes sont secondaires et ne doivent pas détourner des parcours fiables déjà décrits :

- modèles supplémentaires et deuxième fournisseur, dont Treg avait été évoqué comme possibilité à évaluer ;
- packs de crédits et abonnements annuels, avec règles de validité, facturation, taxes et tests spécifiques ;
- codes promotionnels et parrainage sans trou dans les droits ou les allocations ;
- workflows de création avancés, outils de montage, amélioration de vidéo et autres traitements ;
- interface multilingue ;
- application mobile ;
- domaine personnalisé, uniquement après choix et achat explicite. Aucun domaine commercial personnalisé n’est documenté comme acquis ; l’URL actuelle est celle de Vercel.

Ne pas annoncer ces fonctions comme disponibles, ne pas activer de dépenses récurrentes en leur nom et ne pas étendre les droits des comptes avant leurs règles et validations. La priorité reste une plateforme privée utilisable, sécurisée, esthétique et économiquement vérifiée.
