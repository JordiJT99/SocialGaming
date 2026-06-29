import { randomBytes } from "node:crypto";
import { db } from "./database.js";
import { espnFantasyStats, fantasyPoints, nextFantasyPrice } from "./fantasyScoring.js";

const DAY = 86400000;
const WEEK = 7 * DAY;
const LIVE_REFRESH = 30 * 60000;
const CLAUSE_LOCK_WINDOW = 24 * 60 * 60 * 1000;
const STARTING_BUDGET = 100000000;
const STARTING_TEAM_MIN_VALUE = 100000000;
const STARTING_TEAM_MAX_VALUE = 120000000;
const MARKET_SIZE = 30;
const MARKET_TIMEZONE = "Europe/Madrid";
const DEFAULT_LEAGUE_SETTINGS = {
  initial_budget: 100000000,
  initial_players: 12,
  market_refresh_hour: 0,
  max_squad_players: 24,
  clause_max_multiplier: 4,
  clause_block_hours: 24,
  allow_live_changes: 0,
  points_cash_reward: 0,
  exclusive_market: 1,
};
const SLOT_TO_POSITION = { POR: "POR", DEF: "DEF", MED: "MED", DEL: "DEL" };
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

const madridParts = (value = new Date()) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: MARKET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
}).formatToParts(value).map((part) => [part.type, part.value]));

function madridDateAtHour(hour = 0) {
  const now = madridParts();
  return `${now.year}-${now.month}-${now.day}|${String(hour).padStart(2, "0")}`;
}

function marketCycleKey(hour = 0, now = new Date()) {
  const parts = madridParts(now);
  const cycleDate = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) < hour ? Number(parts.day) - 1 : Number(parts.day),
  ));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(cycleDate);
}

function nextMadridRefresh(hour = 0) {
  const parts = madridParts();
  const todayTarget = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(hour), 0, 0);
  const naive = Number(parts.hour) < hour ? todayTarget : Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, Number(hour), 0, 0);
  const shown = madridParts(new Date(naive));
  const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
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
  const roundId = currentRoundId();
  db.exec(`
    UPDATE fantasy_teams SET
      total_points = CASE
        WHEN EXISTS (SELECT 1 FROM fantasy_matchday_snapshots s WHERE s.team_user_id=fantasy_teams.user_id) THEN COALESCE((
          SELECT SUM(s.points_awarded)
          FROM fantasy_matchday_snapshots s
          WHERE s.team_user_id=fantasy_teams.user_id
        ), 0)
        ELSE COALESCE((SELECT SUM(p.total_points * CASE WHEN tp.is_captain=1 THEN 2 ELSE 1 END)
          FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id
          WHERE tp.user_id=fantasy_teams.user_id AND tp.is_starter=1), 0)
      END,
      round_points = CASE
        WHEN EXISTS (SELECT 1 FROM fantasy_matchday_snapshots s WHERE s.round_id='${roundId}' AND s.team_user_id=fantasy_teams.user_id AND s.can_score=0) THEN 0
        WHEN EXISTS (SELECT 1 FROM fantasy_matchday_snapshots s WHERE s.round_id='${roundId}' AND s.team_user_id=fantasy_teams.user_id) THEN COALESCE((
          SELECT SUM(p.last_round_points * CASE WHEN p.id = s.captain_player_id THEN 2 ELSE 1 END)
          FROM fantasy_matchday_snapshots s, json_each(s.lineup_player_ids) item
          JOIN fantasy_players p ON p.id = item.value
          WHERE s.round_id='${roundId}' AND s.team_user_id=fantasy_teams.user_id
        ), 0)
        ELSE COALESCE((SELECT SUM(p.last_round_points * CASE WHEN tp.is_captain=1 THEN 2 ELSE 1 END)
          FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id
          WHERE tp.user_id=fantasy_teams.user_id AND tp.is_starter=1), 0)
      END
  `);
  db.prepare(`
    UPDATE fantasy_matchday_snapshots
    SET points_awarded = CASE
      WHEN can_score = 0 THEN 0
      ELSE COALESCE((
        SELECT SUM(p.last_round_points * CASE WHEN p.id = fantasy_matchday_snapshots.captain_player_id THEN 2 ELSE 1 END)
        FROM json_each(fantasy_matchday_snapshots.lineup_player_ids) item
        JOIN fantasy_players p ON p.id = item.value
      ), 0)
    END
    WHERE round_id = ?
  `).run(roundId);
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
  ensureRoundSnapshots();
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
  settleRoundRewards(fixtures);
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

function currentRoundStartsAt() {
  return db.prepare("SELECT starts_at FROM fantasy_rounds WHERE id='current'").get()?.starts_at || null;
}

function currentRoundId() {
  const startsAt = currentRoundStartsAt();
  return startsAt ? `round:${startsAt}` : "round:current";
}

function clauseBlockedByRound() {
  const startsAt = currentRoundStartsAt();
  return startsAt ? Date.now() >= startsAt - CLAUSE_LOCK_WINDOW : false;
}

