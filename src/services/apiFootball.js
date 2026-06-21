const BASE_URL = "/api-football";
const CACHE_KEY = "playfulbet:api-football:v1";
const CACHE_TTL = 10 * 60 * 1000;

export const ACTIVE_COMPETITION = {
  id: 140,
  name: "LaLiga",
  season: 2025,
};

const request = async (endpoint, params) => {
  const query = new URLSearchParams(params);
  const response = await fetch(`${BASE_URL}/${endpoint}?${query}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) throw new Error(`API-Football respondió con ${response.status}`);
  if (!payload) throw new Error("API-Football no devolvió una respuesta válida");

  const apiErrors = payload.errors && Object.values(payload.errors).filter(Boolean);
  if (apiErrors?.length) throw new Error(apiErrors.join(" · "));

  return payload.response || [];
};

const normalizeFixture = (item, oddsByFixture) => {
  const status = item.fixture.status.short;
  const finished = ["FT", "AET", "PEN"].includes(status);
  const live = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status);
  const homeGoals = item.goals.home;
  const awayGoals = item.goals.away;
  const result = finished
    ? homeGoals > awayGoals ? "1" : homeGoals < awayGoals ? "2" : "X"
    : null;

  return {
    id: `api-${item.fixture.id}`,
    externalId: item.fixture.id,
    sportId: 1,
    sportKey: "football",
    sportName: "Fútbol",
    league: item.league.name,
    leagueLogo: item.league.logo,
    round: item.league.round,
    home: item.teams.home.name,
    away: item.teams.away.name,
    homeBadge: item.teams.home.logo,
    awayBadge: item.teams.away.logo,
    date: item.fixture.date,
    venue: item.fixture.venue?.name || null,
    status: finished ? "finished" : live ? "live" : "upcoming",
    statusLabel: item.fixture.status.long,
    elapsed: item.fixture.status.elapsed,
    score: homeGoals !== null && awayGoals !== null ? `${homeGoals}-${awayGoals}` : null,
    result,
    odds: oddsByFixture[item.fixture.id] || null,
    oddsSource: oddsByFixture[item.fixture.id] ? "API-Football" : null,
    dataSource: "API-Football",
  };
};

const normalizeOdds = (oddsResponse) => {
  const result = {};

  oddsResponse.forEach((entry) => {
    const bookmaker = entry.bookmakers?.[0];
    const market = bookmaker?.bets?.find((bet) => bet.name === "Match Winner");
    if (!market) return;

    const values = Object.fromEntries(market.values.map((value) => [value.value, Number(value.odd)]));
    if (values.Home && values.Draw && values.Away) {
      result[entry.fixture.id] = { 1: values.Home, X: values.Draw, 2: values.Away };
    }
  });

  return result;
};

const normalizeStandings = (standingsResponse) => {
  const rows = standingsResponse[0]?.league?.standings?.[0] || [];
  return rows.map((row) => ({
    id: row.team.id,
    rank: row.rank,
    name: row.team.name,
    logo: row.team.logo,
    points: row.points,
    played: row.all.played,
    won: row.all.win,
    draw: row.all.draw,
    lost: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    difference: row.goalsDiff,
    form: row.form || "",
    description: row.description,
  }));
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

export async function fetchApiFootballData() {
  const cached = readCache();
  if (cached) return { ...cached, cached: true };

  const baseParams = {
    league: ACTIVE_COMPETITION.id,
    season: ACTIVE_COMPETITION.season,
  };

  const [upcoming, finished, standings, rawOdds] = await Promise.all([
    request("fixtures", { ...baseParams, next: 20 }),
    request("fixtures", { ...baseParams, last: 20 }),
    request("standings", baseParams),
    request("odds", { ...baseParams, page: 1 }).catch(() => []),
  ]);

  const oddsByFixture = normalizeOdds(rawOdds);
  const matches = [...upcoming, ...finished].map((fixture) => normalizeFixture(fixture, oddsByFixture));
  const payload = {
    matches,
    standings: normalizeStandings(standings),
    source: "API-Football",
    competition: ACTIVE_COMPETITION,
    fetchedAt: new Date().toISOString(),
    oddsAvailable: Object.keys(oddsByFixture).length > 0,
  };

  writeCache(payload);
  return payload;
}
