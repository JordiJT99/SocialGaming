import {
  cleanupSportsData,
  getApiUsageSince,
  getEventsNeedingOdds,
  getSportSync,
  getSportsCoverage,
  getStoredSportsEvent,
  getStoredSportsEvents,
  recordApiUsage,
  saveEventOdds,
  saveSportsEvents,
  setSportSync,
} from "./database.js";

const TTL = 30 * 60 * 1000;
const TIMEOUT = 10_000;
const SPORTS = ["football", "basketball", "tennis", "baseball", "ice-hockey"];
const BOOKMAKERS = ["Bet365", "DraftKings"];
const BETTING_CUTOFF = 2 * 60 * 1000;
const MAX_QUOTE_AGE = 5 * 60 * 1000;
const BUDGET_PER_HOUR = 95;
const ODDS_WINDOW = 10 * 24 * 60 * 60 * 1000;
let cleanupDay = "";
let syncing = null;

const LEAGUE_FILTERS = {
  football: [
    /fifa world cup/i,
    /england - premier league$/i,
    /spain - la ?liga$/i,
    /italy - serie a$/i,
    /france - ligue 1$/i,
    /germany - bundesliga$/i,
    /uefa champions league/i,
  ],
  basketball: [/\bnba\b/i, /\bwnba\b/i],
  tennis: [/^atp -/i, /^wta -/i],
  baseball: [/\bmlb\b/i],
  "ice-hockey": [/\bnhl\b/i],
};

const LEAGUE_EXCLUDES = {
  football: [/qualification/i, /women/i],
  tennis: [/doubles/i, /qualifying/i],
};

const MAX_LEAGUES_PER_SPORT = { football: 8, tennis: 6, default: 2 };
const leaguePriority = (league, sport) => {
  const name = league.name.toLowerCase();
  if (sport === "tennis") {
    if (/wimbledon|roland garros|french open|us open|australian open/.test(name)) return 100;
    if (/masters|1000/.test(name)) return 80;
    if (/^atp -/.test(name)) return 60;
    if (/^wta -/.test(name)) return 50;
  }
  return 0;
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "private, max-age=60");
  res.end(JSON.stringify(payload));
};

const validateEvents = (payload) => {
  if (!Array.isArray(payload)) throw new Error("Respuesta de eventos inválida");
  return payload.filter((event) =>
    event && event.id && event.home && event.away && event.date,
  );
};

const validateOdds = (payload) => {
  if (!Array.isArray(payload)) throw new Error("Respuesta de cuotas inválida");
  return payload.filter((event) => event && event.id && event.bookmakers);
};

const readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 2_000) reject(new Error("Solicitud demasiado grande"));
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(body || "{}"));
    } catch {
      reject(new Error("JSON no válido"));
    }
  });
});

const currentMarket = (event) => {
  for (const bookmaker of BOOKMAKERS) {
    const market = event.bookmakers?.[bookmaker]?.find((item) => item.name === "ML");
    if (market?.odds?.[0]?.home && market.odds[0].away) return market.odds[0];
  }
  return null;
};

