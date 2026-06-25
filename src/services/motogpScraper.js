const CACHE_KEY = "playfulbet:motogp-data:v1";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const CALENDAR_URL = "/motogp/en/calendar";
const RESULTS_URL = "/motogp/en/gp-results";

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

const CIRCUIT_COUNTRIES = {
  netherlands: "Países Bajos", germany: "Alemania", britain: "Reino Unido", aragon: "España",
  "san marino": "San Marino", italy: "Italia", austria: "Austria", japan: "Japón",
  australia: "Australia", malaysia: "Malasia", qatar: "Qatar", portugal: "Portugal",
  valencia: "España", thailand: "Tailandia", indonesia: "Indonesia", argentina: "Argentina",
  americas: "Estados Unidos", brazil: "Brasil", mexico: "México", spain: "España",
  france: "Francia", italy_misano: "Italia", italy_mugello: "Italia", czech: "Chequia",
  finland: "Finlandia", kazakhstan: "Kazajistán", turkey: "Turquía",
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

const parseDate = (dateStr) => {
  const m = dateStr.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*(\w+)\s*(\d{4})/);
  if (!m) return null;
  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const day = Number(m[1]);
  const month = months[m[3]];
  const year = Number(m[4]);
  if (month == null) return null;
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return d.toISOString();
};

const determineStatus = (dateIso) => {
  const d = new Date(dateIso);
  const now = new Date();
  if (d < daysAgo(1)) return "finished";
  if (d < daysAhead(1)) return "live";
  return "upcoming";
};

const fetchCalendarHTML = async () => {
  const res = await fetch(CALENDAR_URL, {
    headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`MotoGP calendar: ${res.status}`);
  return res.text();
};

const parseCalendarHTML = (html) => {
  const races = [];
  const blockRe = /<div class="event-card[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const blocks = html.match(blockRe) || [];

  for (const block of blocks) {
    const nameMatch = block.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
    const dateMatch = block.match(/(\d{1,2}\s*-\s*\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{4})/i);
    const countryMatch = block.match(/country-name[^>]*>\s*([^<]+?)\s*</i) || block.match(/,\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*<\/span>/);

    if (!nameMatch || !dateMatch) continue;

    const name = nameMatch[1].trim();
    const dateText = dateMatch[1].trim();
    const dateIso = parseDate(dateText);
    if (!dateIso) continue;

    const country = countryMatch ? countryMatch[1].trim() : "MotoGP";

    races.push({
      name,
      date: dateIso,
      country,
    });
  }

  if (races.length === 0) {
    const altRe = /(?:NETHERLANDS|GERMANY|GREAT BRITAIN|ARAGON|SAN MARINO|ITALY|AUSTRIA|JAPAN|AUSTRALIA|MALAYSIA|QATAR|PORTUGAL|VALENCIA|THAILAND|INDONESIA|ARGENTINA|UNITED STATES|BRAZIL|MEXICO|SPAIN|FRANCE)/g;
    const altDates = html.match(altRe) || [];
    const altDateRe = /(\d{1,2}\s*-\s*\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{4})/gi;
    const altDateMatches = html.match(altDateRe) || [];

    for (let i = 0; i < Math.max(altDates.length, altDateMatches.length); i++) {
      const countryKey = (altDates[i] || "").toLowerCase().replace(/\s+/g, " ").trim();
      const countryName = CIRCUIT_COUNTRIES[countryKey] || altDates[i] || "MotoGP";
      const dateIso = altDateMatches[i] ? parseDate(altDateMatches[i]) : null;
      if (!dateIso) continue;
      races.push({
        name: `${countryName} Grand Prix`,
        date: dateIso,
        country: countryName,
      });
    }
  }

  return races;
};

const fetchResultsHTML = async () => {
  try {
    const res = await fetch(RESULTS_URL, {
      headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    return res.text();
  } catch { return ""; }
};

const parseResultsHTML = (html) => {
  const results = [];
  const blockRe = /<div class="event-card[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
  const blocks = html.match(blockRe) || [];

  for (const block of blocks) {
    const nameMatch = block.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
    const winnerMatch = block.match(/winner[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/i)
      || block.match(/<p[^>]*class="winner[^"]*"[^>]*>\s*([^<]+?)\s*</i);

    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    const winner = winnerMatch ? winnerMatch[1].trim() : null;

    results.push({ name, winner });
  }

  return results;
};

const normalizeRace = (race, resultsByName = {}) => {
  const dateIso = race.date;
  const status = determineStatus(dateIso);
  const result = resultsByName[race.name.toLowerCase()] || resultsByName[race.name];
  const winner = result?.winner || null;

  return {
    id: `motogp-${dateIso.slice(0, 10)}-${race.name.toLowerCase().replace(/\s+/g, "-")}`,
    sportKey: "motorsport",
    sportName: "MotoGP",
    league: "MotoGP",
    leagueLogo: null,
    home: race.name,
    away: winner ? `🏆 ${winner}` : "MotoGP",
    homeBadge: null,
    awayBadge: null,
    date: dateIso,
    endsAt: dateIso,
    venue: null,
    location: race.country,
    status,
    statusLabel: race.country,
    elapsed: null,
    score: winner ? `Ganador: ${winner}` : null,
    result: null,
    odds: null,
    oddsSource: null,
    dataSource: "MotoGP.com",
    motogpData: {
      country: race.country,
      winner,
    },
  };
};

export async function fetchMotoGPData({ force = false } = {}) {
  if (!force) { const c = readCache(); if (c) return { ...c, cached: true }; }

  const [calendarHTML, resultsHTML] = await Promise.all([
    fetchCalendarHTML(),
    fetchResultsHTML(),
  ]);

  const races = parseCalendarHTML(calendarHTML);
  const results = parseResultsHTML(resultsHTML);
  const resultsByName = {};
  for (const r of results) {
    resultsByName[r.name.toLowerCase()] = r;
    resultsByName[r.name] = r;
  }

  const matches = races
    .map((race) => normalizeRace(race, resultsByName))
    .filter((match) => {
      const d = new Date(match.date);
      const now = new Date();
      const diffDays = (d - now) / (1000 * 60 * 60 * 24);
      return diffDays >= -7 && diffDays <= 14;
    });

  if (matches.length === 0) {
    const mockRaces = [
      { name: "Netherlands Grand Prix", date: daysAhead(7).toISOString(), country: "Países Bajos" },
      { name: "Germany Grand Prix", date: daysAhead(21).toISOString(), country: "Alemania" },
      { name: "British Grand Prix", date: daysAhead(49).toISOString(), country: "Reino Unido" },
    ];
    return {
      matches: mockRaces.map(normalizeRace),
      source: "MotoGP (fallback)",
      fetchedAt: new Date().toISOString(),
    };
  }

  const payload = {
    matches,
    source: "MotoGP.com",
    fetchedAt: new Date().toISOString(),
  };
  writeCache(payload);
  return payload;
}
