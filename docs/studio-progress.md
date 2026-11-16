# VideoEasy — première livraison du studio

## Livré

- Accueil responsive avec identité sombre/violette et illustrations CSS originales.
- `/explore` : aperçu public interactif, saisie du prompt, exemples d’inspiration, choix image/vidéo, ratios de composition et brouillon conservé uniquement sur l’appareil.
- `/studio`, `/gallery`, `/account` : routes privées avec authentification Supabase vérifiée. Rendu dynamique imposé pour ne pas mettre en cache le contrôle d’accès.
- `/account` : abonnement et crédits lus côté serveur dans la base de facturation existante. Aucun utilisateur ou crédit de démonstration.
- `/gallery` : état vide explicite ; aucun média fictif présenté comme appartenant au client.
- `/pricing` : parcours Stripe existant conservé ; connexion, retour paiement et gestion du compte intégrés à la navigation.
- `/admin` refuse tout affichage d’administration ; l’administration réelle reste à construire avec des rôles vérifiés côté serveur.

## Vérifié

48 tests existants de facturation/authentification/signatures et concurrence PostgreSQL réussis, contrôle TypeScript et build Next.js réussis. Smoke Chromium desktop/mobile : brouillon conservé après rechargement, sélection du ratio, génération désactivée, absence de débordement horizontal à 390 px, redirection vers connexion pour les quatre routes privées, présence des trois offres et aucune erreur JavaScript. Les captures ont été inspectées localement.

Les routes privées ont été testées sans configuration Supabase (redirection de préparation). Une session Supabase réelle, un abonnement réel test et les données du tableau de bord restent à valider avec le projet configuré.

## Pas encore livré

Aucun appel fournisseur, upload de référence, tarif de modèle, worker asynchrone, stockage R2, téléchargement, suppression de média ou tableau de bord administrateur opérationnel. L’inscription/connexion par mot de passe du document reste à ajouter ; la connexion actuelle est le lien magique Supabase. Aucun accès payant fictif et aucune génération gratuite.

La génération est volontairement désactivée jusqu’à la vérification du catalogue, des coûts et du compte Kie.ai. Les formats du studio sont des choix de composition d’aperçu, pas une affirmation sur les capacités d’un modèle activé. Les crédits ne sont pas dépensés par l’aperçu.

## Suite technique

1. Configurer le projet Supabase test selon `docs/setup.md` et vérifier un parcours client authentifié.
2. Valider un premier modèle Kie.ai (droits commerciaux mutualisés, contrat API, options et coût), puis configurer la clé exclusivement dans les secrets serveur ; ne jamais la transmettre dans le chat.
3. Ajouter catalogue administrateur, outbox de génération et worker récupérable, puis stockage privé R2 et contrôle propriétaire des téléchargements.
4. Compléter les réservations avec rapprochement du coût réel et gestion des échecs facturés/non facturés. La fonction de règlement actuelle de la phase Stripe applique un coût fixe et ne couvre pas encore les ajustements fournisseur.
5. Ajouter administration et tests multi-utilisateurs de génération avant ouverture commerciale.

Le régime fiscal et la création du catalogue Stripe restent différés conformément à la décision de Cisco. Aucun déploiement en production ni appel Kie.ai payant n’a été effectué.
