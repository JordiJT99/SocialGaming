import { fetchApiFootballData } from "./apiFootball";
import { fetchFootballData } from "./footballData";
import { fetchSportsDbMatches } from "./theSportsDb";
import { fetchTheOddsData } from "./theOddsApi";

const CACHE_KEY = "playfulbet:combined-sports-data:v2";
const CACHE_TTL = 10 * 60 * 1000;

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

const providers = [
  { name: "Football-Data", load: fetchFootballData },
  { name: "API-Football", load: fetchApiFootballData },
  {
    name: "TheSportsDB",
    load: async () => {
      const payload = await fetchSportsDbMatches();
      return {
        ...payload,
        standings: [],
        oddsAvailable: false,
      };
    },
  },
];

export async function fetchSportsData() {
  const cached = readCache();
  if (cached) return { ...cached, cached: true };

  const errors = [];

  let basePayload = null;

  for (const provider of providers) {
    try {
      const payload = await provider.load();
      if (payload.matches?.length || payload.standings?.length) {
        basePayload = payload;
        break;
      }
      errors.push(`${provider.name}: sin datos disponibles`);
    } catch (error) {
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  let oddsPayload = null;
  try {
    oddsPayload = await fetchTheOddsData();
  } catch (error) {
    errors.push(`The Odds API: ${error.message}`);
  }

  if (!basePayload && !oddsPayload?.matches?.length) {
    throw new Error(errors.join(" · "));
  }

  const normalizeName = (name = "") => name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|club|de|football|futbol)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

  const eventKey = (match) => `${normalizeName(match.home)}:${normalizeName(match.away)}`;
  const oddsByMatch = new Map((oddsPayload?.matches || []).map((match) => [eventKey(match), match]));
  const mergedMatches = (basePayload?.matches || []).map((match) => {
    const oddsMatch = oddsByMatch.get(eventKey(match));
    if (!oddsMatch) return match;
    oddsByMatch.delete(eventKey(match));
    return {
      ...match,
      odds: oddsMatch.odds || match.odds,
      oddsSource: oddsMatch.oddsSource || match.oddsSource,
      status: oddsMatch.status === "live" ? "live" : match.status,
      score: oddsMatch.score || match.score,
      result: oddsMatch.result || match.result,
    };
  });

  const result = {
    ...(basePayload || {}),
    matches: [...mergedMatches, ...oddsByMatch.values()],
    standings: basePayload?.standings || [],
    source: [basePayload?.source, oddsPayload?.source].filter(Boolean).join(" + "),
    oddsAvailable: Boolean(oddsPayload?.oddsAvailable),
    oddsQuota: oddsPayload?.quota,
    providerErrors: errors,
    fetchedAt: new Date().toISOString(),
  };

  writeCache(result);
  return result;
}
