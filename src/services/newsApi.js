const CACHE_KEY = "playfulbet:sports-news:v9";
const CACHE_TTL = 3 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SPORT_IMAGE = {
  "Fútbol": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "Baloncesto": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "Tenis": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-tennis.png",
  "Béisbol": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  "Hockey": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
};

const sportImageFor = (sport) => SPORT_IMAGE[sport] || null;

const SPORT_QUOTAS = [
  { key: "Fútbol", max: 4 },
  { key: "Baloncesto", max: 3 },
  { key: "Tenis", max: 2 },
  { key: "Béisbol", max: 1 },
  { key: "Hockey", max: 1 },
];

const SPORT_ALIASES = {
  "UEFA Champions League": "Fútbol",
  "Champions League": "Fútbol",
  "Europa League": "Fútbol",
  "Conference League": "Fútbol",
  "FIFA World Cup": "Fútbol",
  "World Cup": "Fútbol",
  "Mundial": "Fútbol",
  "UEFA European Championship": "Fútbol",
  "European Championship": "Fútbol",
  "Eurocopa": "Fútbol",
  "Spanish LALIGA": "Fútbol",
  "Spanish LaLiga": "Fútbol",
  "LaLiga": "Fútbol",
  "English Premier League": "Fútbol",
  "Premier League": "Fútbol",
  "Italian Serie A": "Fútbol",
  "Serie A": "Fútbol",
  "German Bundesliga": "Fútbol",
  "Bundesliga": "Fútbol",
  "French Ligue 1": "Fútbol",
  "Ligue 1": "Fútbol",
  "Soccer": "Fútbol",
  "Football": "Fútbol",
  "Fútbol": "Fútbol",
  "NBA": "Baloncesto",
  "Basketball": "Baloncesto",
  "Baloncesto": "Baloncesto",
  "Euroleague": "Baloncesto",
  "EuroLeague": "Baloncesto",
  "Euroliga": "Baloncesto",
  "ATP": "Tenis",
  "WTA": "Tenis",
  "Tennis": "Tenis",
  "Tenis": "Tenis",
  "Wimbledon": "Tenis",
  "Roland Garros": "Tenis",
  "French Open": "Tenis",
  "Australian Open": "Tenis",
  "US Open": "Tenis",
  "Grand Slam": "Tenis",
  "MLB": "Béisbol",
  "Baseball": "Béisbol",
  "Béisbol": "Béisbol",
  "NHL": "Hockey",
  "Hockey": "Hockey",
  "Ice Hockey": "Hockey",
};

const normalizeSport = (raw) => {
  if (!raw) return "Fútbol";
  const key = String(raw).trim();
  return SPORT_ALIASES[key] || "Fútbol";
};

const FALLBACK = [
  { id: "fb-futbol-1",  title: "Mbappé y Vinícius guían al Real Madrid en Champions",                      summary: "El dúo ofensivo brilló en la victoria que acerca al equipo a la final.",                                                  url: "https://www.espn.com/soccer/", sport: "Fútbol" },
  { id: "fb-futbol-2",  title: "El Clásico decide la cima de LaLiga",                                      summary: "Real Madrid y Barcelona se enfrentan en una edición que puede definir el campeonato.",                                   url: "https://www.espn.com/soccer/", sport: "Fútbol" },
  { id: "fb-futbol-3",  title: "Premier League: el City recorta distancias",                               summary: "El Manchester City aprovechó el tropiezo del Arsenal para acercarse en la tabla.",                                     url: "https://www.espn.com/soccer/", sport: "Fútbol" },
  { id: "fb-futbol-4",  title: "Serie A: la Juve frena al Inter en el Derby d'Italia",                     summary: "Un partido intenso que terminó en empate y dejó la lucha por el Scudetto más abierta.",                                 url: "https://www.espn.com/soccer/", sport: "Fútbol" },
  { id: "fb-balon-1",   title: "NBA: triple-doble histórico en los playoffs",                              summary: "Una actuación memorable puso a su equipo en semifinales de conferencia.",                                              url: "https://www.espn.com/nba/",    sport: "Baloncesto" },
  { id: "fb-balon-2",   title: "Los Celtics barren en casa y toman ventaja en la final del Este",          summary: "Boston dominó con una defensa asfixiante que dejó sin opciones a su rival.",                                         url: "https://www.espn.com/nba/",    sport: "Baloncesto" },
  { id: "fb-balon-3",   title: "Euroliga: el Real Madrid busca la duodécima",                              summary: "El equipo blanco parte como favorito en la Final Four tras una temporada dominante.",                                url: "https://www.espn.com/basketball/", sport: "Baloncesto" },
  { id: "fb-tenis-1",   title: "Wimbledon: Alcaraz avanza a semifinales",                                  summary: "El español superó en sets corridos a un rival complicado y se medirá al número uno.",                                  url: "https://www.espn.com/tennis/", sport: "Tenis" },
  { id: "fb-tenis-2",   title: "Swiatek arrolla en París y busca su tercer título",                        summary: "La polaca no ha cedido un solo set en lo que va de torneo.",                                                           url: "https://www.espn.com/tennis/", sport: "Tenis" },
  { id: "fb-beisbol-1", title: "MLB: no-hitter histórico en la Liga Americana",                            summary: "El lanzador dominó durante nueve entradas sin permitir hits.",                                                          url: "https://www.espn.com/mlb/",    sport: "Béisbol" },
  { id: "fb-hockey-1",  title: "NHL: los Panthers toman ventaja en la final de la Stanley Cup",            summary: "Florida se impuso en un partido cerrado y queda a dos victorias del título.",                                          url: "https://www.espn.com/nhl/",    sport: "Hockey" },
];

