# Politico Actu

Suivi sobre de l'actualité politique française : agrège les rubriques « Politique »
des grands médias français (Le Monde, Le Figaro, Libération, France Info,
BFM Politique, Sud Ouest) et les présente dans un fil unique, groupé par jour,
filtrable par source et par thème (Exécutif, Parlement, Élections & sondages,
Partis, Europe).

## Fonctionnement

- **Serveur** (`server.js`, Node + Express + rss-parser) : récupère les flux RSS,
  nettoie les contenus, tri par date et met en cache en mémoire pendant 10 minutes.
- **Frontend** (`public/`) : HTML/CSS/JS sans framework, typographie éditoriale
  inspirée de la presse quotidienne.

## Lancer

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

Ajouter un objet `{ id, name, feed, site }` au tableau `SOURCES` en tête de `server.js`.
Les flux en échec sont signalés discrètement en pied de fil sans casser le reste.
