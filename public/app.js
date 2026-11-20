"use strict";

const state = {
  items: [],
  topic: "tous",
  hiddenSources: new Set(),
  query: "",
  failedSources: new Set(),
};

const TOPIC_KEYWORDS = {
  executif: [
    "élysée", "président de la république", "macron", "premier ministre",
    "gouvernement", "ministre", "ministère", "matignon", "conseil des ministres",
    "porte-parole", "remaniement",
  ],
  parlement: [
    "assemblée nationale", "sénat", "député", "sénateur", "sénatrice",
    "motion de censure", "hémicycle", "projet de loi", "proposition de loi",
    "examen du texte", "49.3", "amendement", "commission mixte paritaire",
    "questions au gouvernement", "budget de l'etat", "vote du budget",
  ],
  elections: [
    "élection", "législatives", "municipales", "présidentielle", "régionales",
    "départementales", "sondage", "intentions de vote", "scrutin", "candidat",
    "candidature", "tête de liste", "campagne", "bureau de vote",
  ],
  partis: [
    "renaissance", "rassemblement national", "les républicains", "parti socialiste",
    "la france insoumise", "insoumis", "écologistes", "parti communiste",
    "modem", "horizons", "congrès", "bureau politique", "secrétaire général",
  ],
  europe: [
    "bruxelles", "union européenne", "parlement européen", "commission européenne",
    "sommet", "diplomatie", "ukraine", "russie", "israël", "palestine", "otan",
    "g7", "g20", "chine", "états-unis", "washington", "trump", "syrie", "sahel",
    "guerre", "sanctions", "conseil européen", "eurodéputé",
  ],
};

const TOPIC_LABELS = {
  executif: "Exécutif",
  parlement: "Parlement",
  elections: "Élections & sondages",
  partis: "Partis",
  europe: "Europe & International",
};

const FALLBACK_SOURCE_NAMES = {
  lemonde: "Le Monde",
  figaro: "Le Figaro",
  liberation: "Libération",
  franceinfo: "France Info",
  bfmtv: "BFM Politique",
  sudouest: "Sud Ouest",
};

const MIN_KEYWORD_LENGTH = 4;

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectTopic(item) {
  const haystack = normalize(`${item.title} ${item.snippet}`);
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => {
      const needle = normalize(kw).trim();
      return needle.length >= MIN_KEYWORD_LENGTH && haystack.includes(needle);
    })) {
      return topic;
    }
  }
  return null;
}

function itemMatches(item) {
  if (state.topic !== "tous" && item.topic !== state.topic) return false;
  if (state.hiddenSources.has(item.source)) return false;
  if (state.query) {
    const haystack = normalize(`${item.title} ${item.snippet} ${item.sourceName}`);
    if (!state.query.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  return true;
}

/* ---------- Formateurs ---------- */

const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key) {
  const today = dayKey(new Date().toISOString());
  if (key === today) return "Aujourd’hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === dayKey(yesterday.toISOString())) return "Hier";
  const [y, m, d] = key.split("-").map(Number);
  const label = dayFmt.format(new Date(y, m - 1, d));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ---------- Rendu ---------- */

const feedEl = document.getElementById("feed");
const loadingEl = document.getElementById("loading");
const sourceFiltersEl = document.getElementById("source-filters");
const searchEl = document.getElementById("search");
const resetEl = document.getElementById("reset");
const refreshInfoEl = document.getElementById("refresh-info");

let latestCounts = new Map();
let latestNames = new Map();

function renderSourceFilters() {
  sourceFiltersEl.innerHTML = "";
  [...latestNames.entries()]
    .sort((a, b) => (latestCounts.get(b[0]) || 0) - (latestCounts.get(a[0]) || 0))
    .forEach(([id, name]) => {
      const btn = document.createElement("button");
      btn.className = "source-filter" + (state.hiddenSources.has(id) ? " is-off" : "");
      const label = document.createElement("span");
      label.textContent = name;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = state.hiddenSources.has(id) ? "masquée" : `${latestCounts.get(id) || 0}`;
      btn.append(label, count);
      btn.addEventListener("click", () => {
        if (state.hiddenSources.has(id)) state.hiddenSources.delete(id);
        else state.hiddenSources.add(id);
        renderSourceFilters();
        render();
      });
      sourceFiltersEl.append(btn);
    });
}

function render() {
  const visible = state.items.filter(itemMatches);

  resetEl.hidden =
    state.topic === "tous" && state.hiddenSources.size === 0 && !state.query;
  document.querySelectorAll(".topic").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.topic === state.topic);
  });

  feedEl.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = state.items.length
      ? "Aucun article ne correspond à ces filtres."
      : "Aucun article disponible pour le moment.";
    feedEl.append(empty);
    return;
  }

  const byDay = new Map();
  for (const item of visible) {
    const key = dayKey(item.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  }

  for (const [key, items] of byDay) {
    const header = document.createElement("div");
    header.className = "day-header";
    const title = document.createElement("h2");
    title.className = "day-title";
    title.textContent = dayLabel(key);
    const line = document.createElement("span");
    line.className = "day-line";
    const count = document.createElement("span");
    count.className = "day-count";
    count.textContent = `${items.length} article${items.length > 1 ? "s" : ""}`;
    header.append(title, line, count);
    feedEl.append(header);

    for (const item of items) feedEl.append(renderItem(item));
  }

  if (state.failedSources.size) {
    const note = document.createElement("p");
    note.className = "error-note";
    note.textContent =
      "Flux momentanément indisponibles : " + [...state.failedSources].join(", ") + ".";
    feedEl.append(note);
  }
}

