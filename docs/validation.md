# Vérifications et scénarios de validation

## Effectué dans cette session

- Inspection du dépôt : vide ; aucune intégration préexistante ni instruction locale.
- Outils officiels Stripe : compte test identifié, planificateur appelé et plan accepté, documentation consultée, produits/tarifs listés (aucun).
- Aucun produit, tarif, Customer, abonnement, configuration de portail ou paiement créé dans Stripe. Régime fiscal en attente sur demande de Cisco.
- `npm run build` : compilation Next.js réussie.
- `npm run typecheck` : réussi.
- **48 tests automatisés réussis**, dont 23 tests PostgreSQL sur PostgreSQL 17 local dans Docker. Les appels de paiement/synchronisation Stripe de ces tests sont **simulés**.
- Vérification HTTP sur le serveur compilé : pages offres, connexion, succès et annulation en 200 ; webhook non signé refusé en 400.
- `npm audit --omit=dev` : aucune vulnérabilité signalée ; vérification du formatage et du `.gitignore` réussie, seul `.env.example` est versionné.
- Signature webhook vérifiée avec le véritable SDK Stripe et des secrets de fixture, sans appel réseau.

La vérification d’un compte et du catalogue par MCP est une lecture réelle dans Stripe. Elle ne constitue pas un test réel de paiement.

| Scénario demandé                          | Automatisé localement                                                                       | Réellement exécuté dans Stripe        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| Souscription réussie                      | Checkout simulé, session et première facture payée                                          | Non, tarifs et secrets non configurés |
| Paiement nécessitant authentification     | Facture non payée refusée ; pas de navigateur 3-D Secure automatisé                         | Non                                   |
| Paiement refusé                           | Facture ouverte/impayée sans crédits, droits bloqués                                        | Non                                   |
| Renouvellement payé                       | Allocation mensuelle, expiration, réservation maintenue                                     | Non                                   |
| Échec renouvellement puis récupération    | past_due puis active/paid, allocation unique                                                | Non                                   |
| Annulation fin de période                 | Accès payé conservé, période expirée bloquée                                                | Non                                   |
| Livraison répétée webhook                 | Event ID unique, pas de second traitement                                                   | Non                                   |
| Deux traitements concurrents même facture | Vraies connexions PostgreSQL, un seul grant                                                 | Non                                   |
| Événements hors ordre                     | Ancien événement ne ressuscite pas canceled ; ancienne facture n’écrase pas le mois courant | Non                                   |
| Customer d’un autre utilisateur           | Requête rejetée et propriétaire vérifié                                                     | Non                                   |
| Prix/crédits modifiés dans le navigateur  | Schéma strict et permissions/RLS refusent les écritures                                     | Non                                   |

Autres tests : origine CSRF, Supabase `getUser` plutôt qu’une session non vérifiée, corps brut modifié/signature absente, événement live, rollback d’un événement en échec, tentative Checkout au résultat réseau incertain, réservation concurrente, restitution idempotente, synchronisation périmée, configuration Portal incompatible et reprise d’abonnement après annulation terminée.

## Reproduire les tests automatisés

Node.js 24 et Docker requis pour la partie PostgreSQL :

```sh
npm ci
# Base locale jetable uniquement. Le mot de passe ci-dessous n’est qu’une fixture locale.
docker run --name videoeasy-billing-test \
  -e POSTGRES_PASSWORD=local-test-only \
  -p 127.0.0.1:55432:5432 -d postgres:17-alpine
# Attendre que pg_isready réponde positivement :
docker exec videoeasy-billing-test pg_isready -U postgres
TEST_DATABASE_URL=postgresql://postgres:local-test-only@localhost:55432/postgres npm test
npm run typecheck
npm run build
```

Les tests DB recréent le schéma `billing` ; la variable `TEST_DATABASE_URL` doit être explicite et son hôte localhost/127.0.0.1. Le script bootstrap les rôles Supabase minimaux sur cette base jetable. Sans variable, ces tests sont affichés comme ignorés ; les autres restent exécutés. Nettoyage : `docker rm -f videoeasy-billing-test`.

## Parcours Stripe à exécuter après configuration

Utiliser uniquement les cartes et PaymentMethods officiels de test : https://docs.stripe.com/testing . Les identifiants de test ne sont pas des preuves de paiement.

1. Connecter un utilisateur Supabase de test, choisir Standard et payer avec la carte `4242 4242 4242 4242` (date future et CVC de test). Vérifier Customer unique, abonnement unique, facture payée, 1 000 crédits, puis Portal : facture consultable et moyen de paiement modifiable.
2. Pour un nouvel utilisateur, tester `4000 0025 0000 3155` pour le parcours d’authentification, en validant puis en abandonnant le challenge. Aucun crédit avant facture payée.
3. Tester une carte refusée, par exemple `4000 0000 0000 0002`. Le refus ne donne aucun crédit. Réessayer avec un moyen de paiement test accepté.
4. Ouvrir deux onglets de souscription en même temps pour un utilisateur sans abonnement. Vérifier qu’une seule session est réutilisée. Réessayer après timeout simulé : même clé d’idempotence, aucune seconde souscription.
5. Créer un utilisateur/Customer de test compatible avec une Test Clock via un montage de test contrôlé. L’application courante ne crée pas elle-même les clocks ; utiliser une fixture opérateur dans le sandbox avec mapping vérifié. Avancer jusqu’au renouvellement, vérifier une seule allocation et l’expiration des crédits disponibles précédents. Réserver d’abord une génération fictive via la fonction serveur, puis vérifier qu’elle reste suivie après renouvellement.
6. Pour l’échec de renouvellement, utiliser les PaymentMethods de simulation recommandés par la documentation Stripe ; contrôler `past_due`, absence de nouveaux crédits et blocage des lancements. Mettre à jour la carte dans le Portal, régler la facture, vérifier récupération sans double allocation.
7. Programmer l’annulation dans le Portal. Vérifier `cancel_at` et/ou `cancel_at_period_end`, l’accès jusqu’à la date payée puis le blocage après expiration. Aucun changement de formule proposé.
8. Dans Workbench, renvoyer plusieurs fois une vraie livraison de la facture payée. Envoyer aussi des livraisons parallèles et réordonner des événements d’une même souscription ; vérifier un seul grant et état courant conservé.
9. Déconnecté, tenter Checkout/Portal ; connecté, ajouter `customer`, `price` ou `credits` au JSON ; tenter une écriture via la clé Supabase publique : refus attendu. Vérifier les permissions du véritable projet Supabase, en complément de la base locale.
10. Interrompre temporairement le traitement webhook en test, observer 503/retry, rétablir puis exécuter `npm run reconcile`. Vérifier reprise sans double crédit. Contrôler qu’aucun secret ne figure dans les logs.

Consigner les Event IDs, Invoice IDs, statuts et résultats, sans secrets. Ces parcours restent **à exécuter**, et aucune réussite n’est revendiquée dans Stripe.
