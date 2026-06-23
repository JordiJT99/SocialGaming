const BASE = "/espn/apis/site/v2/sports";

const SPORT_NAMES = {
  football: "Fútbol",
  basketball: "Baloncesto",
  tennis: "Tenis",
  baseball: "Béisbol",
  hockey: "Hockey",
  american_football: "Fútbol Americano",
};

export const ESPN_LEAGUES = [
  { sport: "soccer", league: "fifa.world", name: "Mundial 2026", sportKey: "football" },
  { sport: "soccer", league: "esp.1", name: "LaLiga", sportKey: "football" },
  { sport: "soccer", league: "eng.1", name: "Premier League", sportKey: "football" },
  { sport: "soccer", league: "ger.1", name: "Bundesliga", sportKey: "football" },
  { sport: "soccer", league: "ita.1", name: "Serie A", sportKey: "football" },
  { sport: "soccer", league: "fra.1", name: "Ligue 1", sportKey: "football" },
  { sport: "soccer", league: "uefa.champions", name: "Champions League", sportKey: "football" },
  { sport: "basketball", league: "nba", name: "NBA", sportKey: "basketball" },
  { sport: "basketball", league: "wnba", name: "WNBA", sportKey: "basketball" },
  { sport: "tennis", league: "atp", name: "ATP", sportKey: "tennis" },
  { sport: "tennis", league: "wta", name: "WTA", sportKey: "tennis" },
  { sport: "baseball", league: "mlb", name: "MLB", sportKey: "baseball" },
  { sport: "hockey", league: "nhl", name: "NHL", sportKey: "hockey" },
];

const formatDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

const TYPICAL_DURATION_MIN = {
  football: 115,
  basketball: 150,
  tennis: 120,
  baseball: 190,
  hockey: 150,
};

const estimateEndsAt = (date, status, sportKey) => {
  if (status !== "finished") return null;
  const minutes = TYPICAL_DURATION_MIN[sportKey] || 120;
  return new Date(new Date(date).getTime() + minutes * 60 * 1000).toISOString();
};

const buildDateRange = () => {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  from.setDate(from.getDate() - 3);
  to.setDate(to.getDate() + 7);
  return `${formatDate(from)}-${formatDate(to)}`;
};

const parseStatus = (status) => {
  const state = status?.type?.state;
  if (state === "post") return "finished";
  if (state === "in") return "live";
  return "upcoming";
};

const parseScore = (competitors, status) => {
  if (parseStatus(status) === "upcoming") return null;
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.score || !away?.score) return null;
  return `${home.score}-${away.score}`;
};

const parseResult = (competitors, status) => {
  if (parseStatus(status) !== "finished") return null;
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const h = Number(home?.score);
  const a = Number(away?.score);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  return h > a ? "1" : h < a ? "2" : "X";
};

const normalizeTeamEvent = (event, leagueConfig) => {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const status = parseStatus(comp.status);
  const detail = comp.status?.type?.detail || comp.status?.type?.description || "";

  return {
    id: `espn-${event.id}`,
    externalId: Number(event.id),
    sportKey: leagueConfig.sportKey,
    sportName: SPORT_NAMES[leagueConfig.sportKey] || leagueConfig.sportKey,
    league: leagueConfig.name,
    leagueLogo: null,
    home: home.team?.displayName || home.team?.name || "?",
    away: away.team?.displayName || away.team?.name || "?",
    homeBadge: home.team?.logo || null,
    awayBadge: away.team?.logo || null,
    date: event.date,
    endsAt: estimateEndsAt(event.date, status, leagueConfig.sportKey),
    venue: comp.venue?.fullName || null,
    status,
    statusLabel: detail,
    elapsed: comp.status?.displayClock || null,
    score: parseScore(competitors, comp.status),
    result: parseResult(competitors, comp.status),
    odds: null,
    oddsSource: null,
    dataSource: "ESPN",
  };
};