async function validatePrediction(req, res) {
  try {
    const { eventId, selection, offeredOdds, acceptChange = false, placedAt } = await readBody(req);
    if (!eventId || !["1", "X", "2"].includes(selection)) {
      return json(res, 400, { error: "Predicción inválida" });
    }

    const stored = getStoredSportsEvent(eventId);
    if (!stored) return json(res, 404, { error: "Evento no encontrado" });

    const { event, oddsUpdatedAt } = stored;
    const startsAt = new Date(event.date).getTime();
    const placedAtMs = new Date(placedAt).getTime();
    if (Number.isFinite(startsAt) && Number.isFinite(placedAtMs) && placedAtMs < startsAt && Date.now() >= startsAt) {
      return json(res, 200, {
        accepted: true,
        eventId: String(eventId),
        selection,
        odds: Number(offeredOdds),
        validatedAt: new Date().toISOString(),
        acceptedAtStart: true,
      });
    }
    if (event.status !== "pending" || !Number.isFinite(startsAt) || startsAt - Date.now() <= BETTING_CUTOFF) {
      return json(res, 409, { error: "Mercado cerrado" });
    }
    if (!oddsUpdatedAt || Date.now() - oddsUpdatedAt > MAX_QUOTE_AGE) {
      return json(res, 409, {
        code: "ODDS_STALE",
        error: "Esperando actualización de cuota",
      });
    }

    const market = currentMarket(event);
    const price = selection === "1" ? market?.home : selection === "2" ? market?.away : market?.draw;
    if (!price) return json(res, 409, { error: "Selección no disponible" });
    const currentOdds = Number(price);
    const difference = Math.round(Math.abs(currentOdds - Number(offeredOdds)) * 100) / 100;
    if (Number.isFinite(difference) && difference > 0.2 && !acceptChange) {
      return json(res, 409, {
        code: "ODDS_CHANGED",
        error: "La cuota ha cambiado",
        currentOdds,
        offeredOdds: Number(offeredOdds),
      });
    }

    return json(res, 200, {
      accepted: true,
      eventId: String(eventId),
      selection,
      odds: currentOdds,
      validatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
}

async function fetchApi(apiKey, sport, endpoint, params) {
  const query = new URLSearchParams({ ...params, apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  const startedAt = Date.now();

  try {
    const response = await fetch(`https://api.odds-api.io/v3${endpoint}?${query}`, {
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    recordApiUsage(endpoint, sport, response.status, Date.now() - startedAt);

    if (response.status === 429) {
      const reset = String(payload?.error || "").match(
        /resets in\s+(?:(\d+)\s+minutes?)?(?:\s*and\s*)?(\d+)\s+seconds?/i,
      );
      const retryAfter = Number(response.headers.get("retry-after"))
        || (reset ? Number(reset[1] || 0) * 60 + Number(reset[2] || 0) : 3600);
      const error = new Error(payload?.error || "Límite de Odds API alcanzado");
      error.blockedUntil = Date.now() + Math.max(retryAfter, 5) * 1000;
      throw error;
    }
    if (!response.ok) throw new Error(payload?.error || `Odds API respondió con ${response.status}`);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Odds API superó el tiempo de espera");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const LEAGUE_DISCOVERY_TTL = 24 * 60 * 60 * 1000;
const leagueSlugCache = new Map();

async function resolveLeagueSlugs(apiKey, sport) {
  const patterns = LEAGUE_FILTERS[sport];
  if (!patterns?.length) return { slugs: [null], requestsUsed: 0 };

  const cached = leagueSlugCache.get(sport);
  if (cached && Date.now() - cached.fetchedAt < LEAGUE_DISCOVERY_TTL) {
    return { slugs: cached.slugs, requestsUsed: 0 };
  }

  const leagues = await fetchApi(apiKey, sport, "/leagues", { sport });
  if (!Array.isArray(leagues)) return { slugs: [null], requestsUsed: 1 };

  const excludes = LEAGUE_EXCLUDES[sport] || [];
  const matches = leagues
    .filter((league) => patterns.some((pattern) => pattern.test(league.name)))
    .filter((league) => /wimbledon/i.test(league.name) || !excludes.some((pattern) => pattern.test(league.name)))
    .sort((a, b) => leaguePriority(b, sport) - leaguePriority(a, sport) || b.eventsCount - a.eventsCount);

  const max = MAX_LEAGUES_PER_SPORT[sport] || MAX_LEAGUES_PER_SPORT.default;
  const slugs = matches.slice(0, max).map((league) => league.slug);
  leagueSlugCache.set(sport, { slugs, fetchedAt: Date.now() });
  return { slugs, requestsUsed: 1 };
}

async function syncAllSports(apiKey) {
  const needsFullSync = SPORTS.some((sport) => {
    const sync = getSportSync(sport);
    return Date.now() >= sync.blocked_until && (sync.synced_at === 0 || Date.now() - sync.synced_at >= TTL);
  });
  if (!needsFullSync) return;

  let requestsLeft = BUDGET_PER_HOUR;

  for (const sport of SPORTS) {
    if (requestsLeft <= 0) break;
    const sync = getSportSync(sport);
    if (Date.now() < sync.blocked_until) continue;
    if (sync.synced_at > 0 && Date.now() - sync.synced_at < TTL) continue;

    try {
      const { slugs: leagueSlugs, requestsUsed } = await resolveLeagueSlugs(apiKey, sport);
      requestsLeft -= requestsUsed;

      const events = [];
      for (const slug of leagueSlugs) {
        if (requestsLeft <= 0) break;
        const params = { sport, status: "pending,live", limit: 100 };
        if (slug) params.league = slug;
        events.push(...validateEvents(await fetchApi(apiKey, sport, "/events", params)));
        requestsLeft--;
      }
      const cutoff = Date.now() + ODDS_WINDOW;
      const dedupedEvents = [...new Map(events.map((event) => [event.id, event])).values()]
        .filter((event) => event.status === "live" || new Date(event.date).getTime() <= cutoff);
      dedupedEvents.sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        return new Date(a.date) - new Date(b.date);
      });
      saveSportsEvents(sport, dedupedEvents);

      const eventIds = getEventsNeedingOdds(sport, TTL);
      const maxOddsRequests = Math.min(
        Math.ceil(eventIds.length / 10),
        Math.floor(requestsLeft / Math.max(1, SPORTS.length - SPORTS.indexOf(sport))),
      );

      for (let i = 0; i < eventIds.length && i < maxOddsRequests * 10; i += 10) {
        const odds = validateOdds(await fetchApi(apiKey, sport, "/odds/multi", {
          eventIds: eventIds.slice(i, i + 10).join(","),
          bookmakers: BOOKMAKERS.join(","),
        }));
        requestsLeft--;
        saveEventOdds(odds);
      }

      setSportSync(sport);
    } catch (error) {
      setSportSync(sport, error.blockedUntil || Date.now() + TTL);
      if (error.blockedUntil) break;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (cleanupDay !== today) {
    cleanupSportsData();
    cleanupDay = today;
  }
}

export function oddsApi(apiKey) {
  return async (req, res, next) => {
    if (req.url === "/api/predictions/validate" && req.method === "POST") {
      return validatePrediction(req, res);
    }
    if (!req.url.startsWith("/api/odds")) return next();

    if (req.url === "/api/odds/status") {
      const now = Date.now();
      const usage = getApiUsageSince(now - TTL);
      const used = usage.reduce((total, item) => total + Number(item.count), 0);
      const sync = SPORTS.map((sport) => ({ sport, ...getSportSync(sport) }));
      const refreshTimes = sync
        .map((item) => Math.max(item.synced_at + TTL, item.blocked_until))
        .filter((value) => value > now);
      return json(res, 200, {
        usedLastHour: used,
        internalRemaining: Math.max(0, BUDGET_PER_HOUR - used),
        internalBudget: BUDGET_PER_HOUR,
        nextRefreshAt: refreshTimes.length ? Math.min(...refreshTimes) : now,
        usage,
        coverage: getSportsCoverage(),
      });
    }

    const sport = new URL(req.url, "http://localhost").searchParams.get("sport")?.toLowerCase();
    if (!SPORTS.includes(sport)) return json(res, 400, { error: "Deporte no válido" });
    if (!apiKey) return json(res, 503, { error: "Odds API no configurada" });

    if (!syncing) {
      syncing = syncAllSports(apiKey).catch(() => {}).finally(() => { syncing = null; });
    }
    await syncing;

    const events = getStoredSportsEvents(sport);
    const sync = getSportSync(sport);
    return json(res, 200, {
      sport,
      events,
      cachedUntil: Math.max(sync.synced_at + TTL, sync.blocked_until),
      stale: Date.now() - sync.synced_at > TTL,
    });
  };
}
