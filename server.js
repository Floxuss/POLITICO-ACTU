"use strict";

const express = require("express");
const path = require("path");
const Parser = require("rss-parser");

const PORT = process.env.PORT || 3000;

const SOURCES = [
  {
    id: "lemonde",
    name: "Le Monde",
    feed: "https://www.lemonde.fr/politique/rss_full.xml",
    site: "https://www.lemonde.fr/politique/",
  },
  {
    id: "figaro",
    name: "Le Figaro",
    feed: "https://www.lefigaro.fr/rss/figaro_politique.xml",
    site: "https://www.lefigaro.fr/politique",
  },
  {
    id: "liberation",
    name: "Libération",
    feed: "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml",
    site: "https://www.liberation.fr/politique/",
    include: "/politique/",
  },
  {
    id: "franceinfo",
    name: "France Info",
    feed: "https://www.francetvinfo.fr/politique.rss",
    site: "https://www.francetvinfo.fr/politique/",
  },
  {
    id: "sudouest",
    name: "Sud Ouest",
    feed: "https://www.sudouest.fr/politique/rss.xml",
    site: "https://www.sudouest.fr/politique/",
  },
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const ITEMS_PER_SOURCE = 25;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
});

const cache = { items: [], fetchedAt: 0, sources: new Map(), errored: [] };
let inflight = null;

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + " …";
}

function parseItemDate(entry) {
  if (entry.isoDate) return new Date(entry.isoDate);
  if (entry.pubDate) return new Date(entry.pubDate);
  return new Date(NaN);
}

async function fetchSource(source) {
  const feed = await parser.parseURL(source.feed);
  const items = (feed.items || [])
    .filter((entry) => !source.include || (entry.link || "").includes(source.include))
    .map((entry) => {
      const date = parseItemDate(entry);
      return {
        id: `${source.id}:${(entry.guid || entry.link || entry.title || "").slice(0, 250)}`,
        source: source.id,
        sourceName: source.name,
        title: stripHtml(entry.title || "Sans titre"),
        url: entry.link || source.site,
        snippet: clamp(stripHtml(entry.contentSnippet || entry.content || ""), 220),
        date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      };
    })
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, ITEMS_PER_SOURCE);
  return items;
}

async function collectNews() {
  const results = await Promise.allSettled(SOURCES.map((s) => fetchSource(s)));
  const items = [];
  const counts = new Map();
  const errored = [];

  results.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === "fulfilled") {
      counts.set(source.id, result.value.length);
      items.push(...result.value);
    } else {
      errored.push(source.id);
      counts.set(source.id, 0);
    }
  });

  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  cache.items = items;
  cache.fetchedAt = Date.now();
  cache.sources = counts;
  cache.errored = errored;
  return cache;
}

function getNews() {
  const fresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh && (cache.items.length || cache.fetchedAt)) {
    return Promise.resolve(cache);
  }
  if (!inflight) {
    inflight = collectNews().finally(() => {
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
    const data = await getNews();
    res.json({
      fetchedAt: new Date(data.fetchedAt).toISOString(),
      total: data.items.length,
      errored: data.errored,
      counts: Object.fromEntries(data.sources),
      items: data.items,
    });
  } catch (error) {
    res.status(502).json({ error: "Impossible de récupérer les flux pour le moment." });
  }
});

app.get("/api/refresh", async (req, res) => {
  cache.fetchedAt = 0;
  try {
    const data = await getNews();
    res.json({ ok: true, total: data.items.length, fetchedAt: new Date(data.fetchedAt).toISOString() });
  } catch (error) {
    res.status(502).json({ error: "Rafraîchissement impossible." });
  }
});

app.listen(PORT, () => {
  console.log(`Politico Actu — http://localhost:${PORT}`);
});
