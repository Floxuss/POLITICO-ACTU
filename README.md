# Politico Actu

Suivi sobre de l'actualité politique française : agrège UNIQUEMENT les rubriques « Politique »
de rédactions professionnelles de référence (Le Monde, Le Figaro, Libération, France Info,
Sud Ouest) et les présente dans un fil unique, groupé par jour, filtrable par source
et par thème (Exécutif, Parlement, Élections & sondages, Partis, Europe).

## Politique de sourcement

- Uniquement des médias de référence : rédactions professionnelles, signataires
  de chartes de déontologie journalistique, fondées sur le recoupement des
  sources et la correction publique des erreurs.
- Ne sont PAS agrégés : sites militants, médias complotistes ou relayant
  majoritairement de la désinformation, chaînes d'info-spectacle, agrégateurs
  non sourcés.
- Chaque article renvoie à sa source originale (lien, date, rédaction).

## Fonctionnement

- **Collecte** (`lib/collect.js` + `scripts/collect.js`) : récupère les flux RSS,
  nettoie les contenus, tri par date, écrit `public/data/news.json`.
- **Serveur** (`server.js`, Node + Express) : sert le site en local, recollecte en
  arrière-plan toutes les 10 minutes.
- **Frontend** (`public/`) : HTML/CSS/JS sans framework, charge `data/news.json`
  (statique sur GitHub Pages, régénéré par le serveur en local).

## Héberger sur GitHub Pages (gratuit, sans serveur)

1. Dans le dépôt GitHub : **Settings → Pages → Build and deployment → Source** :
   choisir **« GitHub Actions »**.
2. Le workflow `.github/workflows/collect-and-deploy.yml` fait le reste :
   - déclenché à chaque push sur `main`, toutes les 15 minutes, ou manuellement
     (**Actions → Collecte et publication → Run workflow**) ;
   - il collecte les articles, puis publie le site avec les données actualisées.

Le site est ensuite disponible à
`https://<votre-compte>.github.io/POLITICO-ACTU/`.

Notes : la première collecte automatique peut prendre jusqu'à 15 minutes après
l'activation ; pour l'activer immédiatement, lancer le workflow manuellement.
Les horaires planifiés ne s'exécutent que si le dépôt reste actif (API GitHub).

## Lancer en local (mode serveur)

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000

Variables d'environnement : `PORT` (3000 par défaut).

## Endpoints

- `GET /api/news` — articles agrégés (+ métadonnées : date de mise à jour, sources en erreur).
- `GET /api/refresh` — vide le cache et relance une collecte.
- `GET /` — interface.

## Ajouter une source

Ajouter un objet `{ id, name, feed, site }` au tableau `SOURCES` de `lib/collect.js`.
Les flux en échec sont signalés discrètement en pied de fil sans casser le reste.
