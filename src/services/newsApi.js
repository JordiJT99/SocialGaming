const CACHE_KEY = "playfulbet:sports-news:v8";
const CACHE_TTL = 3 * 60 * 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TARGET_COUNT = 12;
const MAX_PER_SPORT = 3;

const SPORT_IMAGE = {
  "Mundial": "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
  "Champions League": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "Eurocopa": "https://a.espncdn.com/i/leaguelogos/soccer/500/74.png",
  "LaLiga": "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png",
  "Premier League": "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png",
  "Serie A": "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png",
  "Bundesliga": "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png",
  "Ligue 1": "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png",
  "Fútbol": "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png",
  "NBA": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "Baloncesto": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "Euroliga": "https://a.espncdn.com/i/teamlogos/leagues/500/nba.png",
  "Grand Slam": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-tennis.png",
  "ATP": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-tennis.png",
  "WTA": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-tennis.png",
  "Tenis": "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-tennis.png",
  "MLB": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  "Béisbol": "https://a.espncdn.com/i/teamlogos/leagues/500/mlb.png",
  "NHL": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
  "Hockey": "https://a.espncdn.com/i/teamlogos/leagues/500/nhl.png",
};

const sportImageFor = (sport) => SPORT_IMAGE[sport] || null;

const SPORT_ALIASES = {
  "UEFA Champions League": "Champions League",
  "Champions League": "Champions League",
  "UEFA Europa League": "Europa League",
  "UEFA Europa Conference League": "Conference League",
  "FIFA World Cup": "Mundial",
  "World Cup": "Mundial",
  "Mundial": "Mundial",
  "UEFA European Championship": "Eurocopa",
  "European Championship": "Eurocopa",
  "Eurocopa": "Eurocopa",
  "Spanish LALIGA": "LaLiga",
  "Spanish LaLiga": "LaLiga",
  "LaLiga": "LaLiga",
  "English Premier League": "Premier League",
  "Premier League": "Premier League",
  "Italian Serie A": "Serie A",
  "Serie A": "Serie A",
  "German Bundesliga": "Bundesliga",
  "Bundesliga": "Bundesliga",
  "French Ligue 1": "Ligue 1",
  "Ligue 1": "Ligue 1",
  "Soccer": "Fútbol",
  "Fútbol": "Fútbol",
  "Football": "Fútbol",
  "Association football": "Fútbol",
  "NBA": "NBA",
  "Basketball": "Baloncesto",
  "Baloncesto": "Baloncesto",
  "Euroleague": "Euroliga",
  "EuroLeague": "Euroliga",
  "Euroliga": "Euroliga",
  "ATP": "ATP",
  "WTA": "WTA",
  "Tennis": "Tenis",
  "Tenis": "Tenis",
  "Wimbledon": "Grand Slam",
  "Roland Garros": "Grand Slam",
  "French Open": "Grand Slam",
  "Australian Open": "Grand Slam",
  "US Open": "Grand Slam",
  "Grand Slam": "Grand Slam",
  "MLB": "MLB",
  "Baseball": "Béisbol",
  "Béisbol": "Béisbol",
  "NHL": "NHL",
  "Hockey": "Hockey",
  "Ice Hockey": "Hockey",
};

const normalizeSport = (raw) => {
  if (!raw) return "Fútbol";
  const key = String(raw).trim();
  return SPORT_ALIASES[key] || key;
};

const POPULARITY = {
  "Champions League": 2,
  "Mundial": 1,
  "Eurocopa": 3,
  "LaLiga": 4,
  "Premier League": 5,
  "Serie A": 6,
  "Bundesliga": 7,
  "Ligue 1": 8,
  "NBA": 9,
  "Grand Slam": 10,
  "ATP": 11,
  "WTA": 12,
  "Euroliga": 13,
  "MLB": 14,
  "NHL": 15,
  "Fútbol": 20,
  "Baloncesto": 21,
  "Tenis": 22,
  "Béisbol": 23,
  "Hockey": 24,
};

const popularityOf = (sport) => POPULARITY[sport] || 99;

