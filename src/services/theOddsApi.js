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

const BOOKMAKERS = ["Bet365", "DraftKings", "FanDuel", "BetMGM", "PointsBet", "BetRivers", "Caesars"];

const extractOdds = (event) => {
  const markets = ["ML", "h2h", "moneyline", "Match Winner", "Winner"];
  for (const bookmaker of BOOKMAKERS) {
    const book = event.bookmakers?.[bookmaker];
    if (!book) continue;
    for (const marketName of markets) {
      const market = book.find((item) => item.name === marketName || item.key === marketName);
      if (!market) continue;
      const odds = market.odds?.[0];
      if (!odds?.home || !odds?.away) continue;
      return [{
        1: Number(odds.home),
        ...(odds.draw ? { X: Number(odds.draw) } : {}),
        2: Number(odds.away),
      }, market.updatedAt || null, bookmaker];
    }
  }
  if (event.bookmakers) {
    for (const [bookName, bookMarkets] of Object.entries(event.bookmakers)) {
      if (!bookMarkets) continue;
      for (const market of bookMarkets) {
        const odds = market?.odds?.[0];
        if (!odds?.home || !odds?.away) continue;
        return [{
          1: Number(odds.home),
          ...(odds.draw ? { X: Number(odds.draw) } : {}),
          2: Number(odds.away),
        }, market.updatedAt || null, bookName];
      }
    }
  }
  return null;
};

const TYPICAL_DURATION_MIN = {
  football: 100,
  basketball: 48,
  tennis: 120,
  baseball: 180,
  hockey: 60,
};

const estimateElapsed = (event, sport) => {
  if (event.status !== "live") return null;
  if (event.elapsed && typeof event.elapsed === "string" && event.elapsed !== "0:00" && event.elapsed !== "00:00" && !event.elapsed.endsWith(":00")) {
    return event.elapsed;
  }
  if (event.clock && event.clock !== "0:00" && event.clock !== "00:00" && !event.clock.endsWith(":00")) {
    return event.clock;
  }

  const startTime = new Date(event.date).getTime();
  const elapsedMs = Date.now() - startTime;
  if (elapsedMs <= 0) return null;

  const elapsedMin = Math.floor(elapsedMs / 60000);
  const maxDuration = TYPICAL_DURATION_MIN[sport] || 90;

  if (sport === "basketball") {
    const quarter = Math.min(4, Math.floor(elapsedMin / 12) + 1);
    const minInQuarter = elapsedMin % 12;
    const secInQuarter = Math.floor((elapsedMs % 60000) / 1000);
    return `Q${quarter} ${String(minInQuarter).padStart(2, "0")}:${String(secInQuarter).padStart(2, "0")}`;
  }
  if (sport === "football" || sport === "soccer") {
    const minute = Math.min(90 + 5, Math.floor(elapsedMin));
    return `${minute}'`;
  }
  if (sport === "hockey" || sport === "ice-hockey") {
    const period = Math.min(3, Math.floor(elapsedMin / 20) + 1);
    return `P${period}`;
  }
  if (sport === "baseball") {
    const inning = Math.min(9, Math.floor(elapsedMin / 18) + 1);
    return `Inn ${inning}`;
  }

  return `${Math.min(elapsedMin, maxDuration)}'`;
};

const normalizeEvent = (event, sport) => {
  const [odds, oddsUpdatedAt, bookmaker] = extractOdds(event) || [null, null, null];
  const scores = event.scores || {};
  const fullTime = scores.periods?.ft || {};
  const homeScore = fullTime.home ?? scores.home;
  const awayScore = fullTime.away ?? scores.away;
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const finished = event.status === "settled";
  const live = event.status === "live";
  const elapsed = live ? estimateElapsed(event, sport) : null;

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
    status: finished ? "finished" : live ? "live" : "upcoming",
    score: hasScore ? `${homeScore}-${awayScore}` : null,
    result: finished && hasScore ? homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X" : null,
    odds,
    oddsUpdatedAt,
    elapsed,
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
        .map((event) => normalizeEvent(event, sport));
      return {
        matches,
        source: "Odds API",
        fetchedAt: new Date().toISOString(),
        oddsAvailable: matches.some((m) => m.odds),
        errors: payload.error ? [payload.error] : [],
      };
    })
    .finally(() => pending.delete(sport));

  pending.set(sport, request);
  return request;
}
