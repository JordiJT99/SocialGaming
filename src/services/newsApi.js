const CACHE_KEY = "playfulbet:sports-news:v5";
const CACHE_TTL = 5 * 60 * 1000;
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

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

const PRIORITY = {
  "Mundial": 1, "Champions League": 2, "Eurocopa": 3,
  "LaLiga": 4, "Premier League": 5, "Serie A": 6, "Bundesliga": 7, "Ligue 1": 8,
  "NBA": 9, "Euroliga": 10,
  "Grand Slam": 11, "ATP": 12, "WTA": 13,
  "MLB": 14, "NHL": 15,
  "Fútbol": 16, "Baloncesto": 17, "Tenis": 18, "Béisbol": 19, "Hockey": 20,
};

const POPULAR = ["Mundial", "Champions League", "LaLiga", "Premier League", "NBA", "Grand Slam", "ATP", "MLB", "Fútbol", "Baloncesto", "Tenis"];

const FALLBACK = [
  { id: "fb-mundial",   title: "Mundial 2026: grupos definidos tras el sorteo en Miami",                   summary: "Las 32 selecciones ya conocen sus rivales en la fase de grupos del torneo más importante del mundo.",                       url: "https://www.espn.com/soccer/", sport: "Mundial" },
  { id: "fb-cl",        title: "La Champions League define los cuartos de final",                           summary: "Los ocho mejores equipos de Europa se preparan para la eliminatoria más emocionante de la temporada.",                    url: "https://www.espn.com/soccer/", sport: "Champions League" },
  { id: "fb-cl2",       title: "Mbappé y Vinícius guían al Real Madrid en Champions",                      summary: "El dúo ofensivo del Real Madrid brilló en la victoria que acerca al equipo a la final de Wembley.",                       url: "https://www.espn.com/soccer/", sport: "Champions League" },
  { id: "fb-laliga",    title: "El Clásico decide la cima de LaLiga",                                      summary: "Real Madrid y Barcelona se enfrentan en una edición que puede definir el campeonato.",                                   url: "https://www.espn.com/soccer/", sport: "LaLiga" },
  { id: "fb-laliga2",   title: "Atlético de Madrid sigue firme en la pelea por LaLiga",                    summary: "El equipo colchonero suma su quinta victoria consecutiva y se acerca a los líderes.",                                  url: "https://www.espn.com/soccer/", sport: "LaLiga" },
  { id: "fb-premier",   title: "Premier League: el City recorta distancias",                               summary: "El Manchester City aprovechó el tropiezo del Arsenal para acercarse en la tabla.",                                     url: "https://www.espn.com/soccer/", sport: "Premier League" },
  { id: "bk-nba",       title: "NBA: triple-doble histórico en los playoffs",                              summary: "Una actuación memorable de 42 puntos, 15 rebotes y 12 asistencias puso a su equipo en semifinales de conferencia.",      url: "https://www.espn.com/nba/",    sport: "NBA" },
  { id: "bk-nba2",      title: "Los Celtics barren en casa y toman ventaja en la final del Este",          summary: "Boston dominó de principio a fin con una defensa asfixiante que dejó sin opciones a su rival.",                         url: "https://www.espn.com/nba/",    sport: "NBA" },
  { id: "tn-gs",        title: "Roland Garros: Alcaraz avanza a semifinales",                              summary: "El español superó en sets corridos a un rival complicado y se medirá al número uno del ranking.",                       url: "https://www.espn.com/tennis/", sport: "Grand Slam" },
  { id: "tn-gs2",       title: "Swiatek arrolla en París y busca su tercer título",                        summary: "La polaca no ha cedido un solo set en lo que va de torneo y parte como gran favorita.",                                url: "https://www.espn.com/tennis/", sport: "Grand Slam" },
  { id: "bb-mlb",       title: "MLB: no-hitter histórico en la Liga Americana",                            summary: "El lanzador dominó durante nueve entradas sin permitir hits, logrando el primer no-hitter de la temporada.",            url: "https://www.espn.com/mlb/",    sport: "MLB" },
  { id: "bb-mlb2",      title: "Los Yankees refuerzan su rotación antes de la fecha límite",               summary: "Nueva York adquiere a un abridor de primer nivel para fortalecer sus aspiraciones de Serie Mundial.",                    url: "https://www.espn.com/mlb/",    sport: "MLB" },
  { id: "hc-nhl",       title: "NHL: los Panthers toman ventaja en la final de la Stanley Cup",            summary: "Florida se impuso en un partido cerrado y queda a dos victorias del título.",                                          url: "https://www.espn.com/nhl/",    sport: "NHL" },
  { id: "fb-seriea",    title: "Serie A: la Juve frena al Inter en el Derby d'Italia",                     summary: "Un partido intenso que terminó en empate y dejó la lucha por el Scudetto más abierta que nunca.",                       url: "https://www.espn.com/soccer/", sport: "Serie A" },
  { id: "tn-atp",       title: "ATP Masters 1000: Sinner exhibe su mejor tenis en Roma",                   summary: "El italiano deleitó a su público con una actuación impecable que lo deposita en cuartos de final.",                     url: "https://www.espn.com/tennis/", sport: "ATP" },
  { id: "bk-euro",      title: "Euroliga: el Real Madrid busca la duodécima",                              summary: "El equipo blanco parte como favorito en la Final Four tras una temporada dominante en la fase regular.",                 url: "https://www.espn.com/basketball/", sport: "Euroliga" },
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

const extractImages = (article) => {
  if (Array.isArray(article.images) && article.images.length) {
    const found = article.images.find((i) => i.width >= 600 && i.url) || article.images[0];
    const url = pickImage(found);
    if (url) return url;
  }
  if (article.image) return pickImage(article.image);
  if (article.thumbnail) return pickImage(article.thumbnail);
  if (article.url && /\.(jpg|jpeg|png|gif|webp)/i.test(article.url)) return article.url;
  return null;
};

const extractSport = (a) => {
  if (a.league?.name) return a.league.name;
  if (a.sport?.name) return a.sport.name;
  if (a.sport) return typeof a.sport === "string" ? a.sport : a.sport.name || a.sport.description;
  if (Array.isArray(a.categories) && a.categories.length) {
    const cat = a.categories[0];
    if (cat.league?.name) return cat.league.name;
    if (cat.description) return cat.description;
    if (cat.name) return cat.name;
  }
  if (a.type === "Tennis") return "Grand Slam";
  if (a.type === "Basketball") return "NBA";
  return "Fútbol";
};

const safeDate = (d) => {
  if (!d) return new Date().toISOString();
  try {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } catch { return new Date().toISOString(); }
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
    sport: extractSport(a) || defaultSport || "Fútbol",
    publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
  };
};