const FALLBACK = [
  { id: "fb-cl",        title: "La Champions League define los cuartos de final",                           summary: "Los ocho mejores equipos de Europa se preparan para la eliminatoria más emocionante de la temporada.",                    url: "https://www.espn.com/soccer/", sport: "Champions League" },
  { id: "fb-mundial",   title: "Mundial 2026: grupos definidos tras el sorteo en Miami",                   summary: "Las 32 selecciones ya conocen sus rivales en la fase de grupos del torneo más importante del mundo.",                       url: "https://www.espn.com/soccer/", sport: "Mundial" },
  { id: "fb-laliga",    title: "El Clásico decide la cima de LaLiga",                                      summary: "Real Madrid y Barcelona se enfrentan en una edición que puede definir el campeonato.",                                   url: "https://www.espn.com/soccer/", sport: "LaLiga" },
  { id: "fb-premier",   title: "Premier League: el City recorta distancias",                               summary: "El Manchester City aprovechó el tropiezo del Arsenal para acercarse en la tabla.",                                     url: "https://www.espn.com/soccer/", sport: "Premier League" },
  { id: "fb-seriea",    title: "Serie A: la Juve frena al Inter en el Derby d'Italia",                     summary: "Un partido intenso que terminó en empate y dejó la lucha por el Scudetto más abierta que nunca.",                       url: "https://www.espn.com/soccer/", sport: "Serie A" },
  { id: "bk-nba",       title: "NBA: triple-doble histórico en los playoffs",                              summary: "Una actuación memorable de 42 puntos, 15 rebotes y 12 asistencias puso a su equipo en semifinales de conferencia.",      url: "https://www.espn.com/nba/",    sport: "NBA" },
  { id: "tn-gs",        title: "Roland Garros: Alcaraz avanza a semifinales",                              summary: "El español superó en sets corridos a un rival complicado y se medirá al número uno del ranking.",                       url: "https://www.espn.com/tennis/", sport: "Grand Slam" },
  { id: "tn-atp",       title: "ATP Masters 1000: Sinner exhibe su mejor tenis en Roma",                   summary: "El italiano deleitó a su público con una actuación impecable que lo deposita en cuartos de final.",                     url: "https://www.espn.com/tennis/", sport: "ATP" },
  { id: "bb-mlb",       title: "MLB: no-hitter histórico en la Liga Americana",                            summary: "El lanzador dominó durante nueve entradas sin permitir hits, logrando el primer no-hitter de la temporada.",            url: "https://www.espn.com/mlb/",    sport: "MLB" },
  { id: "hc-nhl",       title: "NHL: los Panthers toman ventaja en la final de la Stanley Cup",            summary: "Florida se impuso en un partido cerrado y queda a dos victorias del título.",                                          url: "https://www.espn.com/nhl/",    sport: "NHL" },
  { id: "bk-euro",      title: "Euroliga: el Real Madrid busca la duodécima",                              summary: "El equipo blanco parte como favorito en la Final Four tras una temporada dominante en la fase regular.",                 url: "https://www.espn.com/basketball/", sport: "Euroliga" },
  { id: "fb-bundesliga",title: "Bundesliga: el Bayer Leverkusen sigue líder invicto",                      summary: "El equipo de Xabi Alonso mantiene su paso firme en la Bundesliga y se acerca al título.",                              url: "https://www.espn.com/soccer/", sport: "Bundesliga" },
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
  const fresh = articles.filter(isFresh);
  fresh.sort((a, b) => {
    const pa = popularityOf(a.sport);
    const pb = popularityOf(b.sport);
    if (pa !== pb) return pa - pb;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  const picked = [];
  const sportCount = {};
  const seenIds = new Set();
  for (const a of fresh) {
    if (seenIds.has(a.id)) continue;
    const count = sportCount[a.sport] || 0;
    if (count >= MAX_PER_SPORT) continue;
    picked.push(a);
    seenIds.add(a.id);
    sportCount[a.sport] = count + 1;
    if (picked.length >= TARGET_COUNT) break;
  }
  return picked;
}

function ensureFallback(articles) {
  if (articles.length >= 6) {
    return articles.map((a) => ({ ...a, image: a.image || sportImageFor(a.sport) }));
  }
  const now = new Date().toISOString();
  const fakeFresh = FALLBACK.slice(0, TARGET_COUNT).map((fb) => ({
    ...fb,
    image: sportImageFor(fb.sport),
    publishedAt: now,
    isFallback: true,
  }));
  return fakeFresh;
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
