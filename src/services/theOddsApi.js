const SPORT_NAMES = {
  football: "Fútbol",
  basketball: "Baloncesto",
  tennis: "Tenis",
  baseball: "Béisbol",
  "ice-hockey": "Hockey",
};

const SPORT_KEY_MAP = {
  "ice-hockey": "hockey",
};

const BOOKMAKERS = ["Bet365", "DraftKings"];

const extractOdds = (event) => {
  for (const bookmaker of BOOKMAKERS) {
    const market = event.bookmakers?.[bookmaker]?.find((item) => item.name === "ML");
    const odds = market?.odds?.[0];
    if (!odds?.home || !odds?.away) continue;
    return [{
      1: Number(odds.home),
      ...(odds.draw ? { X: Number(odds.draw) } : {}),
      2: Number(odds.away),
    }, market.updatedAt || null, bookmaker];
  }
  return null;
};

const normalizeEvent = (event, sport) => {
  const [odds, oddsUpdatedAt, bookmaker] = extractOdds(event) || [null, null, null];
  const scores = event.scores || {};
  const fullTime = scores.periods?.ft || {};
  const homeScore = fullTime.home ?? scores.home;
  const awayScore = fullTime.away ?? scores.away;
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const finished = event.status === "settled";

  return {
    id: `odds-${event.id}`,
    oddsEventId: String(event.id),
    externalId: event.id,
    sportKey: SPORT_KEY_MAP[sport] || sport,
    sportName: SPORT_NAMES[sport],
    league: event.league?.name || SPORT_NAMES[sport],
    home: event.home,
    away: event.away,
    homeBadge: null,
    awayBadge: null,
    date: event.date,
    status: finished ? "finished" : event.status === "live" ? "live" : "upcoming",
    score: hasScore ? `${homeScore}-${awayScore}` : null,
    result: finished && hasScore ? homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X" : null,
    odds,
    oddsUpdatedAt,
    bettingOpen: event.status === "pending"
      && new Date(event.date).getTime() - Date.now() > 2 * 60 * 1000
      && Date.now() - new Date(oddsUpdatedAt).getTime() <= 60 * 60 * 1000,
    oddsSource: odds ? bookmaker : null,
    dataSource: "Odds API",
  };
};

const pending = new Map();

export function fetchTheOddsData(sport = "football") {
  if (pending.has(sport)) return pending.get(sport);

  const request = fetch(`/api/odds?sport=${encodeURIComponent(sport)}`)
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Odds API respondió con ${response.status}`);
      const matches = (payload.events || [])
        .map((event) => normalizeEvent(event, sport))
        .filter((match) => match.odds);
      return {
        matches,
        source: "Odds API",
        fetchedAt: new Date().toISOString(),
        oddsAvailable: matches.length > 0,
        errors: payload.error ? [payload.error] : [],
      };
    })
    .finally(() => pending.delete(sport));

  pending.set(sport, request);
  return request;
}
