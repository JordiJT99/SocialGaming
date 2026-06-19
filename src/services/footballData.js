const BASE_URL = "/football-data";
const COMPETITION = "PD";

const request = async (endpoint) => {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || `Football-Data respondió con ${response.status}`;
    throw new Error(message);
  }

  return payload;
};

const normalizeStatus = (status) => {
  if (status === "FINISHED") return "finished";
  if (["IN_PLAY", "PAUSED", "LIVE"].includes(status)) return "live";
  return "upcoming";
};

const normalizeMatch = (match) => {
  const status = normalizeStatus(match.status);
  const homeGoals = match.score?.fullTime?.home;
  const awayGoals = match.score?.fullTime?.away;
  const result = status === "finished"
    ? homeGoals > awayGoals ? "1" : homeGoals < awayGoals ? "2" : "X"
    : null;

  return {
    id: `football-data-${match.id}`,
    externalId: match.id,
    sportId: 1,
    league: match.competition?.name || "LaLiga",
    leagueLogo: match.competition?.emblem || null,
    round: match.matchday ? `Jornada ${match.matchday}` : match.stage,
    home: match.homeTeam.name,
    away: match.awayTeam.name,
    homeBadge: match.homeTeam.crest || null,
    awayBadge: match.awayTeam.crest || null,
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

export async function fetchFootballData() {
  const [matchesPayload, standingsPayload] = await Promise.all([
    request(`/competitions/${COMPETITION}/matches`),
    request(`/competitions/${COMPETITION}/standings`),
  ]);

  return {
    matches: (matchesPayload.matches || []).map(normalizeMatch),
    standings: normalizeStandings(standingsPayload),
    source: "Football-Data",
    competition: {
      id: COMPETITION,
      name: matchesPayload.competition?.name || "LaLiga",
      season: matchesPayload.filters?.season || matchesPayload.resultSet?.first,
    },
    fetchedAt: new Date().toISOString(),
    oddsAvailable: false,
  };
}