const normalizeTennisEvent = (event, leagueConfig) => {
  const matches = [];
  const groupings = event.groupings || [];

  for (const group of groupings) {
    for (const comp of group.competitions || []) {
      const competitors = comp.competitors || [];
      if (competitors.length < 2) continue;

      const p1 = competitors[0];
      const p2 = competitors[1];
      const status = parseStatus(comp.status);
      const detail = comp.status?.type?.detail || comp.status?.type?.description || "";

      const playerName = (player) =>
        player.athlete?.displayName
        || (player.athletes?.length ? player.athletes.map((a) => a.shortName || a.displayName).join(" / ") : null)
        || null;

      const p1Name = playerName(p1);
      const p2Name = playerName(p2);
      if (!p1Name || !p2Name) continue;

      const sets = (p1.linescores || []).map((set, index) => {
        const opponentSet = p2.linescores?.[index];
        if (!opponentSet) return null;
        return `${set.value}-${opponentSet.value}`;
      }).filter(Boolean);

      matches.push({
        id: `espn-tennis-${comp.id}`,
        externalId: Number(comp.id),
        sportKey: "tennis",
        sportName: "Tenis",
        league: `${leagueConfig.name} - ${event.name || ""}`.trim(),
        leagueLogo: null,
        home: p1Name,
        away: p2Name,
        homeBadge: p1.athlete?.flag?.href || null,
        awayBadge: p2.athlete?.flag?.href || null,
        date: comp.date || event.date,
        endsAt: estimateEndsAt(comp.date || event.date, status, "tennis"),
        venue: comp.venue?.fullName || null,
        status,
        statusLabel: detail,
        elapsed: null,
        score: sets.length ? sets.join(", ") : null,
        result: status === "finished" ? (p1.winner ? "1" : "2") : null,
        odds: null,
        oddsSource: null,
        dataSource: "ESPN",
      });
    }
  }
  return matches;
};

async function fetchScoreboard(sport, league, dates) {
  const url = dates
    ? `${BASE}/${sport}/${league}/scoreboard?dates=${dates}`
    : `${BASE}/${sport}/${league}/scoreboard`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.events || [];
}

const teamRequests = new Map();

function fetchTeams({ sport, league }) {
  if (sport !== "soccer") return [];
  if (!teamRequests.has(league)) {
    teamRequests.set(league, fetch(`${BASE}/${sport}/${league}/teams?limit=100`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(({ team }) => ({
        names: [team.displayName, team.name, team.location, team.shortDisplayName].filter(Boolean),
        badge: team.logos?.find((logo) => logo.rel?.includes("default"))?.href || team.logos?.[0]?.href || null,
      })).filter((team) => team.badge)));
  }
  return teamRequests.get(league);
}

async function fetchLeague(leagueConfig) {
  const { sport, league } = leagueConfig;
  let events = await fetchScoreboard(sport, league, buildDateRange());
  if (!events.length) {
    events = await fetchScoreboard(sport, league, null);
  }

  if (leagueConfig.sportKey === "tennis") {
    return events.flatMap((event) => normalizeTennisEvent(event, leagueConfig));
  }
  return events.map((event) => normalizeTeamEvent(event, leagueConfig)).filter(Boolean);
}

let activeRequest = null;

export async function fetchEspnData(leagues = ESPN_LEAGUES) {
  if (activeRequest) return activeRequest;

  activeRequest = Promise.all([
    Promise.allSettled(leagues.map(fetchLeague)),
    Promise.allSettled(leagues.map(fetchTeams)),
  ])
    .then(([results, teamResults]) => {
      const matches = [];
      const teams = [];
      const errors = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          matches.push(...result.value);
        } else {
          errors.push(`${leagues[i].name}: ${result.reason?.message}`);
        }
      });
      teamResults.forEach((result) => {
        if (result.status === "fulfilled") teams.push(...result.value);
      });

      const deduped = [...new Map(matches.map((match) => [match.id, match])).values()];

      return {
        matches: deduped,
        teams,
        standings: [],
        source: "ESPN",
        fetchedAt: new Date().toISOString(),
        oddsAvailable: false,
        providerErrors: errors,
      };
    })
    .finally(() => { activeRequest = null; });

  return activeRequest;
}
