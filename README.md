# VideoEasy — intégration Stripe en environnement de test

Interface VideoEasy : accueil, aperçu interactif du studio, brouillons locaux, espace client authentifié et galerie en préparation. Voir [la livraison du studio](docs/studio-progress.md) et [l’étude HeliosGen](docs/heliosgen-review.md).

Base Next.js / TypeScript, authentification Supabase, Checkout hébergé, Customer Portal et allocations de crédits dans PostgreSQL Supabase. Aucune génération IA, aucun média public, aucun paiement réel.

| Formule  | Mensuel EUR | Crédits / période | Générations simultanées |
| -------- | ----------: | ----------------: | ----------------------: |
| Standard |        23 € |             1 000 |                       1 |
| Metal    |        35 € |             1 500 |                       2 |
| Gold     |        56 € |             2 500 |                       3 |

Prix TTC envisagés ; régime fiscal à confirmer. Les crédits sont des unités d’usage VideoEasy, jamais un avoir ou un solde Stripe. Sans essai gratuit, packs ou annuel. Changements de formule désactivés ; annulation à la fin de la période payée.

Le code est préparé et testé localement. **Il ne permet pas encore un paiement de bout en bout : les produits/tarifs, le portail, les secrets, le webhook hébergé et le projet Supabase restent à configurer.** Cisco a demandé de différer la création des produits tant que la situation fiscale n’est pas confirmée.

- [Configuration et prochaine action Stripe](docs/setup.md)
- [Plan officiel et architecture](docs/architecture.md)
- [Tests réalisés et scénarios Stripe à exécuter](docs/validation.md)
- [Réconciliation et incidents](docs/operations.md)

Node.js 24 recommandé. Démarrage après configuration :

```sh
npm ci
cp .env.example .env.local
# Renseigner .env.local dans un éditeur local sécurisé, jamais dans le chat.
npm run dev
```

```sh
npm test                 # tests sans connexion : les tests PostgreSQL sont explicitement ignorés
npm run typecheck
npm run build
```

Pour inclure les tests PostgreSQL, utiliser exclusivement une base locale jetable ; voir `docs/validation.md`. Ils recréent le schéma `billing` de cette base.