function renderItem(item) {
  const article = document.createElement("article");
  article.className = "item";

  const top = document.createElement("div");
  top.className = "item-top";

  const source = document.createElement("span");
  source.className = "item-source";
  source.textContent = item.sourceName;

  const dot = document.createElement("span");
  dot.className = "item-dot";
  dot.textContent = "·";

  const topic = document.createElement("span");
  topic.className = "item-topic";
  topic.textContent = item.topic ? TOPIC_LABELS[item.topic] : "Politique";

  const time = document.createElement("span");
  time.className = "item-time";
  time.textContent = timeFmt.format(new Date(item.date));

  top.append(source, dot, topic, time);

  const link = document.createElement("a");
  link.className = "item-link";
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title;

  article.append(top, link);

  if (item.snippet) {
    const snippet = document.createElement("p");
    snippet.className = "item-snippet";
    snippet.textContent = item.snippet;
    article.append(snippet);
  }

  return article;
}

/* ---------- Chargement ---------- */

function updateRefreshInfo(data) {
  const when = new Date(data.fetchedAt);
  refreshInfoEl.textContent = `Mis à jour à ${timeFmt.format(when)} — ${data.total} articles.`;
}

async function load() {
  try {
    const res = await fetch("/api/news");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.items = data.items;
    state.failedSources = new Set(data.errored);

    latestCounts = new Map(Object.entries(data.counts));
    latestNames = new Map();
    for (const item of data.items) {
      if (!latestNames.has(item.source)) latestNames.set(item.source, item.sourceName);
    }
    for (const id of data.errored) {
      if (FALLBACK_SOURCE_NAMES[id]) latestNames.set(id, FALLBACK_SOURCE_NAMES[id]);
    }

    if (loadingEl.isConnected) loadingEl.remove();
    renderSourceFilters();
    updateRefreshInfo(data);
    render();
  } catch (err) {
    loadingEl.textContent =
      "Impossible de charger le fil. Vérifiez votre connexion, puis rechargez la page.";
  }
}

/* ---------- Événements ---------- */

document.getElementById("topics").addEventListener("click", (event) => {
  const btn = event.target.closest(".topic");
  if (!btn) return;
  state.topic = btn.dataset.topic;
  render();
});

searchEl.addEventListener("input", () => {
  state.query = normalize(searchEl.value.trim());
  render();
});

resetEl.addEventListener("click", () => {
  state.topic = "tous";
  state.hiddenSources.clear();
  state.query = "";
  searchEl.value = "";
  renderSourceFilters();
  render();
});

/* ---------- Démarrage ---------- */

document.getElementById("dateline").textContent =
  dayFmt.format(new Date()).replace(/^./, (c) => c.toUpperCase()) +
  " — " +
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date());

load();
setInterval(load, 10 * 60 * 1000);
