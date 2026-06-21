const BASE_URL = "/football-data";

export const FOOTBALL_COMPETITIONS = [
  { code: "WC", name: "Mundial 2026", type: "cup" },
  { code: "CL", name: "Champions League", type: "cup" },
  { code: "PD", name: "LaLiga", type: "league" },
  { code: "PL", name: "Premier League", type: "league" },
  { code: "BL1", name: "Bundesliga", type: "league" },
  { code: "SA", name: "Serie A", type: "league" },
  { code: "FL1", name: "Ligue 1", type: "league" },
  { code: "PPL", name: "Primeira Liga", type: "league" },
  { code: "DED", name: "Eredivisie", type: "league" },
  { code: "BSA", name: "Brasileirão", type: "league" },
  { code: "CLI", name: "Copa Libertadores", type: "cup" },
];

const request = async (endpoint) => {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Football-Data respondió con ${response.status}`);
  return payload;
};

const normalizeStatus = (status) => {
  if (status === "FINISHED") return "finished";
  if (["IN_PLAY", "PAUSED", "LIVE"].includes(status)) return "live";
  return "upcoming";
};

const localCrest = (team) => {
  if (!team?.id || !team?.crest) return null;
  const extension = new URL(team.crest).pathname.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
  return `/team-crests/${team.id}${extension}`;
};

const normalizeMatch = (match) => {
  const status = normalizeStatus(match.status);
  const homeGoals = match.score?.fullTime?.home;
  const awayGoals = match.score?.fullTime?.away;
  const result = status === "finished" ? homeGoals > awayGoals ? "1" : homeGoals < awayGoals ? "2" : "X" : null;

  return {
    id: `football-data-${match.id}`,
    externalId: match.id,
    sportId: 1,
    sportKey: "football",
    sportName: "Fútbol",
    competitionCode: match.competition?.code,
    league: match.competition?.name || "Fútbol",
    leagueLogo: match.competition?.emblem || null,
    round: match.matchday ? `Jornada ${match.matchday}` : match.stage,
    home: match.homeTeam.name,
    away: match.awayTeam.name,
    homeBadge: localCrest(match.homeTeam),
    awayBadge: localCrest(match.awayTeam),
    date: match.utcDate,
    status,
    statusLabel: match.status,
    score: homeGoals !== null && awayGoals !== null ? `${homeGoals}-${awayGoals}` : null,
    result,
    odds: null,
    oddsSource: null,
    dataSource: "Football-Data",
  };
};

const normalizeStandings = (payload) => {
  const table = payload.standings?.find((standing) => standing.type === "TOTAL")?.table || [];
  return table.map((row) => ({
    id: row.team.id,
    rank: row.position,
    name: row.team.name,
    logo: row.team.crest,
    points: row.points,
    played: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    difference: row.goalDifference,
    form: row.form || "",
  }));
};

const formatDate = (date) => date.toISOString().slice(0, 10);
let footballDataRequest = null;
let footballUpdatesRequest = null;

async function loadFootballUpdates() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const payload = await request(
    `/matches?dateFrom=${formatDate(yesterday)}&dateTo=${formatDate(today)}`,
  );

  return (payload.matches || []).map(normalizeMatch);
}

export async function fetchFootballUpdates() {
  if (footballUpdatesRequest) return footballUpdatesRequest;

  footballUpdatesRequest = loadFootballUpdates().finally(() => {
    footballUpdatesRequest = null;
  });
  return footballUpdatesRequest;
}

async function loadFootballData() {
  const worldCupMatches = await request("/competitions/WC/matches");

  const matchesById = new Map();
  (worldCupMatches.matches || [])
    .map(normalizeMatch)
    .forEach((match) => matchesById.set(match.id, match));

  if (!matchesById.size) {
    throw new Error("Football-Data no devolvió partidos del Mundial");
  }

  return {
    matches: [...matchesById.values()],
    standings: [],
    source: "Football-Data",
    competitions: FOOTBALL_COMPETITIONS,
    fetchedAt: new Date().toISOString(),
    oddsAvailable: false,
  };
}

export async function fetchFootballData() {
  if (footballDataRequest) return footballDataRequest;

  footballDataRequest = loadFootballData().finally(() => {
    footballDataRequest = null;
  });
  return footballDataRequest;
}
