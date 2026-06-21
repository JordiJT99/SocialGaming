import { fetchEspnData } from "./espn";
import { fetchTheOddsData } from "./theOddsApi";

const CACHE_KEY = "playfulbet:combined-sports-data:v14";
const CACHE_TTL = 60 * 1000;

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

const normalizeName = (name) => (name || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\b(fc|cf|club|de|football|futbol)\b/g, "")
  .replace(/[^a-z0-9]/g, "");

const eventKey = (match) => `${normalizeName(match.home)}:${normalizeName(match.away)}`;

export async function fetchSportsData({ force = false, includeOdds = true } = {}) {
  const cached = force ? null : readCache();
  if (cached) return { ...cached, cached: true };

  const errors = [];

  let espnPayload = null;
  try {
    espnPayload = await fetchEspnData();
    errors.push(...(espnPayload.providerErrors || []));
  } catch (error) {
    errors.push(`ESPN: ${error.message}`);
  }

  let oddsPayload = null;
  if (includeOdds) {
    try {
      oddsPayload = await fetchTheOddsData();
      errors.push(...(oddsPayload.errors || []).map((e) => `Odds API: ${e}`));
    } catch (error) {
      errors.push(`Odds API: ${error.message}`);
    }
  }

  const espnMatches = espnPayload?.matches || [];
  if (!espnMatches.length && !oddsPayload?.matches?.length) {
    throw new Error(errors.join(" · ") || "No se pudieron cargar datos deportivos");
  }

  const oddsByMatch = new Map((oddsPayload?.matches || []).map((m) => [eventKey(m), m]));
  const mergedMatches = espnMatches.map((match) => {
    const oddsMatch = oddsByMatch.get(eventKey(match));
    if (!oddsMatch) return match;
    return {
      ...match,
      odds: oddsMatch.odds || match.odds,
      oddsSource: oddsMatch.oddsSource || match.oddsSource,
    };
  });

  const result = {
    matches: mergedMatches,
    standings: espnPayload?.standings || [],
    source: [espnPayload?.source, oddsPayload?.source].filter(Boolean).join(" + "),
    oddsAvailable: Boolean(oddsPayload?.oddsAvailable),
    oddsQuota: oddsPayload?.quota,
    providerErrors: errors,
    fetchedAt: new Date().toISOString(),
  };

  writeCache(result);
  return result;
}
