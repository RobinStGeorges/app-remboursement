# app-remboursement — Le Petit Perchoir

Suivi des remboursements du portail familial, servi sous **https://lepetitperchoir.fr/remboursement/**.
Application indépendante (dépôt, données et déploiement séparés), intégrée au portail via `famille-core` (v0.2.0).

## Fonctionnement
- **Accueil** : liste des remboursements (en cours d'abord, puis les remboursés, grisés avec ✅),
  avec le reste à payer et une barre de progression. Bouton « Nouveau remboursement » :
  somme totale, libellé, créditeur (avec suggestions des noms déjà saisis), date du prêt.
- **Vue d'un remboursement** (`#/pret/<id>`) : en haut « Il reste encore xxx € à rembourser à xxx »,
  puis le bouton « Nouveau paiement » (somme, description facultative, date ; bouton « Tout le reste »),
  puis la liste des paiements, du plus récent au plus ancien.
- Appuyer sur un paiement ouvre une fenêtre pour le **modifier** ou le **supprimer** (avec confirmation).
- ✏️ en haut de la vue : modifier le remboursement, ou le supprimer avec tous ses paiements (avec confirmation).
- Un paiement plus élevé que le reste est accepté, avec un avertissement ; le trop-perçu est affiché.
- Données partagées avec toute la famille, utilisables hors connexion (envoi au retour du réseau).

## Données
- `families/{familyId}/apps/remboursement/prets/{pretId}` →
  `{ libelle, crediteur, montantCentimes, datePret: "AAAA-MM-JJ", createdAt, createdBy, updatedAt }`
- `families/{familyId}/apps/remboursement/paiements/{paiementId}` →
  `{ pretId, montantCentimes, description, date: "AAAA-MM-JJ", createdAt, createdBy, updatedAt }`
- Montants en **centimes entiers** (pas d'erreur d'arrondi). Un document par paiement : pas de conflit entre
  deux téléphones. Le reste à payer est recalculé à partir des paiements (aucun compteur à tenir à jour).
- Aucune règle Firestore à modifier (règle générique `apps/{id}`).

## Développement
```bash
npm install
npm run dev        # http://localhost:5179/remboursement/ (projet Firebase famille-dev)
npm test           # Vitest : calculs, saisies, écrans, navigation, changement de famille
npm run check      # svelte-check
npm run build      # dist/
```

## Déploiement (Cloudflare Workers Builds)
- Dépôt GitHub `app-remboursement`, branche `main`.
- Build command : `npm run build` — Deploy command : `npx wrangler deploy`.
- Nom du Worker : **`famille-remboursement`** (le routeur envoie `/remboursement/…` vers ce Worker).

## Tuile du portail (document `catalog/remboursement`)
| Champ | Valeur |
|---|---|
| `name` | `Remboursements` |
| `description` | `Qui doit combien à qui` |
| `icon` | `💶` |
| `color` | `#2e8b57` |
| `path` | `/remboursement/` |
| `status` | `active` |
| `order` | au choix (ex. `80`) |
| `famillesAutorisees` | facultatif (vide = toutes les familles) |
