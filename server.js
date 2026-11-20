"use strict";

const express = require("express");
const path = require("path");
const { collectNews, writeNewsFile } = require("./lib/collect");

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = { data: null, fetchedAt: 0 };
let inflight = null;

function getNews() {
  const fresh = cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return Promise.resolve(cache.data);
  if (!inflight) {
    inflight = collectNews()
      .then((data) => {
        cache.data = data;
        cache.fetchedAt = Date.now();
        writeNewsFile(data);
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

app.get("/api/news", async (req, res) => {
  try {
    res.json(await getNews());
  } catch (error) {
    res.status(502).json({ error: "Impossible de récupérer les flux pour le moment." });
  }
});

app.get("/api/refresh", async (req, res) => {
  cache.fetchedAt = 0;
  try {
    const data = await getNews();
    res.json({ ok: true, total: data.total, fetchedAt: data.fetchedAt });
  } catch (error) {
    res.status(502).json({ error: "Rafraîchissement impossible." });
  }
});

app.listen(PORT, () => {
  console.log(`Politico Actu — http://localhost:${PORT}`);
  getNews().then((data) => console.log(`Collecte initiale : ${data.total} articles`));
});