const readCache = () => {
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); if (c && Date.now() - c.savedAt < CACHE_TTL) return c.payload; } catch {}
  return null;
};
const writeCache = (p) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload: p })); } catch {} };

const pickImage = (a) => {
  if (!a) return null;
  if (typeof a === "string") return a;
  if (typeof a.url === "string") return a.url;
  if (typeof a.href === "string") return a.href;
  if (typeof a.src === "string") return a.src;
  return null;
};

const extractSport = (a) => {
  if (a.league?.name) return normalizeSport(a.league.name);
  if (a.sport?.name) return normalizeSport(a.sport.name);
  if (a.sport) return normalizeSport(typeof a.sport === "string" ? a.sport : a.sport.name || a.sport.description);
  if (Array.isArray(a.categories) && a.categories.length) {
    const leagueCat = a.categories.find((c) => c.type === "league" && c.description);
    if (leagueCat?.description) return normalizeSport(leagueCat.description);
    const firstWithDesc = a.categories.find((c) => c.description);
    if (firstWithDesc) return normalizeSport(firstWithDesc.description);
  }
  if (a.type === "Tennis") return "Grand Slam";
  if (a.type === "Basketball") return "NBA";
  return "Fútbol";
};

const parseArticle = (a, defaultSport) => {
  const title = a.headline || a.title || a.name;
  if (!title) return null;
  const published = a.published || a.publishedAt || a.lastModified || a.date;
  return {
    id: String(a.id || `${defaultSport || ""}-${title.replace(/[^a-z0-9]/gi, "").slice(0, 30)}`),
    title: String(title).trim(),
    summary: (a.description || a.summary || "").trim() || null,
    url: a.links?.web?.href || a.link || "#",
    image: Array.isArray(a.images) && a.images.length
      ? (a.images.find((img) => img.width >= 600 && img.url) || a.images[0])?.url || null
      : null,
    source: "ESPN",
    sport: extractSport(a) || normalizeSport(defaultSport) || "Fútbol",
    publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
  };
};

function isFresh(article) {
  const t = new Date(article.publishedAt).getTime();
  return Number.isFinite(t) && (Date.now() - t) <= MAX_AGE_MS;
}

function selectAndSort(articles) {
  const now = Date.now();
  const fresh = articles.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return Number.isFinite(t) && (now - t) <= MAX_AGE_MS;
  });

  const bySport = {};
  for (const a of fresh) {
    if (!bySport[a.sport]) bySport[a.sport] = [];
    bySport[a.sport].push(a);
  }

  const picked = [];
  const seenIds = new Set();
  for (const { key, max } of SPORT_QUOTAS) {
    const pool = bySport[key] || [];
    let count = 0;
    for (const a of pool) {
      if (seenIds.has(a.id)) continue;
      if (count >= max) break;
      picked.push(a);
      seenIds.add(a.id);
      count++;
    }
  }

  return picked;
}

function ensureFallback(articles) {
  if (articles.length >= 4) {
    return articles.map((a) => ({ ...a, image: a.image || sportImageFor(a.sport) }));
  }
  const now = new Date().toISOString();
  return FALLBACK.map((fb) => ({
    ...fb,
    image: sportImageFor(fb.sport),
    publishedAt: now,
    isFallback: true,
  }));
}

async function fetchGeneralNews() {
  const endpoints = [
    "/espn/apis/site/v2/sports/news/headlines",
    "/espn/apis/site/v2/sports/news",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.articles || data.headlines || data.data || data.feed || [];
      if (!items.length) continue;
      return items.map((a) => parseArticle(a)).filter(Boolean);
    } catch {}
  }
  return [];
}

async function fetchLeagueNews(sport, league, name) {
  try {
    const res = await fetch(`/espn/apis/site/v2/sports/${sport}/${league}/news`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.articles || data.data || [];
    return items.map((a) => parseArticle(a, name)).filter(Boolean);
  } catch { return []; }
}

export async function fetchSportsNews({ force = false } = {}) {
  if (!force) { const c = readCache(); if (c) return { articles: c, cached: true, source: "ESPN" }; }

  const leagues = [
    { sport: "soccer", league: "uefa.champions", name: "Champions League" },
    { sport: "soccer", league: "esp.1", name: "LaLiga" },
    { sport: "soccer", league: "eng.1", name: "Premier League" },
    { sport: "soccer", league: "ita.1", name: "Serie A" },
    { sport: "soccer", league: "ger.1", name: "Bundesliga" },
    { sport: "soccer", league: "fifa.world", name: "Mundial" },
    { sport: "basketball", league: "nba", name: "NBA" },
    { sport: "tennis", league: "atp", name: "ATP" },
    { sport: "baseball", league: "mlb", name: "MLB" },
    { sport: "hockey", league: "nhl", name: "NHL" },
  ];
  const r = await Promise.allSettled(leagues.map((l) => fetchLeagueNews(l.sport, l.league, l.name)));
  const articles = [];
  r.forEach((rr) => { if (rr.status === "fulfilled") articles.push(...rr.value); });

  if (articles.length < 6) {
    const general = await fetchGeneralNews();
    articles.push(...general);
  }

  const final = ensureFallback(articles);
  const sorted = selectAndSort(final);
  const usedFallback = articles.length < 6;
  writeCache(sorted);
  return { articles: sorted, cached: false, source: "ESPN", usedFallback };
}
