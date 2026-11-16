# Configuration du sandbox

## État vérifié le 16 novembre 2026

- Plugin Stripe accessible ; `stripe_implementation_planner` présent et plan accepté.
- Seul compte disponible : **environnement de test Video Easy**, `livemode=false`.
- Produits et tarifs : listes vides, `has_more=false`.
- Aucun objet commercial Stripe créé dans cette session. Cisco a choisi : **régime encore à confirmer, préparer le code sans créer les produits**.
- Dépôt initialement vide, aucune instruction AGENTS.md. Une amorce `.gitkeep` sur `main` permet une PR de la branche dédiée.

## Prochaine action concrète dans Stripe

Ouvrir le Dashboard, sélectionner **environnement de test Video Easy**, puis consulter les informations de l’entreprise et la rubrique Tax. Confirmer le pays et le statut juridique de l’entreprise, le régime de TVA (y compris franchise éventuelle) et les inscriptions fiscales applicables. Ne pas activer une TVA de 20 % par défaut.

Avant de finaliser la facturation commerciale, il faudra aussi préciser : B2C/B2B, pays de vente, raison sociale, adresse, identifiants fiscaux et mentions légales de facture. Ces points n’empêchent pas la revue du code. Ils doivent être résolus avant la configuration commerciale et tout passage en production ; aucun passage en production n’est préparé ici.

Une fois le régime clarifié, inspecter à nouveau produits et tarifs avant toute création. Créer ou réutiliser :

| Produit            | Tarif récurrent  | Montant en centimes | Devise | Intervalle |
| ------------------ | ---------------- | ------------------: | ------ | ---------- |
| VideoEasy Standard | Standard mensuel |                2300 | eur    | month / 1  |
| VideoEasy Metal    | Metal mensuel    |                3500 | eur    | month / 1  |
| VideoEasy Gold     | Gold mensuel     |                5600 | eur    | month / 1  |

Tarifs fixes, quantité 1, usage `licensed`, sans essai ni remises. Le traitement fiscal inclus/exclus et le code fiscal produit dépendent du régime confirmé. Le code désactive actuellement `automatic_tax` et n’ajoute aucun taux : cette configuration est exclusivement une base de test. Si la collecte de taxe s’applique, adapter et tester Checkout après revue fiscale. Ne pas utiliser cette version pour vendre sans cette étape.

Conserver les Price IDs réels dans les variables serveur. Aucun Price ID réel n’a été inventé dans le dépôt. Tous les identifiants `fixture` appartiennent aux tests simulés.

## Supabase

1. Choisir un projet Supabase de test ; ne pas appliquer la migration à une base de production.
2. Appliquer `supabase/migrations/202611160001_billing.sql` avec le SQL Editor privilégié, ou `supabase db push` après liaison explicite au projet test. La migration attend les rôles `anon`, `authenticated` et `auth.users` fournis par Supabase.
3. Activer la connexion e-mail par lien magique. Ajouter `http://localhost:3000/auth/callback` aux Redirect URLs de test. Pour une preview hébergée, ajouter son URL exacte et régler `APP_URL` sur la même origine.
4. Copier l’URL du projet et sa clé publique/publishable (ou anon). Elles seules sont préfixées `NEXT_PUBLIC_`.
5. Copier l’URI de connexion privilégiée PostgreSQL directe ou **Supabase pooler en mode session** dans `DATABASE_URL`. Le pooler en mode transaction est incompatible avec les verrous de session utilisés ici. TLS vérifié pour une base distante (par exemple `sslmode=verify-full` selon le certificat du fournisseur) ; ne pas désactiver la vérification du certificat.

Le code utilise une connexion PostgreSQL privilégiée serveur pour les transactions. Il n’a pas besoin de `SUPABASE_SERVICE_ROLE_KEY`. Si une telle clé est utilisée ailleurs ultérieurement, elle doit rester exclusivement serveur. Le schéma `billing` est privé, sans droits client ni politiques RLS d’écriture ; ne pas l’ajouter aux schémas exposés dans l’API Supabase.

## Variables et secrets

Copier `.env.example` vers `.env.local`, puis remplir dans un éditeur local ou un gestionnaire de secrets :

