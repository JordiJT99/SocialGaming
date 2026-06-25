const CACHE_KEY = "playfulbet:f1-data:v1";
const CACHE_TTL = 60 * 60 * 1000;
const BASE = "/jolpi/ergast/f1";

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const readCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.payload;
  } catch {}
  return null;
};
const writeCache = (p) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload: p })); } catch {}
};

const TEAM_COLORS = {
  mercedes: "#27F4D2",
  ferrari: "#DC0000",
  red_bull: "#1E41FF",
  mclaren: "#FF8000",
  aston_martin: "#006F62",
  alpine: "#0090FF",
  williams: "#005AFF",
  rb: "#6692FF",
  audi: "#FF1900",
  haas: "#B6BABD",
  cadillac: "#1A1A1A",
};

const TEAM_NAMES_ES = {
  mercedes: "Mercedes",
  ferrari: "Ferrari",
  red_bull: "Red Bull",
  mclaren: "McLaren",
  aston_martin: "Aston Martin",
  alpine: "Alpine",
  williams: "Williams",
  rb: "RB",
  audi: "Audi",
  haas: "Haas",
  cadillac: "Cadillac",
};

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (n) => {
  const d = today();
  d.setDate(d.getDate() - n);
  return d;
};

const daysAhead = (n) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return d;
};

const buildDateRange = () => {
  const from = daysAgo(7);
  const to = daysAhead(14);
  return `${from.toISOString().slice(0, 10).replace(/-/g, "")}-${to.toISOString().slice(0, 10).replace(/-/g, "")}`;
};

const formatDateTime = (date, time) => {
  if (!date) return null;
  const iso = time ? `${date}T${time}` : `${date}T00:00:00Z`;
  return new Date(iso).toISOString();
};

const determineStatus = (raceDate) => {
  const race = new Date(raceDate);
  const now = new Date();
  if (race < daysAgo(1)) return "finished";
  if (race < daysAhead(1)) return "live";
  return "upcoming";
};

const fetchSchedule = async () => {
  const res = await fetch(`${BASE}/current.json`);
  if (!res.ok) throw new Error(`Ergast schedule: ${res.status}`);
  const data = await res.json();
  return data.MRData?.RaceTable?.Races || [];
};

const fetchResults = async () => {
  try {
    const res = await fetch(`${BASE}/current/results.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.MRData?.RaceTable?.Races || [];
  } catch { return []; }
};

const fetchQualifying = async () => {
  try {
    const res = await fetch(`${BASE}/current/qualifying.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.MRData?.RaceTable?.Races || [];
  } catch { return []; }
};

const normalizeRace = (race, resultsByRound = {}, qualifyingByRound = {}) => {
  const dateTime = formatDateTime(race.date, race.time);
  const status = determineStatus(dateTime);
  const round = Number(race.round);
  const result = resultsByRound[round];
  const qualifying = qualifyingByRound[round];

  const drivers = (result?.Results || []).map((r) => ({
    position: Number(r.position),
    name: `${r.Driver.givenName} ${r.Driver.familyName}`,
    shortName: r.Driver.code || r.Driver.familyName,
    team: r.Constructor.constructorId,
    teamName: TEAM_NAMES_ES[r.Constructor.constructorId] || r.Constructor.name,
    time: r.Time?.time || null,
    points: Number(r.points || 0),
    grid: Number(r.grid || 0),
    status: r.status,
  }));

  return {
    id: `f1-${race.season}-${round}`,
    sportKey: "motorsport",
    sportName: "Fórmula 1",
    league: "Fórmula 1",
    leagueLogo: null,
    home: race.raceName,
    away: `Round ${round}`,
    homeBadge: null,
    awayBadge: null,
    date: dateTime,
    endsAt: dateTime,
    venue: race.Circuit?.circuitName || null,
    location: race.Circuit?.Location?.locality ? `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}` : null,
    status,
    statusLabel: `Round ${round}`,
    elapsed: null,
    score: result ? `${drivers[0]?.name?.split(" ").pop() || "?"} won` : null,
    result: result && drivers[0] ? null : null,
    odds: null,
    oddsSource: null,
    dataSource: "Ergast",
    f1Data: {
      round,
      season: race.season,
      raceName: race.raceName,
      circuit: race.Circuit?.circuitName,
      locality: race.Circuit?.Location?.locality,
      country: race.Circuit?.Location?.country,
      drivers,
      polePosition: qualifying?.QualifyingResults?.[0]?.Driver
        ? `${qualifying.QualifyingResults[0].Driver.givenName} ${qualifying.QualifyingResults[0].Driver.familyName}`
        : null,
      fastestLap: drivers.find((d) => d.status === "Finished" && drivers.some((x) => x.name === d.name)) || null,
    },
  };
};

export async function fetchF1Data({ force = false } = {}) {
  if (!force) { const c = readCache(); if (c) return { ...c, cached: true }; }

  const [schedule, results, qualifying] = await Promise.all([
    fetchSchedule(),
    fetchResults(),
    fetchQualifying(),
  ]);

  const resultsByRound = {};
  for (const r of results) resultsByRound[Number(r.round)] = r;
  const qualifyingByRound = {};
  for (const q of qualifying) qualifyingByRound[Number(q.round)] = q;

  const matches = schedule
    .map((race) => normalizeRace(race, resultsByRound, qualifyingByRound))
    .filter((match) => {
      const d = new Date(match.date);
      const now = new Date();
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      return diffDays >= -7 && diffDays <= 14;
    });

  const payload = {
    matches,
    source: "Ergast",
    fetchedAt: new Date().toISOString(),
  };
  writeCache(payload);
  return payload;
}
