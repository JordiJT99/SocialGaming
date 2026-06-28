import { randomBytes } from "node:crypto";
import { db } from "./database.js";
import { espnFantasyStats, fantasyPoints, nextFantasyPrice } from "./fantasyScoring.js";

const DAY = 86400000;
const WEEK = 7 * DAY;
const LIVE_REFRESH = 30 * 60000;
const STARTING_BUDGET = 100000000;
const STARTING_TEAM_MIN_VALUE = 100000000;
const STARTING_TEAM_MAX_VALUE = 120000000;
const MARKET_SIZE = 30;
const MARKET_TIMEZONE = "Europe/Madrid";
const FORMATIONS = { "4-4-2": [4, 4, 2], "4-3-3": [4, 3, 3], "3-5-2": [3, 5, 2], "3-4-3": [3, 4, 3], "5-3-2": [5, 3, 2] };
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const position = { Goalkeeper: "POR", Defender: "DEF", Midfielder: "MED", Forward: "DEL", Attacker: "DEL" };

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

const teamKey = (userId, leagueId) => `${userId}:${leagueId}`;

const body = (req) => new Promise((resolve, reject) => {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 20000) reject(new Error("Solicitud demasiado grande"));
  });
  req.on("end", () => {
    try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("JSON no valido")); }
  });
});

const madridDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: MARKET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function nextMadridMidnight() {
  const [year, month, day] = madridDate().split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day + 1);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: MARKET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(naive)).map((part) => [part.type, part.value]));
  const shownAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return naive - (shownAsUtc - naive);
}

const rangeDates = (days = 10) => {
  const start = new Date();
  const end = new Date(Date.now() + days * DAY);
  const fmt = (value) => value.toISOString().slice(0, 10).replaceAll("-", "");
  return `${fmt(start)}-${fmt(end)}`;
};

const logo = (item = {}) => item.logos?.[0]?.href || item.logo || null;

const espnStatus = (event) => {
  const type = event.status?.type || {};
  if (type.state === "in") return "live";
  if (type.completed) return "finished";
  return "open";
};

const competitor = (event, side) =>
  event.competitions?.[0]?.competitors?.find((item) => item.homeAway === side) || null;

const normalizeFixture = (event, previous = {}) => {
  const home = competitor(event, "home");
  const away = competitor(event, "away");
  return {
    id: Number(event.id),
    name: event.shortName || event.name || `${home?.team?.displayName || "Local"} vs ${away?.team?.displayName || "Visitante"}`,
    date: event.date,
    status: espnStatus(event),
    statusDetail: event.status?.type?.detail || event.status?.type?.description || "",
    completed: !!event.status?.type?.completed,
    processed: previous.processed || false,
    league: event.league?.name || event.competitions?.[0]?.competition?.name || "",
    home: home && {
      id: Number(home.team?.id),
      name: home.team?.displayName || home.team?.shortDisplayName || home.team?.name,
      shortName: home.team?.abbreviation || home.team?.shortDisplayName || home.team?.name,
      logo: logo(home.team),
      score: Number(home.score || 0),
    },
    away: away && {
      id: Number(away.team?.id),
      name: away.team?.displayName || away.team?.shortDisplayName || away.team?.name,
      shortName: away.team?.abbreviation || away.team?.shortDisplayName || away.team?.name,
      logo: logo(away.team),
      score: Number(away.score || 0),
    },
  };
};

async function espn(league, endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const path = `${league}/${endpoint}`.replace(/\/+$/, "");
  const response = await fetch(`${ESPN_BASE}/${path}${query ? `?${query}` : ""}`);
  const payload = await response.json();
  db.prepare("INSERT INTO fantasy_api_usage (endpoint, remaining, created_at) VALUES (?, ?, ?)")
    .run(path, null, Date.now());
  if (!response.ok) throw new Error(`ESPN: ${response.status}`);
  return payload;
}

function playerPrice(id, pos) {
  const base = { POR: 3500000, DEF: 5000000, MED: 7000000, DEL: 8500000 }[pos] || 3000000;
  return base + (Number(id) % 31) * 150000;
}

