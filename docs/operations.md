# Réconciliation et incidents

Toutes les opérations décrites concernent exclusivement l’environnement test. Garder les secrets dans le terminal local, `.env.local` ignoré ou le gestionnaire de secrets de l’exécuteur. Ne pas envoyer de capture contenant une clé.

## Événement en échec

Un échec de synchronisation renvoie 503 avec l’Event ID. Les logs ne contiennent que ce numéro et le type d’événement ; aucun corps, e-mail, token, secret ou erreur brute du SDK/base n’est journalisé.

1. Dans Workbench du sandbox, retrouver la livraison via son Event ID.
2. Vérifier la signature/secret de la bonne destination, la version API, la connexion base en mode session, les migrations et les variables de tarifs.
3. Exécuter la réconciliation ciblée ci-dessous. Réessayer ensuite la livraison dans Workbench. Un événement traité reste idempotent.

```sh
npm run reconcile -- UUID_UTILISATEUR_SUPABASE
# Ou réconciliation de tous les mappings connus :
npm run reconcile
```

Le script relit Stripe et écrit uniquement dans la base VideoEasy. Il n’effectue aucun paiement ni aucune création d’objet Stripe. Le faire exécuter toutes les 5 minutes par un scheduler sécurisé de test avant de brancher de vrais lancements IA. En l’absence de synchronisation depuis plus de 15 minutes, la réservation échoue sans lancer une génération.

Un Customer inconnu ne doit jamais être associé automatiquement par son e-mail ou des métadonnées non contrôlées. Vérifier l’origine de l’objet : un `stripe trigger` ou un test Dashboard indépendant n’a pas forcément de compte VideoEasy. Le webhook est dédié à l’app et au compte sandbox ; les objets sans mapping retournent une erreur réessayable et demandent une inspection opérateur. Ne pas ignorer aveuglément une alerte de livraison.

## Création Customer/Checkout au résultat incertain

Les intentions d’opération sont persistées avant l’appel Stripe. Réessayer la même formule rejoue la même clé d’idempotence pendant la fenêtre autorisée. Ne pas supprimer la tentative pour « débloquer » un timeout.

Après expiration d’une tentative sans Session ID, ou après 23 heures pour un mapping Customer incomplet, le code refuse une nouvelle création. L’opérateur doit, dans le bon sandbox :

1. Inspecter les logs de requête Stripe avec la clé `customer-<creation_key>` ou `checkout-<attempt_uuid>` provenant de la base privilégiée.
2. Retrouver le Customer ou la Session effectivement créés et confirmer utilisateur, prix, mode test et éventuel abonnement associé. Paginer les sessions du Customer si nécessaire.
3. Si l’objet existe, enregistrer son ID dans le mapping/tentative via une transaction privilégiée prenant **le même verrou utilisateur**. Ne jamais exposer cette correction au client.
4. Ne clôturer une tentative sans Session ID qu’après confirmation qu’aucune souscription/session ouverte n’existe et qu’aucune opération n’est encore en vol. Ne renouveler une intention Customer qu’après confirmation d’absence d’objet créé. Si l’incertitude persiste, laisser bloqué.
5. Exécuter la réconciliation ciblée puis réessayer le parcours.

La réconciliation ordinaire traite les mappings possédant déjà un Customer ID ; elle ne devine pas le résultat d’une création incertaine.

## Droits et crédits

Consulter les lignes privées `billing.subscriptions`, `invoices`, `credit_grants`, `reservations`, `credit_movements` et `events`. Les mouvements sont des unités VideoEasy, jamais des euros. Un `consume` a un delta de solde nul car les crédits ont déjà été retirés par `reserve`.

Ne pas ajouter des crédits à la main pour corriger une livraison : rejouer la synchronisation d’une facture payée éligible. Ne pas restituer au mois courant une réservation échouée après expiration de son mois d’origine. Une réservation bloquée ne doit être clôturée qu’après avoir vérifié l’état de génération chez le fournisseur ; ce worker IA reste hors périmètre.

## Production

Aucune configuration de production ou déploiement n’a été réalisé. Le code refuse les clés live. Une future mise en production nécessitera une revue séparée : fiscalité, catalogue, politiques de paiement/remboursement, configuration Supabase, secrets, domaine, webhook, reprise des jobs, alertes et tests de bout en bout. La branche actuelle est destinée à une PR en brouillon.