function ensureVariety(articles) {
  const now = Date.now();
  const result = articles
    .map((a) => ({ ...a, image: a.image || sportImageFor(a.sport) }))
    .filter((a) => {
      const t = new Date(a.publishedAt).getTime();
      return Number.isFinite(t) && (now - t) <= MAX_AGE_MS;
    });

  for (const wanted of POPULAR) {
    const count = result.filter((a) => a.sport === wanted).length;
    if (count < 2) {
      const fill = FALLBACK.filter((fb) => fb.sport === wanted && !result.find((r) => r.id === fb.id)).slice(0, 2 - count);
      result.push(...fill.map((fb) => ({ ...fb, publishedAt: new Date(now).toISOString(), image: sportImageFor(fb.sport) })));
    }
  }

  if (result.length < 12) {
    const extra = FALLBACK.filter((fb) => !result.find((r) => r.id === fb.id));
    result.push(...extra.map((fb) => ({ ...fb, publishedAt: new Date(now).toISOString(), image: sportImageFor(fb.sport) })));
  }

  const seen = new Set();
  const deduped = [];
  for (const item of result) { if (!seen.has(item.id)) { seen.add(item.id); deduped.push(item); } }

  const priority = (s) => PRIORITY[s] || 99;
  deduped.sort((a, b) => {
    const pa = priority(a.sport), pb = priority(b.sport);
    if (pa !== pb) return pa - pb;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  const mixed = [];
  const q = [...deduped];
  let last = null, cons = 0;
  while (q.length) {
    let i = 0;
    while (i < q.length && q[i].sport === last && cons >= 1) i++;
    if (i >= q.length) i = 0;
    const a = q.splice(i, 1)[0];
    cons = a.sport === last ? cons + 1 : 1;
    last = a.sport;
    mixed.push(a);
  }
  return mixed;
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

async function fetchNewsFromScoreboards() {
  const leagues = [
    { sport: "soccer", league: "uefa.champions", name: "Champions League" },
    { sport: "soccer", league: "esp.1", name: "LaLiga" },
    { sport: "soccer", league: "eng.1", name: "Premier League" },
    { sport: "basketball", league: "nba", name: "NBA" },
    { sport: "tennis", league: "atp", name: "ATP" },
    { sport: "baseball", league: "mlb", name: "MLB" },
    { sport: "hockey", league: "nhl", name: "NHL" },
  ];
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 1);
  const to = new Date(now); to.setDate(to.getDate() + 3);
  const dr = `${from.toISOString().slice(0, 10).replace(/-/g, "")}-${to.toISOString().slice(0, 10).replace(/-/g, "")}`;

  const results = await Promise.allSettled(leagues.map(async ({ sport, league, name }) => {
    try {
      const res = await fetch(`/espn/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${dr}`);
      if (!res.ok) return [];
      const data = await res.json();
      const events = data.events || [];
      return events.map((ev) => {
        const comp = ev.competitions?.[0];
        if (!comp) return null;
        const home = comp.competitors?.find((c) => c.homeAway === "home");
        const away = comp.competitors?.find((c) => c.homeAway === "away");
        if (!home || !away) return null;
        return parseArticle({
          headline: `${home.team?.displayName || "?"} vs ${away.team?.displayName || "?"} - ${name}`,
          description: ev.status?.type?.description || "Partido programado",
          date: ev.date,
          links: { web: { href: `https://www.espn.com/${sport}/game/_/gameId/${ev.id}` } },
          images: [
            { url: home.team?.logo, width: 100, height: 100 },
            { url: away.team?.logo, width: 100, height: 100 },
          ],
          id: `news-${ev.id}`,
          league: { name },
        }, name);
      }).filter(Boolean);
    } catch { return []; }
  }));

  const articles = [];
  results.forEach((r) => { if (r.status === "fulfilled") articles.push(...r.value); });
  return articles;
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

  if (articles.length < 6) {
    const scoreboard = await fetchNewsFromScoreboards();
    articles.push(...scoreboard);
  }

  const final = ensureVariety(articles);
  writeCache(final);
  return { articles: final.slice(0, 16), cached: false, source: "ESPN" };
}