| Variable                           | Source                                                   | Portée                               |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `STRIPE_SECRET_KEY`                | Clé secrète **test** du sandbox sélectionné              | Serveur uniquement                   |
| `STRIPE_ACCOUNT_ID`                | Identifiant du même compte sandbox                       | Serveur, garde-fou de correspondance |
| `STRIPE_WEBHOOK_SECRET`            | Secret de l’endpoint ou de la CLI locale                 | Serveur uniquement                   |
| `STRIPE_PRICE_STANDARD/METAL/GOLD` | Trois Price IDs test validés                             | Serveur uniquement                   |
| `STRIPE_PORTAL_CONFIGURATION_ID`   | Configuration test du portail décrite ci-dessous         | Serveur uniquement                   |
| `NEXT_PUBLIC_SUPABASE_URL`         | Projet Supabase test                                     | Publique                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Clé publique/publishable ou anon du projet               | Publique                             |
| `DATABASE_URL`                     | Connexion PostgreSQL privilégiée, mode session           | Serveur uniquement                   |
| `APP_URL`                          | Origine exacte, sans chemin, ex. `http://localhost:3000` | Serveur                              |

Le fichier d’exemple ne contient que des valeurs fictives. `.env.local`, autres `.env*`, `.vercel` et logs sont ignorés par Git. Ne jamais coller une clé dans le chat, un ticket ou GitHub. Dans Vercel, utiliser les variables chiffrées du projet **Preview uniquement**, jamais l’environnement Production pour ce travail. Ne pas déployer avant d’avoir choisi un projet test et validé ces paramètres.

La clé doit être `sk_test_…` (ou une clé restreinte test ayant les droits nécessaires). L’application refuse une clé live, compare `/v1/account` à `STRIPE_ACCOUNT_ID` et refuse les ressources/événements live. L’authentification du plugin Stripe ne fournit pas automatiquement une clé utilisable par l’application Next.js.

## Customer Portal

Créer ou réutiliser une configuration **test** :

- Consultation de factures : activée (`invoice_history.enabled=true`).
- Modification du moyen de paiement : activée (`payment_method_update.enabled=true`).
- Annulation : activée, mode `at_period_end`.
- Modification d’abonnement : désactivée (`subscription_update.enabled=false`).
- Aucune réduction ou changement de formule au lancement.

L’endpoint vérifie ces propriétés à chaque ouverture et refuse une configuration incompatible. Avec le mode flexible, une annulation programmée peut utiliser `cancel_at` plutôt que `cancel_at_period_end` : les deux champs sont conservés.

## Webhook et version API

SDK Stripe **23.1.0**, version d’API explicitement fixée à **2026-10-28.endive**, cohérente avec les types SDK installés. Configurer la même version pour l’endpoint test dans Workbench. Les outils MCP exposaient un catalogue OpenAPI `2026-09-30.preview` ; le code de l’application n’utilise pas cette version preview. Lors de toute montée de version, revoir le changelog, les types, les fixtures et les tests du webhook.

Endpoint : `POST /api/stripe/webhook`. Sélectionner uniquement les événements :

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

Les notifications déclenchent une lecture de l’état courant de Stripe sous verrou utilisateur. Le corps brut est signé ; aucun crédit n’est attribué sur une redirection ou sur `checkout.session.completed` seul.

Localement, après connexion de la CLI au sandbox approprié :

```sh
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copier le secret affiché **dans `.env.local`**, puis redémarrer l’application. Le secret CLI diffère de celui d’un endpoint Dashboard. Pour une preview, créer la destination webhook sur l’URL HTTPS exacte puis configurer son propre secret. `stripe trigger invoice.paid` génère des objets artificiels non associés à vos utilisateurs : ce n’est pas un test de souscription VideoEasy. Une facture sans mapping reçoit une erreur réessayable et doit être inspectée.

Activer/configurer Smart Retries et les e-mails d’échec/authentification dans Revenue Recovery du sandbox. Ces réglages ne sont pas modifiés automatiquement.

Après configuration :

```sh
npm run check:stripe
npm run reconcile
```

`check:stripe` effectue seulement des lectures. Il ne teste ni le secret webhook ni un paiement. Planifier la réconciliation de test toutes les 5 minutes via un exécuteur sécurisé disposant des variables serveur ; elle ne crée aucun objet Stripe. Le garde-fou de génération refuse un état local non synchronisé depuis plus de 15 minutes.
