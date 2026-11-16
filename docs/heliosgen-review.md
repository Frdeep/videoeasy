# Étude HeliosGen — première étape VideoEasy

Inspection du dépôt https://github.com/SegFault42/HeliosGen au commit `99dd5b12c05d5e883e03e9c9ea5a8e88120bf273`.

Le README annonce une licence MIT, mais aucun fichier LICENSE autonome n’est présent à la racine inspectée et package.json n’indique pas de licence. Confirmer le texte de licence et les attributions avant toute réutilisation de code. Aucun code, asset ni dépendance HeliosGen n’a été copié dans cette itération.

## Observations concrètes

- Next.js 16, React 19 et TypeScript ; Tauri pour l’emballage desktop.
- `lib/modelConfig.ts` décrit les capacités des modèles (paramètres, ratios, formats et limites de prompt). Le principe d’un catalogue central est pertinent pour VideoEasy, mais les tarifs et capacités doivent être vérifiés avec la documentation actuelle du fournisseur.
- `lib/getKieToken.ts` charge une clé personnelle depuis `lib/guest/db`. Ce stockage n’est pas adapté au compte fournisseur mutualisé de VideoEasy.
- `lib/kieJobPoller.ts` interroge `/api/v1/jobs/recordInfo`, utilise un ensemble de tâches en mémoire et un polling de 3 secondes. Il distingue aussi les routes Veo. Ces observations ne constituent pas une validation actuelle des contrats API Kie.ai.
- Les données locales SQLite et les boucles en mémoire ne conviennent pas aux processus Vercel éphémères ou à l’isolation entre utilisateurs.
- Les dépendances incluent notamment React Flow, Zustand, Motion, Sharp, Undici et Tauri. Elles n’ont pas été installées ni auditées transitivement : aucun besoin établi dans le premier studio VideoEasy.

## Décision

Conserver VideoEasy comme application indépendante avec son authentification et sa comptabilité de crédits serveur. Reprendre les idées d’interface et de séparation des capacités, sans importer le runtime desktop ni sa gestion de clé personnelle.

Pour la génération future : catalogue versionné en base administrateur, validation de paramètres côté serveur, réservation atomique existante, intention de tâche durable avant appel fournisseur, worker récupérable, vérification des états fournisseur, miroir R2 privé et rapprochement des coûts. Un résultat réseau incertain ne doit pas libérer les crédits ni relancer la génération aveuglément.

L’activation d’un modèle demande : contrat commercial mutualisé confirmé, identifiant API vérifié, options supportées, prix fournisseur actuel, règle d’arrondi et marge validées. Aucun modèle ni tarif hypothétique n’est activé dans cette livraison.
