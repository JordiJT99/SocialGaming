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
  { sport: "tennis", league: "atp", name: "ATP", sportKey: "tennis" },
  { sport: "tennis", league: "wta", name: "WTA", sportKey: "tennis" },
  { sport: "baseball", league: "mlb", name: "MLB", sportKey: "baseball" },
  { sport: "hockey", league: "nhl", name: "NHL", sportKey: "hockey" },
];

const formatDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

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

      const linescoreText = (player) =>
        (player.linescores || []).map((s) => s.value).join(" ");
      const p1Score = linescoreText(p1);
      const p2Score = linescoreText(p2);

      matches.push({
        id: `espn-tennis-${comp.id}`,
        externalId: Number(comp.id),
        sportKey: "tennis",
        sportName: "Tenis",
        league: `${leagueConfig.name} - ${event.name || ""}`.trim(),
        leagueLogo: null,
        home: p1.athlete?.displayName || "?",
        away: p2.athlete?.displayName || "?",
        homeBadge: p1.athlete?.flag?.href || null,
        awayBadge: p2.athlete?.flag?.href || null,
        date: comp.date || event.date,
        venue: comp.venue?.fullName || null,
        status,
        statusLabel: detail,
        elapsed: null,
        score: p1Score || p2Score ? `${p1Score} / ${p2Score}` : null,
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

  activeRequest = Promise.allSettled(leagues.map(fetchLeague))
    .then((results) => {
      const matches = [];
      const errors = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          matches.push(...result.value);
        } else {
          errors.push(`${leagues[i].name}: ${result.reason?.message}`);
        }
      });

      return {
        matches,
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
