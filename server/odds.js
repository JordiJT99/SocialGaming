import {
  cleanupSportsData,
  getEventsNeedingOdds,
  getSportSync,
  getStoredSportsEvents,
  recordApiUsage,
  saveEventOdds,
  saveSportsEvents,
  setSportSync,
} from "./database.js";

const TTL = 60 * 60 * 1000;
const TIMEOUT = 10_000;
const SPORTS = new Set(["football", "basketball", "tennis"]);
const BOOKMAKER = "Bet365";
const pending = new Map();
let cleanupDay = "";

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

async function syncSport(apiKey, sport) {
  const sync = getSportSync(sport);
  if (Date.now() < sync.blocked_until || Date.now() - sync.synced_at < TTL) {
    return getStoredSportsEvents(sport);
  }

  const events = validateEvents(await fetchApi(apiKey, sport, "/events", {
    sport,
    bookmaker: BOOKMAKER,
    status: "pending,live",
    limit: 100,
  }));
  saveSportsEvents(sport, events);

  const eventIds = getEventsNeedingOdds(sport, TTL);
  for (let index = 0; index < eventIds.length; index += 10) {
    const odds = validateOdds(await fetchApi(apiKey, sport, "/odds/multi", {
      eventIds: eventIds.slice(index, index + 10).join(","),
      bookmakers: BOOKMAKER,
    }));
    saveEventOdds(odds);
  }

  setSportSync(sport);
  const today = new Date().toISOString().slice(0, 10);
  if (cleanupDay !== today) {
    cleanupSportsData();
    cleanupDay = today;
  }
  return getStoredSportsEvents(sport);
}

export function oddsApi(apiKey) {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/odds")) return next();

    const sport = new URL(req.url, "http://localhost").searchParams.get("sport")?.toLowerCase();
    if (!SPORTS.has(sport)) return json(res, 400, { error: "Deporte no válido" });
    if (!apiKey) return json(res, 503, { error: "Odds API no configurada" });

    try {
      if (!pending.has(sport)) {
        pending.set(sport, syncSport(apiKey, sport).finally(() => pending.delete(sport)));
      }
      const events = await pending.get(sport);
      const sync = getSportSync(sport);
      return json(res, 200, {
        sport,
        events,
        cachedUntil: Math.max(sync.synced_at + TTL, sync.blocked_until),
      });
    } catch (error) {
      const stored = getStoredSportsEvents(sport);
      setSportSync(sport, error.blockedUntil || Date.now() + TTL);
      return json(res, 200, {
        sport,
        events: stored,
        stale: true,
        error: error.message,
      });
    }
  };
}
