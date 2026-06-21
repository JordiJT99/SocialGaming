const SPORT_NAMES = {
  football: "Fútbol",
  basketball: "Baloncesto",
  tennis: "Tenis",
};

const extractOdds = (event) => {
  const odds = event.bookmakers?.Bet365?.find((market) => market.name === "ML")?.odds?.[0];
  if (!odds?.home || !odds?.away) return null;
  return {
    1: Number(odds.home),
    ...(odds.draw ? { X: Number(odds.draw) } : {}),
    2: Number(odds.away),
  };
};

const normalizeEvent = (event, sport) => {
  const odds = extractOdds(event);
  const scores = event.scores || {};
  const fullTime = scores.periods?.ft || {};
  const homeScore = fullTime.home ?? scores.home;
  const awayScore = fullTime.away ?? scores.away;
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const finished = event.status === "settled";

  return {
    id: `odds-${event.id}`,
    externalId: event.id,
    sportKey: sport,
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
    oddsSource: odds ? "Odds API" : null,
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
