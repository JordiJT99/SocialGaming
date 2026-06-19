const BASE_URL = "/the-odds-api";
const SPORT_KEY = "soccer_spain_la_liga";
const CACHE_KEY = "playfulbet:the-odds-api:v1";
const CACHE_TTL = 60 * 60 * 1000;

const request = async (endpoint, params = {}) => {
  const query = new URLSearchParams(params);
  const response = await fetch(`${BASE_URL}${endpoint}?${query}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || `The Odds API respondió con ${response.status}`);
  }

  return {
    data: payload || [],
    remaining: response.headers.get("x-requests-remaining"),
    used: response.headers.get("x-requests-used"),
  };
};

const average = (values) => values.length
  ? Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2))
  : null;

const extractAverageOdds = (event) => {
  const prices = { home: [], draw: [], away: [] };

  event.bookmakers?.forEach((bookmaker) => {
    const market = bookmaker.markets?.find((item) => item.key === "h2h");
    market?.outcomes?.forEach((outcome) => {
      if (outcome.name === event.home_team) prices.home.push(outcome.price);
      else if (outcome.name === event.away_team) prices.away.push(outcome.price);
      else if (outcome.name === "Draw") prices.draw.push(outcome.price);
    });
  });

  const home = average(prices.home);
  const draw = average(prices.draw);
  const away = average(prices.away);
  return home && draw && away ? { 1: home, X: draw, 2: away } : null;
};

const readScore = (event, team) => {
  const entry = event.scores?.find((score) => score.name === team);
  return entry ? Number(entry.score) : null;
};

const normalizeEvent = (event, oddsEvent) => {
  const homeScore = readScore(event, event.home_team);
  const awayScore = readScore(event, event.away_team);
  const completed = Boolean(event.completed);
  const scoreAvailable = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const result = completed && scoreAvailable
    ? homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X"
    : null;

  return {
    id: `odds-${event.id}`,
    externalId: event.id,
    sportId: 1,
    league: "LaLiga",
    home: event.home_team,
    away: event.away_team,
    homeBadge: null,
    awayBadge: null,
    date: event.commence_time,
    status: completed ? "finished" : scoreAvailable ? "live" : "upcoming",
    score: scoreAvailable ? `${homeScore}-${awayScore}` : null,
    result,
    odds: oddsEvent ? extractAverageOdds(oddsEvent) : null,
    oddsSource: oddsEvent ? "The Odds API" : null,
    dataSource: "The Odds API",
  };
};

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.payload;
  } catch {
    // Continue without cache.
  }
  return null;
};

const writeCache = (payload) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Continue without cache.
  }
};

export async function fetchTheOddsData() {
  const cached = readCache();
  if (cached) return { ...cached, cached: true };

  const [oddsResponse, scoresResponse] = await Promise.all([
    request(`/sports/${SPORT_KEY}/odds`, {
      regions: "eu",
      markets: "h2h",
      oddsFormat: "decimal",
      dateFormat: "iso",
    }),
    request(`/sports/${SPORT_KEY}/scores`, {
      daysFrom: 3,
      dateFormat: "iso",
    }),
  ]);

  const oddsById = Object.fromEntries(oddsResponse.data.map((event) => [event.id, event]));
  const allEvents = new Map();
  oddsResponse.data.forEach((event) => allEvents.set(event.id, event));
  scoresResponse.data.forEach((event) => allEvents.set(event.id, { ...allEvents.get(event.id), ...event }));

  const payload = {
    matches: [...allEvents.values()].map((event) => normalizeEvent(event, oddsById[event.id])),
    source: "The Odds API",
    fetchedAt: new Date().toISOString(),
    oddsAvailable: oddsResponse.data.length > 0,
    quota: {
      remaining: oddsResponse.remaining || scoresResponse.remaining,
      used: oddsResponse.used || scoresResponse.used,
    },
  };

  writeCache(payload);
  return payload;
}