async function syncPlayers(league) {
  const freshest = db.prepare("SELECT MAX(updated_at) AS value FROM fantasy_players").get()?.value || 0;
  if (Date.now() - freshest < WEEK) return;
  const teams = (await espn(league, "teams")).sports?.[0]?.leagues?.[0]?.teams || [];
  const save = db.prepare(`
    INSERT INTO fantasy_players (id, name, team_id, team_name, team_logo, position, photo, price, previous_price, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, team_id=excluded.team_id, team_name=excluded.team_name,
      team_logo=excluded.team_logo, position=excluded.position, photo=excluded.photo, updated_at=excluded.updated_at
  `);
  for (const item of teams) {
    const team = item.team || {};
    const roster = await espn(league, `teams/${team.id}/roster`);
    for (const p of roster.athletes || []) {
      const pos = position[p.position?.displayName] || position[p.position?.name];
      if (!pos) continue;
      const price = playerPrice(p.id, pos);
      save.run(
        Number(p.id),
        p.displayName || p.fullName,
        Number(team.id),
        team.displayName || team.name,
        logo(team),
        pos,
        p.headshot?.href || p.flag?.href || null,
        price,
        price,
        Date.now(),
      );
    }
  }
}

const fixtureTime = (fixture) => new Date(fixture.date).getTime();

function calculate(fixtures, finalize = false) {
  const player = db.prepare("SELECT position, price FROM fantasy_players WHERE id = ?");
  const existing = db.prepare("SELECT 1 FROM fantasy_player_stats WHERE fixture_id=? AND player_id=?");
  const save = db.prepare(`
    INSERT INTO fantasy_player_stats (fixture_id, player_id, points, payload, calculated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(fixture_id, player_id) DO UPDATE SET points=excluded.points, payload=excluded.payload, calculated_at=excluded.calculated_at
  `);
  for (const fixture of fixtures) for (const item of fixture.players || []) {
    const stored = player.get(item.id);
    if (!stored || !item.stats) continue;
    const points = fantasyPoints(item.stats, stored.position);
    const firstCalculation = !existing.get(fixture.id, item.id);
    save.run(fixture.id, item.id, points, JSON.stringify(item.stats), Date.now());
    const price = finalize ? nextFantasyPrice(stored.price, points) : stored.price;
    db.prepare(`UPDATE fantasy_players SET previous_price=CASE WHEN ? THEN price ELSE previous_price END,
      price=?, last_round_points=?, total_points=(SELECT COALESCE(SUM(points),0) FROM fantasy_player_stats WHERE player_id=?), updated_at=? WHERE id=?`)
      .run(finalize ? 1 : 0, price, points, item.id, Date.now(), item.id);
  }
  db.exec(`
    UPDATE fantasy_teams SET
      total_points = COALESCE((SELECT SUM(p.total_points * CASE WHEN tp.is_captain=1 THEN 2 ELSE 1 END)
        FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id
        WHERE tp.user_id=fantasy_teams.user_id AND tp.is_starter=1), 0),
      round_points = COALESCE((SELECT SUM(p.last_round_points * CASE WHEN tp.is_captain=1 THEN 2 ELSE 1 END)
        FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id
        WHERE tp.user_id=fantasy_teams.user_id AND tp.is_starter=1), 0)
  `);
}