function getLeagueSettings(leagueId) {
  const row = db.prepare("SELECT * FROM fantasy_league_settings WHERE league_id=?").get(leagueId);
  if (row) return { ...DEFAULT_LEAGUE_SETTINGS, ...row };
  db.prepare(`
    INSERT OR IGNORE INTO fantasy_league_settings (
      league_id, initial_budget, initial_players, market_refresh_hour, max_squad_players,
      clause_max_multiplier, clause_block_hours, allow_live_changes, points_cash_reward,
      exclusive_market, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leagueId,
    DEFAULT_LEAGUE_SETTINGS.initial_budget,
    DEFAULT_LEAGUE_SETTINGS.initial_players,
    DEFAULT_LEAGUE_SETTINGS.market_refresh_hour,
    DEFAULT_LEAGUE_SETTINGS.max_squad_players,
    DEFAULT_LEAGUE_SETTINGS.clause_max_multiplier,
    DEFAULT_LEAGUE_SETTINGS.clause_block_hours,
    DEFAULT_LEAGUE_SETTINGS.allow_live_changes,
    DEFAULT_LEAGUE_SETTINGS.points_cash_reward,
    DEFAULT_LEAGUE_SETTINGS.exclusive_market,
    Date.now(),
  );
  return { ...DEFAULT_LEAGUE_SETTINGS, league_id: leagueId };
}

function saveLeagueSettings(leagueId, input = {}) {
  const current = getLeagueSettings(leagueId);
  const next = {
    initial_budget: Math.max(1000000, Number(input.initial_budget ?? current.initial_budget)),
    initial_players: Math.min(24, Math.max(11, Number(input.initial_players ?? current.initial_players))),
    market_refresh_hour: Math.min(23, Math.max(0, Number(input.market_refresh_hour ?? current.market_refresh_hour))),
    max_squad_players: Math.min(30, Math.max(11, Number(input.max_squad_players ?? current.max_squad_players))),
    clause_max_multiplier: Math.min(8, Math.max(1, Number(input.clause_max_multiplier ?? current.clause_max_multiplier))),
    clause_block_hours: Math.min(168, Math.max(0, Number(input.clause_block_hours ?? current.clause_block_hours))),
    allow_live_changes: 0,
    points_cash_reward: 0,
    exclusive_market: (input.exclusive_market ?? current.exclusive_market) ? 1 : 0,
  };
  db.prepare(`
    INSERT INTO fantasy_league_settings (
      league_id, initial_budget, initial_players, market_refresh_hour, max_squad_players,
      clause_max_multiplier, clause_block_hours, allow_live_changes, points_cash_reward,
      exclusive_market, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(league_id) DO UPDATE SET
      initial_budget=excluded.initial_budget,
      initial_players=excluded.initial_players,
      market_refresh_hour=excluded.market_refresh_hour,
      max_squad_players=excluded.max_squad_players,
      clause_max_multiplier=excluded.clause_max_multiplier,
      clause_block_hours=excluded.clause_block_hours,
      allow_live_changes=excluded.allow_live_changes,
      points_cash_reward=excluded.points_cash_reward,
      exclusive_market=excluded.exclusive_market,
      updated_at=excluded.updated_at
  `).run(
    leagueId,
    next.initial_budget,
    next.initial_players,
    next.market_refresh_hour,
    next.max_squad_players,
    next.clause_max_multiplier,
    next.clause_block_hours,
    next.allow_live_changes,
    next.points_cash_reward,
    next.exclusive_market,
    Date.now(),
  );
  return { ...current, ...next, league_id: leagueId };
}

function logOwnership(leagueId, playerId, fromUserId, toUserId, operation, price, clauseAmount = null) {
  db.prepare(`
    INSERT INTO fantasy_player_ownership_history (
      league_id, player_id, from_user_id, to_user_id, operation, price, clause_amount, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(leagueId, playerId, fromUserId, toUserId, operation, price, clauseAmount, Date.now());
}

function upsertClause(leagueId, playerId, ownerUserId, amount) {
  db.prepare(`
    INSERT INTO fantasy_player_clauses (
      league_id, player_id, owner_user_id, amount, base_amount, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(league_id, player_id) DO UPDATE SET
      owner_user_id=excluded.owner_user_id,
      amount=excluded.amount,
      base_amount=excluded.base_amount,
      updated_at=excluded.updated_at
  `).run(leagueId, playerId, ownerUserId, amount, amount, Date.now());
}

function notifyUser(leagueId, userId, type, payload) {
  db.prepare(`
    INSERT INTO fantasy_notifications (league_id, user_id, type, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(leagueId, userId, type, JSON.stringify(payload), Date.now());
}

function ensureRoundSnapshots() {
  const startsAt = currentRoundStartsAt();
  if (!startsAt || Date.now() < startsAt) return;
  const roundId = currentRoundId();
  const existing = db.prepare("SELECT 1 FROM fantasy_matchday_snapshots WHERE round_id=? LIMIT 1").get(roundId);
  if (existing) return;
  const teams = db.prepare("SELECT * FROM fantasy_teams").all();
  const starters = db.prepare("SELECT player_id, is_captain FROM fantasy_team_players WHERE user_id=? AND is_starter=1 ORDER BY player_id");
  const insert = db.prepare(`
    INSERT INTO fantasy_matchday_snapshots (
      round_id, league_id, team_user_id, owner_user_id, formation, lineup_player_ids, captain_player_id,
      lineup_layout, budget_at_start, can_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const team of teams) {
    const eleven = starters.all(team.user_id);
    insert.run(
      roundId,
      team.league_id,
      team.user_id,
      team.owner_user_id,
      team.formation,
      JSON.stringify(eleven.map((item) => item.player_id)),
      eleven.find((item) => item.is_captain)?.player_id || null,
      team.lineup_layout || "[]",
      team.budget,
      team.budget >= 0 ? 1 : 0,
      Date.now(),
    );
  }
}

function settleRoundRewards(fixtures) {
  return fixtures;
}

function transferOwnedPlayer(leagueId, playerId, fromTeamKey, fromUserId, toTeamKey, toUserId, price, operation) {
  db.prepare("DELETE FROM fantasy_team_players WHERE user_id=? AND player_id=?").run(fromTeamKey, playerId);
  db.prepare("UPDATE fantasy_team_players SET purchase_price=? WHERE user_id=? AND player_id=?").run(price, toTeamKey, playerId);
  if (!db.prepare("SELECT 1 FROM fantasy_team_players WHERE user_id=? AND player_id=?").get(toTeamKey, playerId)) {
    db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)").run(toTeamKey, playerId, price);
  }
  db.prepare("DELETE FROM fantasy_league_players WHERE league_id=? AND player_id=?").run(leagueId, playerId);
  db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)").run(leagueId, playerId, toUserId, Date.now());
  upsertClause(leagueId, playerId, toUserId, price);
  logOwnership(leagueId, playerId, fromUserId, toUserId, operation, price, price);
}

function resolveMarketBids(leagueId, settings) {
  const openPlayers = db.prepare("SELECT player_id, price FROM fantasy_markets WHERE league_id=?").all(leagueId);
  if (!openPlayers.length) return;
  const teamCount = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?");
  const updateBid = db.prepare("UPDATE fantasy_bids SET status=?, resolved_at=? WHERE id=?");
  const currentBudget = db.prepare("SELECT budget FROM fantasy_teams WHERE user_id=?");
  for (const marketPlayer of openPlayers) {
    const bids = db.prepare(`
      SELECT * FROM fantasy_bids
      WHERE league_id=? AND player_id=? AND status='open'
      ORDER BY amount DESC, created_at ASC
    `).all(leagueId, marketPlayer.player_id);
    if (!bids.length) continue;
    let winner = null;
    for (const bid of bids) {
      const team = getTeam(bid.user_id, leagueId);
      if (!team) continue;
      if (teamCount(team.user_id).value >= settings.max_squad_players) continue;
      if ((currentBudget.get(team.user_id)?.budget || 0) < bid.amount) continue;
      winner = { bid, team };
      break;
    }
    if (!winner) {
      bids.forEach((bid) => updateBid.run("rejected", Date.now(), bid.id));
      continue;
    }
    db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)")
      .run(winner.team.user_id, marketPlayer.player_id, winner.bid.amount);
    db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)")
      .run(leagueId, marketPlayer.player_id, winner.bid.user_id, Date.now());
    db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(winner.bid.amount, winner.team.user_id);
    upsertClause(leagueId, marketPlayer.player_id, winner.bid.user_id, winner.bid.amount);
    logOwnership(leagueId, marketPlayer.player_id, null, winner.bid.user_id, "bid_win", winner.bid.amount, winner.bid.amount);
    bids.forEach((bid) => updateBid.run(bid.id === winner.bid.id ? "won" : "lost", Date.now(), bid.id));
  }
}

