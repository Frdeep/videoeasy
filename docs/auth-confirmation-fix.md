# Confirmation et connexion : traitement des liens expirés

## Problème observé

Les journaux Supabase montraient une vérification refusée avec « email link has expired », puis des connexions par mot de passe refusées avec `email_not_confirmed`. L’inscription existait mais sa confirmation n’avait pas abouti. Les erreurs étaient transmises dans le fragment d’URL (`#error_code=otp_expired`), invisible pour l’ancien handler serveur. L’utilisateur pouvait donc interpréter son clic comme une confirmation réussie, puis revenir aux demandes d’e-mail.

## Correctif

- La page `/auth/callback` lit les erreurs présentes dans la query string ou le fragment, puis nettoie l’URL avant de continuer. Aucun token ou message brut n’est conservé dans les redirections.
- Un lien expiré arrive sur un message explicite avec un accès à la connexion par mot de passe ou à la demande d’un nouveau lien.
- Un code PKCE est échangé par un POST de même origine à `/auth/exchange`. Le serveur exige une session obtenue puis un utilisateur vérifié avant d’annoncer la réussite. Les cookies sont conservés ; la navigation complète vers le compte force une lecture authentifiée à jour.
- L’absence de vérificateur PKCE (par exemple lorsqu’un lien est ouvert dans un autre navigateur) produit une récupération explicite par mot de passe. Aucun nouveau mail n’est envoyé automatiquement.
- Le renvoi de confirmation utilise une action séparée appelant `auth.resend(type: signup)`, uniquement après soumission volontaire du formulaire. La connexion par mot de passe n’appelle jamais signup, OTP ou resend, y compris lorsqu’elle échoue.
- Le lien magique ne crée plus implicitement un nouveau compte (`shouldCreateUser: false`). Les formulaires sont remontés lors du changement de mode pour éviter de garder des champs d’un autre parcours.

La confirmation d’adresse reste obligatoire. Aucun compte n’est confirmé manuellement et aucun mot de passe utilisateur n’est demandé ou modifié. Les templates Supabase, le service d’envoi et la durée de validité des liens restent inchangés. Le lien déjà expiré reste invalide : il faut en demander un nouveau explicitement.

## Vérification

84 tests automatisés passent, dont l’absence d’envoi de mail sur connexion, les erreurs de callback en fragment, le contrôle d’origine et la présence d’une session/utilisateur réellement vérifié. Build et contrôle TypeScript réussis.

Le test `scripts/test-auth-browser.cjs` utilise un fournisseur Supabase local simulé avec le véritable SDK, des sessions/cookies de fixture et Chromium. Il couvre : inscription, connexion non confirmée sans mail, lien expiré, renvoi explicite, échange PKCE, session conservée après rechargement, déconnexion/reconnexion par mot de passe et récupération depuis un autre navigateur sans vérificateur initial. Aucun vrai e-mail ni aucune génération n’est envoyé. La base utilisée par les pages du test est volontairement indisponible ; ce test ne valide pas les informations de facturation.

Pour le reproduire, fermer tout serveur Next.js de développement dans ce checkout, libérer les ports 3010 et 54329, puis :

```sh
npm ci
npm exec -- playwright install chromium
npm run test:auth-browser
```

Si Chromium est déjà installé :

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:auth-browser
```

Le script démarre et arrête son serveur de test ; il remplace les accès Supabase par ses fixtures et n’utilise pas les secrets des services réels. Le test est également ajouté à la CI. La confirmation finale et la connexion du compte réel doivent être vérifiées par son propriétaire après déploiement, sans partager son mot de passe ni son lien de confirmation.
