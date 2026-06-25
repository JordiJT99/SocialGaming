import { fetchEspnData } from "./espn";
import { fetchTheOddsData } from "./theOddsApi";
import { fetchF1Data } from "./f1Api";
import { fetchMotoGPData } from "./motogpScraper";
import { tennisPairOrientation } from "./tennisMatching";

const CACHE_KEY = "playfulbet:combined-sports-data:v30";
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

const STOPWORDS = new Set(["fc", "cf", "club", "de", "football", "futbol", "the", "city", "calcio"]);

const ABBREVIATIONS = {
  "la": ["losangeles", "losangels"],
  "ny": ["newyork"],
  "kc": ["kansascity"],
  "sf": ["sanfrancisco"],
  "tb": ["tampabay"],
  "sd": ["sandiego"],
  "stl": ["stlouis"],
  "no": ["neworleans"],
  "okc": ["oklahomacity"],
  "sa": ["sanantonio"],
};

const expandAbbreviations = (words) => {
  const result = [];
  for (const word of words) {
    result.push(word);
    if (ABBREVIATIONS[word]) {
      result.push(...ABBREVIATIONS[word]);
    }
  }
  return result;
};

const nameWords = (name) => {
  const cleaned = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const raw = cleaned.split(/\s+/).filter((word) => word.length >= 2 && !STOPWORDS.has(word));
  return expandAbbreviations(raw);
};

const sharesWord = (wordsA, wordsB) => {
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  return wordsA.some((word) => wordsB.includes(word));
};

const matchTeamNames = (nameA, nameB) => {
  const wordsA = nameWords(nameA);
  const wordsB = nameWords(nameB);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const shared = wordsA.filter((w) => wordsB.includes(w));
  if (shared.length > 0) return true;
  const concatA = wordsA.join("");
  const concatB = wordsB.join("");
  if (concatA.length >= 4 && concatB.length >= 4 && (concatA.includes(concatB) || concatB.includes(concatA))) return true;
  return false;
};

const teamKey = (name) => nameWords(name).join(":");

const PLACEHOLDER_PATTERNS = [
  /^(tbd|tba|unknown|to be determined|\?)$/i,
  /^([wl]?[a-z]{0,3}\d{1,3})$/i,
  /\b(winner|loser|ganador|perdedor)\b/i,
  /\bround of \d+\b/i,
  /\bgroup [a-z]\b/i,
  /\b(quarter ?final|semi ?final|cuartos|semifinal)\b/i,
  /\bthird place\b/i,
  /\b\d+(st|nd|rd|th) place\b/i,
];

const isPlaceholderName = (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const hasNamedParticipants = (match) => !isPlaceholderName(match.home) && !isPlaceholderName(match.away);

const findOddsMatch = (match, oddsMatches) => {
  const homeWords = nameWords(match.home);
  const awayWords = nameWords(match.away);
  const matchTime = new Date(match.date).getTime();

  for (const odds of oddsMatches) {
    if (Math.abs(new Date(odds.date).getTime() - matchTime) > 12 * 60 * 60 * 1000) continue;
    if (match.sportKey === "tennis" && odds.sportKey === "tennis") {
      const orientation = tennisPairOrientation(match, odds);
      if (orientation) return { odds, reversed: orientation === "reversed" };
    } else if (matchTeamNames(match.home, odds.home) && matchTeamNames(match.away, odds.away)) {
      return { odds, reversed: false };
    }
  }
  return null;
};

export async function fetchSportsData({ force = false, includeOdds = true } = {}) {
  // Ignora cache si hay partidos en vivo (necesitan actualización en tiempo real)
  const cached = force ? null : readCache();
  const hasLiveMatches = cached?.matches?.some((m) => m.status === "live");
  if (cached && !hasLiveMatches) return { ...cached, cached: true };

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

  let f1Matches = [];
  let motogpMatches = [];
  try {
    const f1Payload = await fetchF1Data({ force });
    f1Matches = f1Payload.matches || [];
    errors.push(...(f1Payload.errors || []).map((e) => `F1: ${e}`));
  } catch (error) {
    errors.push(`F1: ${error.message}`);
  }
  try {
    const motogpPayload = await fetchMotoGPData({ force });
    motogpMatches = motogpPayload.matches || [];
  } catch (error) {
    errors.push(`MotoGP: ${error.message}`);
  }

  const extraMatches = [...f1Matches, ...motogpMatches];

  if (!espnMatches.length && !oddsMatches.length && !extraMatches.length) {
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
      elapsed: match.elapsed || oddsMatch.elapsed || null,
      score: match.score || oddsMatch.score || null,
      odds: odds || match.odds,
      oddsSource: oddsMatch.oddsSource || match.oddsSource,
      oddsEventId: oddsMatch.oddsEventId,
      oddsUpdatedAt: oddsMatch.oddsUpdatedAt,
      bettingOpen: oddsMatch.bettingOpen,
    });
  });
  mergedMatches.push(...oddsMatches.filter((match) => !matchedOddsIds.has(match.id)).map(withKnownBadges));
  mergedMatches.push(...extraMatches);

  const result = {
    matches: mergedMatches.filter(hasNamedParticipants),
    standings: espnPayload?.standings || [],
    source: [espnPayload?.source, oddsSourceLabel, f1Matches.length ? "Ergast" : null, motogpMatches.length ? "MotoGP" : null].filter(Boolean).join(" + "),
    oddsAvailable: oddsMatches.length > 0,
    providerErrors: errors,
    fetchedAt: new Date().toISOString(),
  };

  writeCache(result);
  return result;
}