async function syncFixtures(league) {
  const row = db.prepare("SELECT * FROM fantasy_rounds WHERE id = 'current'").get();
  if (!row || Date.now() - row.updated_at >= LIVE_REFRESH) {
    const previous = Object.fromEntries(JSON.parse(row?.fixture_ids || "[]").map((fixture) => [fixture.id, fixture]));
    const events = (await espn(league, "scoreboard", { dates: rangeDates(10) })).events || [];
    const fixtures = events
      .filter((event) => competitor(event, "home") && competitor(event, "away"))
      .map((event) => normalizeFixture(event, previous[Number(event.id)] || {}));
    const starts = fixtures.map(fixtureTime).filter(Number.isFinite);
    const status = fixtures.some((fixture) => fixture.status === "live") ? "live" : "open";
    db.prepare(`
      INSERT INTO fantasy_rounds (id, name, starts_at, status, fixture_ids, updated_at) VALUES ('current', ?, ?, 'open', ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, starts_at=excluded.starts_at, fixture_ids=excluded.fixture_ids, updated_at=excluded.updated_at
    `).run("Proxima jornada", starts.length ? Math.min(...starts) : null, JSON.stringify(fixtures), Date.now());
    db.prepare("UPDATE fantasy_rounds SET status=? WHERE id='current'").run(status);
  }

  const current = db.prepare("SELECT * FROM fantasy_rounds WHERE id = 'current'").get();
  const fixtures = JSON.parse(current?.fixture_ids || "[]");
  const now = Date.now();
  const live = fixtures.filter((fixture) => fixture.status === "live" && now - (fixture.liveSyncedAt || 0) >= LIVE_REFRESH);
  const pending = fixtures.filter((fixture) => fixture.completed && !fixture.processed);
  if (!live.length && !pending.length) return;

  for (const fixture of live) {
    const summary = await espn(league, "summary", { event: fixture.id });
    const players = (summary.rosters || []).flatMap((team) =>
      (team.roster || []).map((entry) => ({ id: Number(entry.athlete?.id), stats: espnFantasyStats(entry, summary.keyEvents || []) })),
    );
    calculate([{ id: fixture.id, finished: false, players }]);
    fixture.liveSyncedAt = now;
  }

  for (const fixture of pending) {
    const summary = await espn(league, "summary", { event: fixture.id });
    const players = (summary.rosters || []).flatMap((team) =>
      (team.roster || []).map((entry) => ({ id: Number(entry.athlete?.id), stats: espnFantasyStats(entry, summary.keyEvents || []) })),
    );
    calculate([{ id: fixture.id, finished: true, players }], true);
    fixture.processed = true;
    fixture.liveSyncedAt = now;
  }

  db.prepare("UPDATE fantasy_rounds SET fixture_ids = ?, updated_at = ?, status = ? WHERE id = 'current'")
    .run(JSON.stringify(fixtures), Date.now(), fixtures.some((fixture) => fixture.status === "live") ? "live" : "open");
}

function getActiveLeague(userId, requestedLeagueId) {
  const memberships = db.prepare("SELECT league_id FROM fantasy_league_members WHERE user_id=? ORDER BY league_id").all(userId).map((row) => Number(row.league_id));
  const owned = db.prepare("SELECT league_id FROM fantasy_teams WHERE owner_user_id=? ORDER BY league_id").all(userId).map((row) => Number(row.league_id));
  const leagues = [...new Set([1, ...memberships, ...owned])];
  if (requestedLeagueId && leagues.includes(Number(requestedLeagueId))) return Number(requestedLeagueId);
  return leagues[0] || 1;
}

function getTeam(userId, leagueId) {
  return db.prepare("SELECT * FROM fantasy_teams WHERE owner_user_id = ? AND league_id = ?").get(userId, leagueId)
    || db.prepare("SELECT * FROM fantasy_teams WHERE user_id = ? AND league_id = ?").get(userId, leagueId)
    || null;
}

