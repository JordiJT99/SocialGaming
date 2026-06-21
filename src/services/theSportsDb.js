const BASE_URL = "/sports-db/api/v1/json";
const FREE_API_KEY = import.meta.env.VITE_THESPORTSDB_KEY || "123";
const CACHE_KEY = "playfulbet:sportsdb:v2";
const CACHE_TTL = 15 * 60 * 1000;

const LEAGUES = [
  { id: "4335", name: "LaLiga" },
  { id: "4328", name: "Premier League" },
  { id: "4332", name: "Serie A" },
];

const request = async (endpoint) => {
  const response = await fetch(`${BASE_URL}/${FREE_API_KEY}/${endpoint}`);
  if (!response.ok) throw new Error(`TheSportsDB respondió con ${response.status}`);
  return response.json();
};

const normalizeEvent = (event, fallbackLeague) => {
  const homeScore = Number(event.intHomeScore);
  const awayScore = Number(event.intAwayScore);
  const finished = event.strStatus === "FT" || (Number.isFinite(homeScore) && Number.isFinite(awayScore));
  const result = finished ? (homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X") : null;

  return {
    id: `sportsdb-${event.idEvent}`,
    externalId: event.idEvent,
    sportId: 1,
    sportKey: "football",
    sportName: "Fútbol",
    league: event.strLeague || fallbackLeague,
    home: event.strHomeTeam,
    away: event.strAwayTeam,
    homeBadge: event.strHomeTeamBadge || null,
    awayBadge: event.strAwayTeamBadge || null,
    leagueBadge: event.strLeagueBadge || null,
    venue: event.strVenue || null,
    date: event.strTimestamp || `${event.dateEvent}T${event.strTime || "00:00:00"}`,
    odds: null,
    oddsSource: null,
    status: finished ? "finished" : "upcoming",
    result,
    score: finished ? `${homeScore}-${awayScore}` : null,
    dataSource: "TheSportsDB",
  };
};

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.payload;
  } catch {
    // Ignore invalid or unavailable storage.
  }
  return null;
};

const writeCache = (payload) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // The app can continue without browser caching.
  }
};

export async function fetchSportsDbMatches() {
  const cached = readCache();
  if (cached) return { ...cached, cached: true };

  const responses = await Promise.all(
    LEAGUES.flatMap((league) => [
      request(`eventsnextleague.php?id=${league.id}`).then((data) => ({ type: "upcoming", league, events: data.events || [] })),
      request(`eventspastleague.php?id=${league.id}`).then((data) => ({ type: "finished", league, events: data.events || [] })),
    ]),
  );

  const matches = responses.flatMap(({ league, events }) =>
    events.map((event) => normalizeEvent(event, league.name)),
  );

  const payload = {
    matches,
    fetchedAt: new Date().toISOString(),
    source: "TheSportsDB",
    freeTier: true,
  };

  writeCache(payload);
  return payload;
}

export const SPORTS_DB_CONFIG = {
  leagues: LEAGUES,
  freeApiKey: FREE_API_KEY,
  cacheMinutes: CACHE_TTL / 60000,
};
