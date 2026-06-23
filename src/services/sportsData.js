import { fetchEspnData } from "./espn";
import { fetchTheOddsData } from "./theOddsApi";
import { tennisPairOrientation } from "./tennisMatching";

const CACHE_KEY = "playfulbet:combined-sports-data:v24";
const CACHE_TTL = 30 * 60 * 1000;
const ODDS_SPORTS = ["football", "basketball", "tennis", "baseball", "ice-hockey"];

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

const STOPWORDS = new Set(["fc", "cf", "club", "de", "football", "futbol", "the", "los", "las", "city", "calcio"]);

const nameWords = (name) => (name || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ")
  .split(/\s+/)
  .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

const sharesWord = (wordsA, wordsB) => wordsA.some((word) => wordsB.includes(word));
const teamKey = (name) => nameWords(name).join(":");
const hasNamedParticipants = (match) => ![match.home, match.away].some((name) =>
  /^(tbd|tba|unknown|to be determined|\?|r16p\d+|qf\d+|wqf\d+)$/i.test((name || "").trim()),
);

const findOddsMatch = (match, oddsMatches) => {
  const homeWords = nameWords(match.home);
  const awayWords = nameWords(match.away);
  const matchTime = new Date(match.date).getTime();

  for (const odds of oddsMatches) {
    if (Math.abs(new Date(odds.date).getTime() - matchTime) > 12 * 60 * 60 * 1000) continue;
    if (match.sportKey === "tennis" && odds.sportKey === "tennis") {
      const orientation = tennisPairOrientation(match, odds);
      if (orientation) return { odds, reversed: orientation === "reversed" };
    } else if (sharesWord(homeWords, nameWords(odds.home)) && sharesWord(awayWords, nameWords(odds.away))) {
      return { odds, reversed: false };
    }
  }
  return null;
};

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

  let oddsMatches = [];
  let oddsSourceLabel = null;
  if (includeOdds) {
    const results = await Promise.allSettled(ODDS_SPORTS.map((sport) => fetchTheOddsData(sport)));
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        oddsMatches.push(...result.value.matches);
        oddsSourceLabel = result.value.source;
        errors.push(...(result.value.errors || []).map((e) => `Odds API (${ODDS_SPORTS[i]}): ${e}`));
      } else {
        errors.push(`Odds API (${ODDS_SPORTS[i]}): ${result.reason?.message}`);
      }
    });
  }

  const espnMatches = espnPayload?.matches || [];
  if (!espnMatches.length && !oddsMatches.length) {
    throw new Error(errors.join(" · ") || "No se pudieron cargar datos deportivos");
  }

  const matchedOddsIds = new Set();
  const badgeByTeam = new Map(
    (espnPayload?.teams || []).flatMap((team) => team.names.map((name) => [teamKey(name), team.badge])),
  );
  const withKnownBadges = (match) => ({
    ...match,
    homeBadge: match.homeBadge || badgeByTeam.get(teamKey(match.home)) || null,
    awayBadge: match.awayBadge || badgeByTeam.get(teamKey(match.away)) || null,
  });
  const mergedMatches = espnMatches.map((match) => {
    const found = findOddsMatch(match, oddsMatches);
    if (!found) return withKnownBadges(match);
    const { odds: oddsMatch, reversed } = found;
    matchedOddsIds.add(oddsMatch.id);
    const odds = reversed && oddsMatch.odds
      ? { 1: oddsMatch.odds[2], ...(oddsMatch.odds.X ? { X: oddsMatch.odds.X } : {}), 2: oddsMatch.odds[1] }
      : oddsMatch.odds;
    return withKnownBadges({
      ...match,
      league: match.sportKey === "tennis" ? oddsMatch.league : match.league,
      odds: odds || match.odds,
      oddsSource: oddsMatch.oddsSource || match.oddsSource,
      oddsEventId: oddsMatch.oddsEventId,
      oddsUpdatedAt: oddsMatch.oddsUpdatedAt,
      bettingOpen: oddsMatch.bettingOpen,
    });
  });
  mergedMatches.push(...oddsMatches.filter((match) => !matchedOddsIds.has(match.id)).map(withKnownBadges));

  const result = {
    matches: mergedMatches.filter(hasNamedParticipants),
    standings: espnPayload?.standings || [],
    source: [espnPayload?.source, oddsSourceLabel].filter(Boolean).join(" + "),
    oddsAvailable: oddsMatches.length > 0,
    providerErrors: errors,
    fetchedAt: new Date().toISOString(),
  };

  writeCache(result);
  return result;
}