function snapshot(userId, activeLeagueId) {
  const team = getTeam(userId, activeLeagueId);
  const entryId = team?.user_id || teamKey(userId, activeLeagueId);
  const squad = team ? db.prepare(`
    SELECT p.*, tp.purchase_price, tp.is_starter, tp.is_captain FROM fantasy_team_players tp
    JOIN fantasy_players p ON p.id=tp.player_id WHERE tp.user_id=? ORDER BY tp.is_starter DESC, p.position, p.name
  `).all(entryId) : [];
  const round = db.prepare("SELECT * FROM fantasy_rounds WHERE id='current'").get() || null;
  const rankings = db.prepare(`
    SELECT name, total_points, round_points, budget FROM fantasy_teams WHERE league_id=? ORDER BY total_points DESC, round_points DESC LIMIT 100
  `).all(activeLeagueId);
  const leagues = db.prepare(`
    SELECT l.*, COUNT(m.user_id) members FROM fantasy_leagues l LEFT JOIN fantasy_league_members m ON m.league_id=l.id
    WHERE l.id IN (SELECT league_id FROM fantasy_league_members WHERE user_id=?) OR l.id IN (SELECT league_id FROM fantasy_teams WHERE owner_user_id=?)
    GROUP BY l.id
  `).all(userId, userId);
  const leagueId = activeLeagueId;
  const date = madridDate();
  const market = db.prepare(`
    SELECT p.*, m.price market_price, m.refresh_at FROM fantasy_markets m
    JOIN fantasy_players p ON p.id=m.player_id
    WHERE m.league_id=? AND m.market_date=?
      AND NOT EXISTS (SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=m.league_id AND lp.player_id=m.player_id)
    ORDER BY p.position, p.name
  `).all(leagueId, date);
  return {
    team: team && { ...team, squad, teamValue: squad.reduce((sum, p) => sum + p.price, 0) },
    players: market,
    market: { date, refreshAt: market[0]?.refresh_at || nextMadridMidnight(), timezone: MARKET_TIMEZONE },
    round: round && { ...round, fixtures: JSON.parse(round.fixture_ids) },
    rankings,
    leagues,
    activeLeagueId,
    usage: {
      playersUpdatedAt: db.prepare("SELECT MAX(updated_at) AS value FROM fantasy_players").get()?.value || null,
      resultsUpdatedAt: db.prepare("SELECT MAX(calculated_at) AS value FROM fantasy_player_stats").get()?.value || null,
    },
  };
}

