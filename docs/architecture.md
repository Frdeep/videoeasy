# Plan officiel et décisions d’intégration

Le 16 novembre 2026, `stripe_implementation_planner` a reçu le brief complet de Cisco, puis le guide retourné a été accepté avec les choix :

- Checkout hébergé dans le navigateur, intégration sur mesure Next.js.
- Prix fixe mensuel, paiement à la souscription, aucun accès gratuit.
- Facturation flexible pour les abonnements.
- Customer Portal avec annulation en fin de période ; modifications de formule désactivées.
- Smart Retries et e-mails Stripe pour la récupération des paiements.
- Décision fiscale différée ; aucune hypothèse de taux ou d’éligibilité à Managed Payments.

Guide officiel obtenu : `iguide_61VldE2J3UmOku21Y41E8CwFcF746`, statut `accepted`. L’outil a refusé une première acceptation contenant deux choix Checkout ; la sélection a été corrigée pour ne garder que Checkout hébergé. Le contenu métier et les tests de crédits ci-dessous sont l’implémentation VideoEasy, pas une garantie émise par le planificateur Stripe.

Références Stripe consultées via la recherche documentaire officielle et les schémas API :

- https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted
- https://docs.stripe.com/billing/subscriptions/billing-mode
- https://docs.stripe.com/billing/subscriptions/billing-mode/compare
- https://docs.stripe.com/subscriptions/pricing-models/flat-rate-pricing
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/billing/revenue-recovery
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/api/invoices/object

## Parcours et responsabilité du serveur

`src/lib/plans.ts` contient le catalogue public (prix indicatif, crédits, simultanéité). `src/lib/config.ts` relie côté serveur les formules à leurs Price IDs autorisés.

`POST /api/billing/checkout` vérifie l’origine contre `APP_URL`, vérifie l’utilisateur via Supabase `auth.getUser()` et n’accepte qu’un objet `{ "plan": "standard" | "metal" | "gold" }`, sans propriété supplémentaire. Il n’accepte pas de prix, Customer, crédits ou URL de retour du navigateur.

Un mapping unique relie l’UUID Supabase au Customer Stripe. L’e-mail seul n’est jamais une identité de rapprochement. Le serveur crée le Customer avec une clé d’idempotence durable et vérifie ses métadonnées de propriétaire avant de le réutiliser. Sous verrou utilisateur, il consulte les abonnements courants et refuse toute nouvelle souscription tant qu’un abonnement non terminal existe, y compris incomplet ou impayé.

Une tentative Checkout durable garde sa formule, son Price ID, son origine, son expiration et son UUID d’idempotence. Une session encore ouverte est réutilisée ; une deuxième formule est refusée jusqu’à expiration. Une réponse réseau perdue est rejouée avec la même clé et les mêmes paramètres. Au-delà de la fenêtre de sécurité, le traitement s’arrête pour réconciliation plutôt que risquer un doublon. Les sessions expirent après environ 31 minutes, avec marge sur le minimum Stripe de 30 minutes.

Le Portal reçoit exclusivement le Customer associé à l’utilisateur vérifié. Les factures et moyens de paiement restent chez Stripe. Les pages succès/annulation ne modifient aucune donnée et n’accordent aucun crédit.

## Données et transactions

Le schéma privé `billing` conserve : mapping clients, tentatives Checkout, abonnements, factures, événements traités, allocations, réservations et mouvements. Aucune donnée de carte ou payload complet n’est enregistré. Les droits client sont révoqués et RLS est activée sans politique client. Les transactions utilisent une connexion PostgreSQL privilégiée côté serveur, jamais une clé dans le navigateur.

Les écritures de facturation prennent un verrou PostgreSQL par UUID utilisateur, commun avec les fonctions de réservation. La connexion dédiée garde ce verrou entre commits lorsque des identifiants d’opérations doivent être durables avant un appel Stripe. D’où l’exigence de connexion directe/session pooler.

Le webhook vérifie d’abord la signature sur le corps brut et refuse le live. Sous le verrou, une transaction insère l’Event ID unique, recharge les abonnements et factures actuels depuis Stripe, synchronise les données puis marque le traitement par le commit. Une erreur annule aussi le marqueur d’événement et renvoie HTTP 503 ; Stripe peut réessayer. Les notifications en retard ne réappliquent pas leurs anciens snapshots. Les listes sont entièrement paginées, y compris les lignes de facture. Une réconciliation exécute le même chemin sans dépendre des événements manqués.

Une facture éligible doit être en test, `paid`, en EUR, avec un montant payé strictement positif et `billing_reason` égal à `subscription_create` ou `subscription_cycle`. Elle doit avoir une seule ligne correspondant à un tarif autorisé, une quantité 1, le montant nominal prévu et aucune proratisation. Le rattachement abonnement/ligne doit correspondre. Les essais, factures à zéro, ajustements, lignes supplémentaires et tarifs inconnus n’attribuent rien. Les allocations sont uniques par facture **et** par abonnement/période de début ; deux événements différents ou deux workers ne peuvent pas doubler les crédits.

## Expiration, réservation et droits

Les crédits sont valables sur la période de service de la ligne mensuelle payée, sans report. Les anciens crédits disponibles expirent à la fin de cette période, même si le renouvellement échoue. Leur solde inutilisable est mis à zéro lors du prochain webhook ou de la réconciliation ; les requêtes de droits excluent immédiatement les périodes expirées.

`billing.reserve_credits(user_uuid, job_uuid, server_cost)` réserve les crédits et une place de simultanéité atomiquement. L’UUID utilisateur doit venir de l’authentification serveur ; le coût doit être calculé côté serveur à partir du modèle IA choisi. Cette fonction n’est pas accessible aux rôles navigateur. Aucun endpoint IA n’est ajouté dans ce périmètre.

Le lancement exige : un seul abonnement non terminal, statut `active`, formule connue, allocation payée pour la période exacte, date courante incluse, éventuelle date d’annulation non atteinte et synchronisation récente (<15 min). Les états incomplet, past_due, unpaid, paused et canceled bloquent les nouveaux lancements. Une annulation programmée reste active jusqu’à la fin payée. Une génération déjà réservée peut toujours terminer.

`settle_reservation` est idempotente. Succès : consommation ; échec : restitution dans le même mois seulement. Si le mois est expiré, la réservation est clôturée sans créditer le nouveau mois. Les réservations en cours continuent à compter dans la simultanéité pendant le renouvellement. Un worker futur doit garantir leur clôture, et consulter le fournisseur avant de relancer une tâche au résultat incertain.

## Limites de cette première base

La synchronisation recharge tout l’historique du Customer sous verrou. C’est adapté à la vérification initiale ; à grande échelle, passer à une file de jobs par utilisateur et une réconciliation incrémentale avec pagination durable. Un dépassement de durée serveur provoque une nouvelle livraison sans commit partiel. Surveiller la durée avant d’accumuler des années d’historique.

Les changements de formule, crédits supplémentaires, remises, remboursements automatiques, litiges et révocations financières rétroactives ne sont pas implémentés. Ne pas modifier manuellement les formules ni appliquer des offres promotionnelles dans le Dashboard pendant la validation. Définir une politique de remboursement/litige avant le lancement commercial. Aucun code Kie.ai, R2 ou génération de média n’est ajouté.