function slotCount(formation) {
  const shape = FORMATIONS[formation] || FORMATIONS["4-3-3"];
  return 1 + shape[0] + shape[1] + shape[2];
}

function normalizeLayout(layout, formation, validIds = []) {
  const size = slotCount(formation);
  const set = new Set(validIds.map(Number));
  const seen = new Set();
  const normalized = Array.from({ length: size }, (_, index) => {
    const id = Number(layout?.[index]);
    if (!id || (set.size && !set.has(id)) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  return normalized;
}

function layoutMatchesPositions(layout, formation, players = []) {
  const playerMap = new Map(players.map((player) => [Number(player.id), player.position]));
  const slots = buildSlotSpec(formation);
  return layout.every((playerId, index) => {
    if (!playerId) return true;
    return playerMap.get(Number(playerId)) === SLOT_TO_POSITION[slots[index]?.row];
  });
}

function buildSlotSpec(formation) {
  const shape = FORMATIONS[formation] || FORMATIONS["4-3-3"];
  return [
    { row: "DEL", label: "DEL" }, { row: "DEL", label: "DEL" }, { row: "DEL", label: "DEL" },
    { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" }, { row: "MED", label: "MED" },
    { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" }, { row: "DEF", label: "DEF" },
    { row: "POR", label: "POR" },
  ].filter((slot, index) => {
    if (slot.row === "DEL") return index < shape[2];
    if (slot.row === "MED") return index >= 3 && index < 3 + shape[1];
    if (slot.row === "DEF") return index >= 8 && index < 8 + shape[0];
    return true;
  });
}

function snapshot(userId, activeLeagueId) {
  const settings = getLeagueSettings(activeLeagueId);
  const team = getTeam(userId, activeLeagueId);
  const entryId = team?.user_id || teamKey(userId, activeLeagueId);
  const squad = team ? db.prepare(`
    SELECT p.*, tp.purchase_price, tp.is_starter, tp.is_captain, c.amount clause_amount, c.base_amount clause_base_amount,
      c.paid_extra clause_paid_extra, c.lock_until clause_lock_until
    FROM fantasy_team_players tp
    LEFT JOIN fantasy_player_clauses c ON c.league_id=? AND c.player_id=tp.player_id
    JOIN fantasy_players p ON p.id=tp.player_id
    WHERE tp.user_id=? ORDER BY tp.is_starter DESC, p.position, p.name
  `).all(activeLeagueId, entryId) : [];
  const round = db.prepare("SELECT * FROM fantasy_rounds WHERE id='current'").get() || null;
  const rankings = db.prepare(`
    SELECT t.name, t.total_points, t.round_points, t.budget,
      COALESCE((SELECT SUM(p.price) FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id WHERE tp.user_id=t.user_id), 0) team_value
    FROM fantasy_teams t
    WHERE t.league_id=?
    ORDER BY t.total_points DESC, team_value DESC
    LIMIT 100
  `).all(activeLeagueId);
  const leagues = db.prepare(`
    SELECT l.*, COUNT(m.user_id) members FROM fantasy_leagues l LEFT JOIN fantasy_league_members m ON m.league_id=l.id
    WHERE l.id IN (SELECT league_id FROM fantasy_league_members WHERE user_id=?) OR l.id IN (SELECT league_id FROM fantasy_teams WHERE owner_user_id=?)
    GROUP BY l.id
  `).all(userId, userId);
  const activeLeague = db.prepare(`
    SELECT l.*, s.*, COUNT(m.user_id) members
    FROM fantasy_leagues l
    JOIN fantasy_league_settings s ON s.league_id=l.id
    LEFT JOIN fantasy_league_members m ON m.league_id=l.id
    WHERE l.id=?
    GROUP BY l.id
  `).get(activeLeagueId);
  const leagueMembers = db.prepare(`
    SELECT m.user_id, COALESCE(t.name, m.user_id) team_name, t.total_points, t.budget
    FROM fantasy_league_members m
    LEFT JOIN fantasy_teams t ON t.owner_user_id=m.user_id AND t.league_id=m.league_id
    WHERE m.league_id=?
    ORDER BY team_name
  `).all(activeLeagueId);
  const leagueId = activeLeagueId;
  const cycleDate = marketCycleKey(settings.market_refresh_hour);
  const market = db.prepare(`
    SELECT p.*, m.price market_price, m.refresh_at FROM fantasy_markets m
    JOIN fantasy_players p ON p.id=m.player_id
    WHERE m.league_id=? AND m.market_date=?
      AND NOT EXISTS (SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=m.league_id AND lp.player_id=m.player_id)
    ORDER BY p.position, p.name
  `).all(leagueId, cycleDate);
  const history = db.prepare(`
    SELECT h.*, p.name player_name, p.position, p.team_name
    FROM fantasy_player_ownership_history h
    JOIN fantasy_players p ON p.id=h.player_id
    WHERE h.league_id=?
    ORDER BY h.created_at DESC
    LIMIT 20
  `).all(activeLeagueId);
  const bids = db.prepare(`
    SELECT b.*, p.name player_name, p.position, p.team_name
    FROM fantasy_bids b
    JOIN fantasy_players p ON p.id=b.player_id
    WHERE b.league_id=? AND b.user_id=? AND b.status='open'
    ORDER BY b.created_at DESC
  `).all(activeLeagueId, userId);
  const incomingOffers = db.prepare(`
    SELECT o.*, p.name player_name, p.position, p.team_name, t.name from_team
    FROM fantasy_offers o
    JOIN fantasy_players p ON p.id=o.player_id
    JOIN fantasy_teams t ON t.owner_user_id=o.from_user_id AND t.league_id=o.league_id
    WHERE o.league_id=? AND o.to_user_id=? AND o.status='open'
    ORDER BY o.created_at DESC
  `).all(activeLeagueId, userId);
  const outgoingOffers = db.prepare(`
    SELECT o.*, p.name player_name, p.position, p.team_name, t.name to_team
    FROM fantasy_offers o
    JOIN fantasy_players p ON p.id=o.player_id
    JOIN fantasy_teams t ON t.owner_user_id=o.to_user_id AND t.league_id=o.league_id
    WHERE o.league_id=? AND o.from_user_id=? AND o.status='open'
    ORDER BY o.created_at DESC
  `).all(activeLeagueId, userId);
  const notifications = db.prepare(`
    SELECT * FROM fantasy_notifications
    WHERE league_id=? AND user_id=?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(activeLeagueId, userId).map((item) => ({ ...item, payload: JSON.parse(item.payload || "{}") }));
  const rivalPlayers = db.prepare(`
    SELECT p.id, p.name, p.position, p.team_name, p.photo, c.amount clause_amount, t.name owner_name
    FROM fantasy_player_clauses c
    JOIN fantasy_players p ON p.id=c.player_id
    JOIN fantasy_teams t ON t.owner_user_id=c.owner_user_id AND t.league_id=c.league_id
    WHERE c.league_id=? AND c.owner_user_id<>?
    ORDER BY c.amount ASC, p.name ASC
    LIMIT 40
  `).all(activeLeagueId, userId);
  const currentSnapshot = team && db.prepare(`
    SELECT can_score, budget_at_start, points_awarded
    FROM fantasy_matchday_snapshots
    WHERE round_id=? AND league_id=? AND team_user_id=?
  `).get(currentRoundId(), activeLeagueId, team.user_id);
  return {
    team: team && {
      ...team,
      squad,
      lineup_layout: normalizeLayout(JSON.parse(team.lineup_layout || "[]"), team.formation, squad.map((player) => player.id)),
      teamValue: squad.reduce((sum, p) => sum + p.price, 0),
      currentSnapshot,
    },
    players: market,
    market: { date: cycleDate, refreshAt: market[0]?.refresh_at || nextMadridRefresh(settings.market_refresh_hour), timezone: MARKET_TIMEZONE, hour: settings.market_refresh_hour },
    round: round && { ...round, fixtures: JSON.parse(round.fixture_ids) },
    rankings,
    leagues,
    activeLeague: activeLeague && { ...activeLeague, isAdmin: activeLeague.created_by === userId, membersList: leagueMembers },
    history,
    bids,
    incomingOffers,
    outgoingOffers,
    notifications,
    rivalPlayers,
    activeLeagueId,
    settings,
    usage: {
      playersUpdatedAt: db.prepare("SELECT MAX(updated_at) AS value FROM fantasy_players").get()?.value || null,
      resultsUpdatedAt: db.prepare("SELECT MAX(calculated_at) AS value FROM fantasy_player_stats").get()?.value || null,
    },
  };
}

function refreshMarket(leagueId = 1) {
  const settings = getLeagueSettings(leagueId);
  const date = marketCycleKey(settings.market_refresh_hour);
  if (db.prepare("SELECT 1 FROM fantasy_markets WHERE league_id=? AND market_date=? LIMIT 1").get(leagueId, date)) return;
  const available = db.prepare(`
    SELECT id, price FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=? AND lp.player_id=p.id)
    ORDER BY RANDOM() LIMIT ?
  `).all(leagueId, MARKET_SIZE);
  const insert = db.prepare("INSERT INTO fantasy_markets VALUES (?, ?, ?, ?, ?)");
  db.exec("BEGIN IMMEDIATE");
  try {
    resolveMarketBids(leagueId, settings);
    db.prepare("DELETE FROM fantasy_markets WHERE league_id=?").run(leagueId);
    const refreshAt = nextMadridRefresh(settings.market_refresh_hour);
    available.forEach((p) => insert.run(leagueId, date, p.id, p.price, refreshAt));
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

let marketTimer;
function scheduleMarkets() {
  clearTimeout(marketTimer);
  const leagueRows = [{ id: 1 }, ...db.prepare("SELECT id FROM fantasy_leagues").all()];
  const nextAt = Math.min(...leagueRows.map((row) => nextMadridRefresh(getLeagueSettings(Number(row.id)).market_refresh_hour)));
  marketTimer = setTimeout(() => {
    const leagueIds = [1, ...db.prepare("SELECT id FROM fantasy_leagues").all().map((row) => Number(row.id))];
    [...new Set(leagueIds)].forEach(refreshMarket);
    scheduleMarkets();
  }, Math.max(1000, nextAt - Date.now()));
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

function initialDistribution(totalPlayers) {
  if (totalPlayers <= 12) return { POR: 1, DEF: 4, MED: 4, DEL: 3 };
  if (totalPlayers === 13) return { POR: 2, DEF: 4, MED: 4, DEL: 3 };
  if (totalPlayers === 14) return { POR: 2, DEF: 4, MED: 5, DEL: 3 };
  if (totalPlayers >= 15) return { POR: 2, DEF: 5, MED: 5, DEL: Math.max(3, totalPlayers - 12) };
  return { POR: 1, DEF: 4, MED: 4, DEL: 3 };
}

function randomInitialPlayers(leagueId, settings) {
  const available = db.prepare(`SELECT p.* FROM fantasy_players p WHERE NOT EXISTS (
    SELECT 1 FROM fantasy_league_players lp WHERE lp.league_id=? AND lp.player_id=p.id
  )`).all(leagueId);
  const distribution = initialDistribution(settings.initial_players);
  const take = (pool, pos, amount) => pool.filter((p) => p.position === pos).slice(0, amount);

  for (let attempt = 0; attempt < 250; attempt += 1) {
    const pool = shuffle(available);
    const squad = [
      ...take(pool, "POR", distribution.POR),
      ...take(pool, "DEF", distribution.DEF),
      ...take(pool, "MED", distribution.MED),
      ...take(pool, "DEL", distribution.DEL),
    ];
    if (squad.length !== settings.initial_players) continue;
    const total = squad.reduce((sum, p) => sum + p.price, 0);
    if (total >= STARTING_TEAM_MIN_VALUE && total <= STARTING_TEAM_MAX_VALUE) return squad;
  }

  const fallback = available.sort((a, b) => a.price - b.price);
  const squad = [
    ...take(fallback, "POR", distribution.POR),
    ...take(fallback, "DEF", distribution.DEF),
    ...take(fallback, "MED", distribution.MED),
    ...take(fallback, "DEL", distribution.DEL),
  ];
  const total = squad.reduce((sum, p) => sum + p.price, 0);
  if (squad.length !== settings.initial_players || total < STARTING_TEAM_MIN_VALUE || total > STARTING_TEAM_MAX_VALUE) {
    throw new Error("No se pudo generar una plantilla inicial entre 100 y 120 millones para esta liga");
  }
  return squad;
}

function createTeam(userId, leagueId, name) {
  const entryId = teamKey(userId, leagueId);
  const settings = getLeagueSettings(leagueId);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT OR IGNORE INTO fantasy_league_members VALUES (?, ?)").run(leagueId, userId);
    let team = getTeam(userId, leagueId);
    if (!team) {
      db.prepare("INSERT INTO fantasy_teams (user_id, owner_user_id, name, budget, league_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(entryId, userId, String(name || "Mi Equipo").trim().slice(0, 40), settings.initial_budget, leagueId, Date.now());
      team = getTeam(userId, leagueId);
    }
    const count = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(team.user_id).value;
    if (count) throw new Error("Ya tienes una plantilla Fantasy");
    const selected = randomInitialPlayers(team.league_id, settings);
    const add = db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)");
    const occupy = db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)");
    selected.forEach((p) => {
      add.run(team.user_id, p.id, p.price);
      occupy.run(team.league_id, p.id, userId, Date.now());
      upsertClause(team.league_id, p.id, userId, p.price);
      logOwnership(team.league_id, p.id, null, userId, "initial_assign", p.price, p.price);
    });
    db.prepare("UPDATE fantasy_teams SET budget=?, lineup_layout=? WHERE user_id=?")
      .run(settings.initial_budget, JSON.stringify(selected.slice(0, 11).map((player) => player.id)), team.user_id);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function trade(userId, leagueId, playerId, type) {
  const team = getTeam(userId, leagueId);
  const settings = getLeagueSettings(leagueId);
  const player = db.prepare("SELECT * FROM fantasy_players WHERE id=?").get(playerId);
  if (!team || !player) throw new Error("Equipo o jugador no encontrado");
  const owned = db.prepare("SELECT * FROM fantasy_team_players WHERE user_id=? AND player_id=?").get(team.user_id, playerId);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (type === "buy") {
      const count = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(team.user_id).value;
      if (owned) throw new Error("Ya tienes este jugador");
      if (count >= settings.max_squad_players) throw new Error(`La plantilla ya tiene ${settings.max_squad_players} jugadores`);
      if (team.budget < player.price) throw new Error("Presupuesto insuficiente");
      if (!db.prepare("SELECT 1 FROM fantasy_markets WHERE league_id=? AND market_date=? AND player_id=?").get(team.league_id, marketCycleKey(settings.market_refresh_hour), playerId)) throw new Error("El jugador no esta en el mercado actual");
      if (settings.exclusive_market && db.prepare("SELECT 1 FROM fantasy_league_players WHERE league_id=? AND player_id=?").get(team.league_id, playerId)) throw new Error("Otro usuario ya ha fichado a este jugador");
      db.prepare("INSERT INTO fantasy_team_players (user_id, player_id, purchase_price) VALUES (?, ?, ?)").run(team.user_id, playerId, player.price);
      db.prepare("INSERT INTO fantasy_league_players VALUES (?, ?, ?, ?)").run(team.league_id, playerId, userId, Date.now());
      db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(player.price, team.user_id);
      upsertClause(team.league_id, playerId, userId, Math.max(player.price, player.price));
      logOwnership(team.league_id, playerId, null, userId, "buy_market", player.price, player.price);
    } else {
      if (!owned) throw new Error("No tienes este jugador");
      db.prepare("DELETE FROM fantasy_team_players WHERE user_id=? AND player_id=?").run(team.user_id, playerId);
      db.prepare("DELETE FROM fantasy_league_players WHERE league_id=? AND player_id=? AND user_id=?").run(team.league_id, playerId, userId);
      db.prepare("UPDATE fantasy_teams SET budget=budget+? WHERE user_id=?").run(player.price, team.user_id);
      db.prepare("DELETE FROM fantasy_player_clauses WHERE league_id=? AND player_id=?").run(team.league_id, playerId);
      logOwnership(team.league_id, playerId, userId, null, "sell_market", player.price, null);
    }
    db.prepare("INSERT INTO fantasy_transactions (user_id, player_id, type, price, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, playerId, type, player.price, Date.now());
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function placeBid(userId, leagueId, playerId, amount) {
  const team = getTeam(userId, leagueId);
  const settings = getLeagueSettings(leagueId);
  const bidAmount = Math.max(0, Number(amount));
  if (!team) throw new Error("Primero crea tu equipo");
  if (bidAmount <= 0) throw new Error("La puja no es valida");
  if (team.budget < bidAmount) throw new Error("No tienes saldo para esa puja");
  if (!db.prepare("SELECT 1 FROM fantasy_markets WHERE league_id=? AND market_date=? AND player_id=?").get(leagueId, marketCycleKey(settings.market_refresh_hour), playerId)) {
    throw new Error("El jugador ya no esta en el mercado actual");
  }
  db.prepare(`
    INSERT INTO fantasy_bids (league_id, user_id, player_id, amount, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(leagueId, userId, playerId, bidAmount, Date.now());
}

function createOffer(userId, leagueId, playerId, amount) {
  const buyer = getTeam(userId, leagueId);
  const bidAmount = Math.max(0, Number(amount));
  const ownership = db.prepare("SELECT * FROM fantasy_league_players WHERE league_id=? AND player_id=?").get(leagueId, playerId);
  if (!buyer) throw new Error("Primero crea tu equipo");
  if (!ownership || ownership.user_id === userId) throw new Error("Ese jugador no admite oferta");
  if (buyer.budget < bidAmount) throw new Error("No tienes saldo para esa oferta");
  db.prepare(`
    INSERT INTO fantasy_offers (league_id, player_id, from_user_id, to_user_id, amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(leagueId, playerId, userId, ownership.user_id, bidAmount, Date.now());
  notifyUser(leagueId, ownership.user_id, "offer_received", { playerId, amount: bidAmount, fromUserId: userId });
}

function respondOffer(userId, leagueId, offerId, accept) {
  const offer = db.prepare("SELECT * FROM fantasy_offers WHERE id=? AND league_id=?").get(offerId, leagueId);
  if (!offer || offer.to_user_id !== userId || offer.status !== "open") throw new Error("Oferta no disponible");
  const seller = getTeam(userId, leagueId);
  const buyer = getTeam(offer.from_user_id, leagueId);
  const settings = getLeagueSettings(leagueId);
  if (!seller || !buyer) throw new Error("Equipos no encontrados");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!accept) {
      db.prepare("UPDATE fantasy_offers SET status='rejected', responded_at=? WHERE id=?").run(Date.now(), offerId);
      notifyUser(leagueId, offer.from_user_id, "offer_rejected", { playerId: offer.player_id, amount: offer.amount });
      db.exec("COMMIT");
      return;
    }
    const buyerCount = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(buyer.user_id).value;
    const ownsPlayer = db.prepare("SELECT 1 FROM fantasy_team_players WHERE user_id=? AND player_id=?").get(seller.user_id, offer.player_id);
    if (!ownsPlayer) throw new Error("El jugador ya no pertenece al vendedor");
    if (buyer.budget < offer.amount) throw new Error("El comprador ya no tiene saldo");
    if (buyerCount >= settings.max_squad_players) throw new Error(`La plantilla compradora ya tiene ${settings.max_squad_players} jugadores`);
    db.prepare("UPDATE fantasy_teams SET budget=budget+? WHERE user_id=?").run(offer.amount, seller.user_id);
    db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(offer.amount, buyer.user_id);
    transferOwnedPlayer(leagueId, offer.player_id, seller.user_id, userId, buyer.user_id, offer.from_user_id, offer.amount, "offer_accept");
    db.prepare("UPDATE fantasy_offers SET status='accepted', responded_at=? WHERE id=?").run(Date.now(), offerId);
    db.prepare("UPDATE fantasy_offers SET status='expired', responded_at=? WHERE league_id=? AND player_id=? AND status='open' AND id<>?")
      .run(Date.now(), leagueId, offer.player_id, offerId);
    notifyUser(leagueId, offer.from_user_id, "offer_accepted", { playerId: offer.player_id, amount: offer.amount });
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function updateClause(userId, leagueId, playerId, targetAmount) {
  const team = getTeam(userId, leagueId);
  const settings = getLeagueSettings(leagueId);
  const clause = db.prepare("SELECT * FROM fantasy_player_clauses WHERE league_id=? AND player_id=?").get(leagueId, playerId);
  if (!team || !clause || clause.owner_user_id !== userId) throw new Error("No puedes editar esa clausula");
  const nextAmount = Math.max(clause.base_amount, Number(targetAmount));
  const maxAmount = Math.round(clause.base_amount * settings.clause_max_multiplier);
  if (nextAmount > maxAmount) throw new Error("Supera el maximo permitido en esta liga");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (nextAmount > clause.amount) {
      if (clause.lock_until && clause.lock_until > Date.now()) throw new Error("Esta clausula esta bloqueada temporalmente");
      const extra = nextAmount - clause.amount;
      if (team.budget < extra) throw new Error("No tienes saldo para subir la clausula");
      db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(extra, team.user_id);
      db.prepare(`
        UPDATE fantasy_player_clauses
        SET amount=?, paid_extra=paid_extra+?, updated_at=?, lock_until=NULL, lowered_at=NULL
        WHERE league_id=? AND player_id=?
      `).run(nextAmount, extra, Date.now(), leagueId, playerId);
    } else if (nextAmount < clause.amount) {
      const refund = clause.amount - nextAmount;
      db.prepare("UPDATE fantasy_teams SET budget=budget+? WHERE user_id=?").run(refund, team.user_id);
      db.prepare(`
        UPDATE fantasy_player_clauses
        SET amount=?, paid_extra=MAX(0, paid_extra-?), updated_at=?, lowered_at=?, lock_until=?
        WHERE league_id=? AND player_id=?
      `).run(nextAmount, refund, Date.now(), Date.now(), Date.now() + settings.clause_block_hours * 60 * 60 * 1000, leagueId, playerId);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function executeClause(userId, leagueId, playerId) {
  if (clauseBlockedByRound()) throw new Error("No se permiten clausulazos 24h antes de la jornada");
  const buyer = getTeam(userId, leagueId);
  const settings = getLeagueSettings(leagueId);
  const clause = db.prepare("SELECT * FROM fantasy_player_clauses WHERE league_id=? AND player_id=?").get(leagueId, playerId);
  const owner = clause && getTeam(clause.owner_user_id, leagueId);
  if (!buyer || !clause || !owner) throw new Error("No se puede ejecutar esta clausula");
  if (clause.owner_user_id === userId) throw new Error("Ese jugador ya es tuyo");
  const buyerCount = db.prepare("SELECT COUNT(*) value FROM fantasy_team_players WHERE user_id=?").get(buyer.user_id).value;
  if (buyerCount >= settings.max_squad_players) throw new Error(`La plantilla ya tiene ${settings.max_squad_players} jugadores`);
  if (buyer.budget < clause.amount) throw new Error("No tienes saldo suficiente");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE fantasy_teams SET budget=budget-? WHERE user_id=?").run(clause.amount, buyer.user_id);
    db.prepare("UPDATE fantasy_teams SET budget=budget+? WHERE user_id=?").run(clause.amount, owner.user_id);
    transferOwnedPlayer(leagueId, playerId, owner.user_id, clause.owner_user_id, buyer.user_id, userId, clause.amount, "clause_buyout");
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function saveLineup(userId, leagueId, formation, starters, captain, layout = []) {
  const team = getTeam(userId, leagueId);
  const lockedRound = db.prepare("SELECT 1 FROM fantasy_matchday_snapshots WHERE round_id=? AND league_id=? AND team_user_id=? LIMIT 1")
    .get(currentRoundId(), leagueId, team?.user_id || teamKey(userId, leagueId));
  if (!FORMATIONS[formation]) throw new Error("Formacion no valida");
  if (lockedRound) throw new Error("La jornada ya ha empezado en esta liga");
  const ids = [...new Set(starters.map(Number))];
  if (ids.length !== 11 || !ids.includes(Number(captain))) throw new Error("Elige once titulares y un capitan");
  const players = db.prepare(`SELECT p.id, p.position FROM fantasy_team_players tp JOIN fantasy_players p ON p.id=tp.player_id WHERE tp.user_id=?`).all(team?.user_id || teamKey(userId, leagueId));
  if (!ids.every((id) => players.some((p) => p.id === id))) throw new Error("Alineacion no valida");
  const normalizedLayout = normalizeLayout(layout, formation, ids);
  if (normalizedLayout.filter(Boolean).length !== 11) throw new Error("Arrastra exactamente 11 jugadores al campo");
  if (!layoutMatchesPositions(normalizedLayout, formation, players)) throw new Error("Cada jugador solo puede jugar en su posicion");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE fantasy_team_players SET is_starter=0, is_captain=0 WHERE user_id=?").run(team.user_id);
    const mark = db.prepare("UPDATE fantasy_team_players SET is_starter=1, is_captain=? WHERE user_id=? AND player_id=?");
    ids.forEach((id) => mark.run(id === Number(captain) ? 1 : 0, team.user_id, id));
    db.prepare("UPDATE fantasy_teams SET formation=?, lineup_layout=? WHERE user_id=?").run(formation, JSON.stringify(normalizedLayout), team.user_id);
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
      if (req.url === "/api/fantasy/public-leagues" && req.method === "GET") {
        const rows = db.prepare(`
          SELECT l.id, l.name, l.code, l.description, l.max_members, l.is_public,
            (SELECT COUNT(*) FROM fantasy_league_members WHERE league_id=l.id) AS members,
            (SELECT points_cash_reward FROM fantasy_league_settings WHERE league_id=l.id) AS points_cash_reward
          FROM fantasy_leagues l
          WHERE l.is_public = 1
          ORDER BY l.id DESC
          LIMIT 50
        `).all();
        return json(res, 200, { leagues: rows });
      }
      if (req.method !== "POST") return json(res, 405, { error: "Metodo no permitido" });
      const data = await body(req);
      const action = req.url.split("/").pop();
      if (action === "team") createTeam(userId, activeLeagueId, data.name);
      else if (["buy", "sell"].includes(action)) trade(userId, activeLeagueId, Number(data.playerId), action);
      else if (action === "bid") placeBid(userId, activeLeagueId, Number(data.playerId), Number(data.amount));
      else if (action === "offer") createOffer(userId, activeLeagueId, Number(data.playerId), Number(data.amount));
      else if (action === "offer-response") respondOffer(userId, activeLeagueId, Number(data.offerId), !!data.accept);
      else if (action === "clause") updateClause(userId, activeLeagueId, Number(data.playerId), Number(data.amount));
      else if (action === "clause-buyout") executeClause(userId, activeLeagueId, Number(data.playerId));
      else if (action === "lineup") saveLineup(userId, activeLeagueId, data.formation, data.starters || [], data.captain, data.layout || []);
      else if (action === "league") {
        const code = randomBytes(3).toString("hex").toUpperCase();
        const isPublic = data.is_public ? 1 : 0;
        const result = db.prepare(`
          INSERT INTO fantasy_leagues (name, code, created_by, is_public, description, max_members, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          String(data.name || (isPublic ? "Liga pública" : "Liga privada")).trim().slice(0, 40),
          code,
          userId,
          isPublic,
          String(data.description || "").trim().slice(0, 200),
          Number(data.max_members) || 20,
          Date.now(),
        );
        db.prepare("INSERT INTO fantasy_league_members VALUES (?, ?)").run(result.lastInsertRowid, userId);
        saveLeagueSettings(Number(result.lastInsertRowid), data.settings || {});
      } else if (action === "join") {
        const code = String(data.code || "").trim().toUpperCase();
        const leagueRow = db.prepare(`
          SELECT id, is_public, max_members FROM fantasy_leagues WHERE code=?
        `).get(code);
        if (!leagueRow) throw new Error("Codigo de liga no valido");
        const memberCount = db.prepare("SELECT COUNT(*) c FROM fantasy_league_members WHERE league_id=?").get(leagueRow.id).c;
        if (memberCount >= leagueRow.max_members) throw new Error("Liga completa");
        db.prepare("INSERT OR IGNORE INTO fantasy_league_members VALUES (?, ?)").run(leagueRow.id, userId);
      } else if (action === "settings") {
        const owner = db.prepare("SELECT created_by FROM fantasy_leagues WHERE id=?").get(activeLeagueId);
        if (!owner || owner.created_by !== userId) throw new Error("Solo el administrador puede cambiar la liga");
        saveLeagueSettings(activeLeagueId, data.settings || {});
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