function refreshMarket(leagueId = 1) {
  const date = madridDate();
  if (db.prepare("SELECT 1 FROM fantasy_markets WHERE league_id=? AND market_date=? LIMIT 1").get(leagueId, date)) return;
  const available = db.prepare(`
    SELECT id, price FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=? AND lp.player_id=p.id)
    ORDER BY RANDOM() LIMIT ?
  `).all(leagueId, MARKET_SIZE);
  const insert = db.prepare("INSERT INTO fantasy_markets VALUES (?, ?, ?, ?, ?)");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM fantasy_markets WHERE league_id=?").run(leagueId);
    const refreshAt = nextMadridMidnight();
    available.forEach((p) => insert.run(leagueId, date, p.id, p.price, refreshAt));
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

let marketTimer;
function scheduleMarkets() {
  clearTimeout(marketTimer);
  marketTimer = setTimeout(() => {
    const leagueIds = [1, ...db.prepare("SELECT id FROM fantasy_leagues").all().map((row) => Number(row.id))];
    [...new Set(leagueIds)].forEach(refreshMarket);
    scheduleMarkets();
  }, Math.max(1000, nextMadridMidnight() - Date.now()));
  marketTimer.unref?.();
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

function randomInitialPlayers(leagueId) {
  const available = db.prepare(`SELECT p.* FROM fantasy_players p WHERE NOT EXISTS (
    SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=? AND lp.player_id=p.id
  )`).all(leagueId);
  const take = (pool, pos, amount) => pool.filter((p) => p.position === pos).slice(0, amount);

  for (let attempt = 0; attempt < 250; attempt += 1) {
    const pool = shuffle(available);
    const selected = [...take(pool, "POR", 1), ...take(pool, "DEF", 4), ...take(pool, "MED", 4), ...take(pool, "DEL", 3)];
    const extra = pool.find((p) => !selected.some((item) => item.id === p.id));
    if (selected.length !== 12 || !extra) continue;
    const squad = [...selected, extra];
    const total = squad.reduce((sum, p) => sum + p.price, 0);
    if (total >= STARTING_TEAM_MIN_VALUE && total <= STARTING_TEAM_MAX_VALUE) return squad;
  }

  const fallback = available.sort((a, b) => a.price - b.price);
  const selected = [...take(fallback, "POR", 1), ...take(fallback, "DEF", 4), ...take(fallback, "MED", 4), ...take(fallback, "DEL", 3)];
  const extra = fallback.find((p) => !selected.some((item) => item.id === p.id));
  const squad = extra ? [...selected, extra] : selected;
  const total = squad.reduce((sum, p) => sum + p.price, 0);
  if (selected.length !== 12 || !extra || total < STARTING_TEAM_MIN_VALUE || total > STARTING_TEAM_MAX_VALUE) {
    throw new Error("No se pudo generar una plantilla inicial entre 100 y 120 millones para esta liga");
  }
  return squad;
}

function createTeam(userId, leagueId, name) {
  const entryId = teamKey(userId, leagueId);
  db.exec("BEGIN IMMEDIATE");
  try {
    let team = getTeam(userId, leagueId);
    if (!team) {
      db.prepare("INSERT INTO fantasy_teams (user_id, owner_user_id, name, budget, league_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(entryId, userId, String(name || "Mi Equipo").trim().slice(0, 40), STARTING_BUDGET, leagueId, Date.now());
      team = getTeam(userId, leagueId);
    }
    const count = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(team.user_id).value;
    if (count) throw new Error("Ya tienes una plantilla Fantasy");
    const selected = randomInitialPlayers(team.league_id);
    const add = db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)");
    const occupy = db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)");
    selected.forEach((p) => { add.run(team.user_id, p.id, p.price); occupy.run(team.league_id, p.id, userId, Date.now()); });
    db.prepare("UPDATE fantasy_teams SET budget=? WHERE user_id=?").run(STARTING_BUDGET, team.user_id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function trade(userId, leagueId, playerId, type) {
  const team = getTeam(userId, leagueId);
  const player = db.prepare("SELECT * FROM fantasy_players WHERE id=?").get(playerId);
  if (!team || !player) throw new Error("Equipo o jugador no encontrado");
  const owned = db.prepare("SELECT * FROM fantasy_team_players WHERE user_id=? AND player_id=?").get(team.user_id, playerId);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (type === "buy") {
      const count = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(team.user_id).value;
      if (owned) throw new Error("Ya tienes este jugador");
      if (count >= 24) throw new Error("La plantilla ya tiene 24 jugadores");
      if (team.budget < player.price) throw new Error("Presupuesto insuficiente");
      if (!db.prepare("SELECT 1 FROM fantasy_markets WHERE league_id=? AND market_date=? AND player_id=?").get(team.league_id, madridDate(), playerId)) throw new Error("El jugador no esta en el mercado de hoy");
      if (db.prepare("SELECT 1 FROM fantasy_league_players WHERE league_id=? AND player_id=?").get(team.league_id, playerId)) throw new Error("Otro usuario ya ha fichado a este jugador");
      db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)").run(team.user_id, playerId, player.price);
      db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)").run(team.league_id, playerId, userId, Date.now());
      db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(player.price, team.user_id);
    } else {
      if (!owned) throw new Error("No tienes este jugador");
      db.prepare("DELETE FROM fantasy_team_players WHERE user_id=? AND player_id=?").run(team.user_id, playerId);
      db.prepare("DELETE FROM fantasy_league_players WHERE league_id=? AND player_id=? AND user_id=?").run(team.league_id, playerId, userId);
      db.prepare("UPDATE fantasy_teams SET budget=budget+? WHERE user_id=?").run(player.price, team.user_id);
    }
    db.prepare("INSERT INTO fantasy_transactions (user_id, player_id, type, price, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, playerId, type, player.price, Date.now());
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function saveLineup(userId, leagueId, formation, starters, captain) {
  const team = getTeam(userId, leagueId);
  if (!FORMATIONS[formation]) throw new Error("Formacion no valida");
  const ids = [...new Set(starters.map(Number))];
  if (ids.length !== 11 || !ids.includes(Number(captain))) throw new Error("Elige once titulares y un capitan");
  const players = db.prepare(`SELECT p.id, p.position FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id WHERE tp.user_id=?`).all(team?.user_id || teamKey(userId, leagueId));
  if (!ids.every((id) => players.some((p) => p.id === id))) throw new Error("Alineacion no valida");
  const expected = [1, ...FORMATIONS[formation]];
  const actual = ["POR", "DEF", "MED", "DEL"].map((pos) => players.filter((p) => ids.includes(p.id) && p.position === pos).length);
  if (actual.some((count, i) => count !== expected[i])) throw new Error(`La ${formation} requiere ${expected.join("-")}`);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE fantasy_team_players SET is_starter=0, is_captain=0 WHERE user_id=?").run(team.user_id);
    const mark = db.prepare("UPDATE fantasy_team_players SET is_starter=1, is_captain=? WHERE user_id=? AND player_id=?");
    ids.forEach((id) => mark.run(id === Number(captain) ? 1 : 0, team.user_id, id));
    db.prepare("UPDATE fantasy_teams SET formation=? WHERE user_id=?").run(formation, team.user_id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

export function fantasyApi(league = "esp.1") {
  let syncing;
  scheduleMarkets();
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/fantasy")) return next();
    const userId = req.headers["x-playfulbet-user"] || "current_user";
    const activeLeagueId = getActiveLeague(userId, Number(req.headers["x-playfulbet-fantasy-league"]) || null);
    try {
      if (req.method === "GET") {
        if (!syncing) syncing = Promise.all([syncPlayers(league), syncFixtures(league)]).finally(() => { syncing = null; });
        const syncError = await syncing.then(() => null, (error) => error);
        const playerCount = db.prepare("SELECT COUNT(*) value FROM fantasy_players").get().value;
        if (!playerCount) return json(res, 503, { error: syncError?.message || "ESPN no ha devuelto jugadores para la liga configurada" });
        refreshMarket(activeLeagueId);
        return json(res, 200, snapshot(userId, activeLeagueId));
      }
      if (req.method !== "POST") return json(res, 405, { error: "Metodo no permitido" });
      const data = await body(req);
      const action = req.url.split("/").pop();
      if (action === "team") createTeam(userId, activeLeagueId, data.name);
      else if (["buy", "sell"].includes(action)) trade(userId, activeLeagueId, Number(data.playerId), action);
      else if (action === "lineup") saveLineup(userId, activeLeagueId, data.formation, data.starters || [], data.captain);
      else if (action === "league") {
        const code = randomBytes(3).toString("hex").toUpperCase();
        const result = db.prepare("INSERT INTO fantasy_leagues (name, code, created_by, created_at) VALUES (?, ?, ?, ?)")
          .run(String(data.name || "Liga privada").trim().slice(0, 40), code, userId, Date.now());
        db.prepare("INSERT INTO fantasy_league_members VALUES (?, ?)").run(result.lastInsertRowid, userId);
      } else if (action === "join") {
        const leagueRow = db.prepare("SELECT id FROM fantasy_leagues WHERE code=?").get(String(data.code || "").trim().toUpperCase());
        if (!leagueRow) throw new Error("Codigo de liga no valido");
        db.prepare("INSERT OR IGNORE INTO fantasy_league_members VALUES (?, ?)").run(leagueRow.id, userId);
      } else return json(res, 404, { error: "Accion no encontrada" });
      const nextLeagueId = action === "league"
        ? Number(db.prepare("SELECT id FROM fantasy_leagues WHERE created_by=? ORDER BY id DESC LIMIT 1").get(userId)?.id || activeLeagueId)
        : action === "join"
          ? Number(db.prepare("SELECT id FROM fantasy_leagues WHERE code=?").get(String(data.code || "").trim().toUpperCase())?.id || activeLeagueId)
          : activeLeagueId;
      refreshMarket(nextLeagueId);
      return json(res, 200, snapshot(userId, nextLeagueId));
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  };
}
