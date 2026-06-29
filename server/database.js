import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const isTestMode = process.env.PLAYFULBET_TEST === "1"
  || process.env.NODE_ENV === "test"
  || (typeof process === "object" && Array.isArray(process.argv)
    && process.argv.some((arg) => arg.endsWith(".test.js") || arg.endsWith(".test.mjs")));

const DB_PATH = resolve(
  process.env.PLAYFULBET_DB_PATH
    || (isTestMode ? "data/playfulbet.test.db" : "data/playfulbet.db"),
);
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    google_sub TEXT,
    points INTEGER NOT NULL DEFAULT 1500 CHECK(points >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id TEXT NOT NULL,
    selection TEXT NOT NULL CHECK(selection IN ('1', 'X', '2')),
    points_bet INTEGER NOT NULL CHECK(points_bet > 0),
    points_won INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS league_members (
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (league_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    status_code INTEGER NOT NULL,
    headers TEXT NOT NULL,
    body BLOB NOT NULL,
    saved_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sports_events (
    event_id TEXT PRIMARY KEY,
    sport TEXT NOT NULL,
    payload TEXT NOT NULL,
    odds_payload TEXT,
    odds_updated_at INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sports_sync (
    sport TEXT PRIMARY KEY,
    synced_at INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS odds_history (
    id INTEGER PRIMARY KEY,
    event_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY,
    endpoint TEXT NOT NULL,
    sport TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    team_id INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    team_logo TEXT,
    position TEXT NOT NULL CHECK(position IN ('POR', 'DEF', 'MED', 'DEL')),
    photo TEXT,
    price INTEGER NOT NULL DEFAULT 500000 CHECK(price >= 150000),
    previous_price INTEGER NOT NULL DEFAULT 500000,
    total_points INTEGER NOT NULL DEFAULT 0,
    last_round_points INTEGER NOT NULL DEFAULT 0,
    last_5_avg_points REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'injured', 'suspended', 'doubt')),
    titular_probable INTEGER NOT NULL DEFAULT 1,
    ownership REAL NOT NULL DEFAULT 0,
    purchase_price INTEGER NOT NULL DEFAULT 0,
    base_clause_amount INTEGER NOT NULL DEFAULT 0,
    last_value_update INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_teams (
    user_id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    name TEXT NOT NULL,
    budget INTEGER NOT NULL DEFAULT 100000000 CHECK(budget >= 0),
    formation TEXT NOT NULL DEFAULT '4-3-3',
    lineup_layout TEXT NOT NULL DEFAULT '[]',
    total_points INTEGER NOT NULL DEFAULT 0,
    round_points INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_team_players (
    user_id TEXT NOT NULL REFERENCES fantasy_teams(user_id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    purchase_price INTEGER NOT NULL,
    is_starter INTEGER NOT NULL DEFAULT 0,
    is_captain INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_transactions (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
    price INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_rounds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    starts_at INTEGER,
    status TEXT NOT NULL DEFAULT 'upcoming',
    fixture_ids TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_player_stats (
    fixture_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    payload TEXT NOT NULL,
    calculated_at INTEGER NOT NULL,
    PRIMARY KEY (fixture_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_leagues (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    max_members INTEGER NOT NULL DEFAULT 20,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_league_settings (
    league_id INTEGER PRIMARY KEY REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    initial_budget INTEGER NOT NULL DEFAULT 100000000,
    initial_players INTEGER NOT NULL DEFAULT 12,
    market_refresh_hour INTEGER NOT NULL DEFAULT 0,
    max_squad_players INTEGER NOT NULL DEFAULT 24,
    clause_max_multiplier REAL NOT NULL DEFAULT 4,
    clause_block_hours INTEGER NOT NULL DEFAULT 24,
    allow_live_changes INTEGER NOT NULL DEFAULT 0,
    points_cash_reward INTEGER NOT NULL DEFAULT 0,
    exclusive_market INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_league_members (
    league_id INTEGER NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    PRIMARY KEY (league_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_api_usage (
    id INTEGER PRIMARY KEY,
    endpoint TEXT NOT NULL,
    remaining INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_league_players (
    league_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    user_id TEXT NOT NULL,
    acquired_at INTEGER NOT NULL,
    PRIMARY KEY (league_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_markets (
    league_id INTEGER NOT NULL,
    market_date TEXT NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    price INTEGER NOT NULL,
    refresh_at INTEGER NOT NULL,
    PRIMARY KEY (league_id, market_date, player_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_player_clauses (
    league_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    owner_user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    base_amount INTEGER NOT NULL,
    paid_extra INTEGER NOT NULL DEFAULT 0,
    lowered_at INTEGER,
    lock_until INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (league_id, player_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_player_ownership_history (
    id INTEGER PRIMARY KEY,
    league_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    from_user_id TEXT,
    to_user_id TEXT,
    operation TEXT NOT NULL,
    price INTEGER NOT NULL,
    clause_amount INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_bids (
    id INTEGER PRIMARY KEY,
    league_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS fantasy_notifications (
    id INTEGER PRIMARY KEY,
    league_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    read_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_offers (
    id INTEGER PRIMARY KEY,
    league_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id),
    from_user_id TEXT NOT NULL,
    to_user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    responded_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS fantasy_matchday_snapshots (
    round_id TEXT NOT NULL,
    league_id INTEGER NOT NULL,
    team_user_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    formation TEXT NOT NULL,
    lineup_player_ids TEXT NOT NULL,
    captain_player_id INTEGER,
    lineup_layout TEXT NOT NULL,
    budget_at_start INTEGER NOT NULL,
    can_score INTEGER NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    reward_paid INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (round_id, league_id, team_user_id)
  );

  CREATE TABLE IF NOT EXISTS fantasy_player_market_history (
    id INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES fantasy_players(id) ON DELETE CASCADE,
    previous_value INTEGER NOT NULL,
    new_value INTEGER NOT NULL,
    percentage_change REAL NOT NULL,
    primary_reason TEXT NOT NULL,
    demand_score REAL NOT NULL,
    performance_score REAL NOT NULL,
    penalty_score REAL NOT NULL,
    raw_variation_pct REAL NOT NULL,
    detail TEXT NOT NULL DEFAULT '{}',
    calculated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_player_market_metrics (
    player_id INTEGER PRIMARY KEY REFERENCES fantasy_players(id) ON DELETE CASCADE,
    number_of_bids INTEGER NOT NULL DEFAULT 0,
    average_bid INTEGER NOT NULL DEFAULT 0,
    max_bid INTEGER NOT NULL DEFAULT 0,
    avg_bid_over_value_pct REAL NOT NULL DEFAULT 0,
    max_bid_over_value_pct REAL NOT NULL DEFAULT 0,
    clause_buyouts_24h INTEGER NOT NULL DEFAULT 0,
    sales_24h INTEGER NOT NULL DEFAULT 0,
    times_in_market_without_bid INTEGER NOT NULL DEFAULT 0,
    titular_probable INTEGER NOT NULL DEFAULT 1,
    last_points_5_avg REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_profiles (
    user_key TEXT PRIMARY KEY,
    streak INTEGER NOT NULL DEFAULT 0,
    last_daily_claim_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_video_claims (
    id INTEGER PRIMARY KEY,
    user_key TEXT NOT NULL,
    amount INTEGER NOT NULL,
    claimed_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_offer_claims (
    user_key TEXT NOT NULL,
    offer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount INTEGER NOT NULL,
    claimed_at INTEGER NOT NULL,
    PRIMARY KEY (user_key, offer_id)
  );

  CREATE TABLE IF NOT EXISTS reward_redemptions (
    id INTEGER PRIMARY KEY,
    user_key TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    reward_name TEXT NOT NULL,
    cost INTEGER NOT NULL,
    status TEXT NOT NULL,
    delivery_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

`);

const columns = db.prepare("PRAGMA table_info(sports_events)").all().map((column) => column.name);
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
if (!userColumns.includes("google_sub")) {
  db.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
}
if (!columns.includes("odds_updated_at")) {
  db.exec("ALTER TABLE sports_events ADD COLUMN odds_updated_at INTEGER");
}
const syncColumns = db.prepare("PRAGMA table_info(sports_sync)").all().map((column) => column.name);
if (!syncColumns.includes("blocked_until")) {
  db.exec("ALTER TABLE sports_sync ADD COLUMN blocked_until INTEGER NOT NULL DEFAULT 0");
}
const fantasyTeamColumns = db.prepare("PRAGMA table_info(fantasy_teams)").all().map((column) => column.name);
if (!fantasyTeamColumns.includes("league_id")) {
  db.exec("ALTER TABLE fantasy_teams ADD COLUMN league_id INTEGER NOT NULL DEFAULT 1");
}
if (!fantasyTeamColumns.includes("owner_user_id")) {
  db.exec("ALTER TABLE fantasy_teams ADD COLUMN owner_user_id TEXT");
  db.exec("UPDATE fantasy_teams SET owner_user_id = user_id WHERE owner_user_id IS NULL");
}
if (!fantasyTeamColumns.includes("lineup_layout")) {
  db.exec("ALTER TABLE fantasy_teams ADD COLUMN lineup_layout TEXT NOT NULL DEFAULT '[]'");
}

const fantasyLeagueColumns = db.prepare("PRAGMA table_info(fantasy_leagues)").all().map((column) => column.name);
if (!fantasyLeagueColumns.includes("is_public")) {
  db.exec("ALTER TABLE fantasy_leagues ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
}
if (!fantasyLeagueColumns.includes("description")) {
  db.exec("ALTER TABLE fantasy_leagues ADD COLUMN description TEXT NOT NULL DEFAULT ''");
}
if (!fantasyLeagueColumns.includes("max_members")) {
  db.exec("ALTER TABLE fantasy_leagues ADD COLUMN max_members INTEGER NOT NULL DEFAULT 20");
}

const fantasyPlayerColumns = db.prepare("PRAGMA table_info(fantasy_players)").all().map((column) => column.name);
if (!fantasyPlayerColumns.includes("last_5_avg_points")) {
  db.exec("ALTER TABLE fantasy_players ADD COLUMN last_5_avg_points REAL NOT NULL DEFAULT 0");
}
if (!fantasyPlayerColumns.includes("titular_probable")) {
  db.exec("ALTER TABLE fantasy_players ADD COLUMN titular_probable INTEGER NOT NULL DEFAULT 1");
}
if (!fantasyPlayerColumns.includes("purchase_price")) {
  db.exec("ALTER TABLE fantasy_players ADD COLUMN purchase_price INTEGER NOT NULL DEFAULT 0");
}
if (!fantasyPlayerColumns.includes("base_clause_amount")) {
  db.exec("ALTER TABLE fantasy_players ADD COLUMN base_clause_amount INTEGER NOT NULL DEFAULT 0");
}
if (!fantasyPlayerColumns.includes("last_value_update")) {
  db.exec("ALTER TABLE fantasy_players ADD COLUMN last_value_update INTEGER");
}
const fantasySnapshotColumns = db.prepare("PRAGMA table_info(fantasy_matchday_snapshots)").all().map((column) => column.name);
if (fantasySnapshotColumns.length && !fantasySnapshotColumns.includes("reward_paid")) {
  db.exec("ALTER TABLE fantasy_matchday_snapshots ADD COLUMN reward_paid INTEGER NOT NULL DEFAULT 0");
}
db.exec(`
  INSERT OR IGNORE INTO fantasy_leagues (id, name, code, created_by, created_at)
  VALUES (1, 'Liga abierta', 'OPEN01', 'system', CAST(strftime('%s','now') AS INTEGER) * 1000)
`);
db.exec(`
  INSERT OR IGNORE INTO fantasy_league_settings (
    league_id, initial_budget, initial_players, market_refresh_hour, max_squad_players,
    clause_max_multiplier, clause_block_hours, allow_live_changes, points_cash_reward,
    exclusive_market, updated_at
  )
  SELECT id, 100000000, 12, 0, 24, 4, 24, 0, 0, 1, CAST(strftime('%s','now') AS INTEGER) * 1000
  FROM fantasy_leagues
`);
db.exec(`
  INSERT OR IGNORE INTO fantasy_league_players (league_id, player_id, user_id, acquired_at)
  SELECT t.league_id, tp.player_id, tp.user_id, CAST(strftime('%s','now') AS INTEGER) * 1000
  FROM fantasy_team_players tp JOIN fantasy_teams t ON t.user_id=tp.user_id
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sports_events_sport ON sports_events(sport);
  CREATE INDEX IF NOT EXISTS idx_sports_events_odds_age ON sports_events(sport, odds_updated_at);
  CREATE INDEX IF NOT EXISTS idx_odds_history_event_time ON odds_history(event_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fantasy_players_team ON fantasy_players(team_id, position);
  CREATE INDEX IF NOT EXISTS idx_fantasy_usage_time ON fantasy_api_usage(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fantasy_market_date ON fantasy_markets(league_id, market_date);
  CREATE INDEX IF NOT EXISTS idx_fantasy_history_league_time ON fantasy_player_ownership_history(league_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fantasy_notifications_user_time ON fantasy_notifications(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fantasy_offers_target ON fantasy_offers(to_user_id, status, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fantasy_teams_owner_league ON fantasy_teams(owner_user_id, league_id);
  CREATE INDEX IF NOT EXISTS idx_market_history_player_time ON fantasy_player_market_history(player_id, calculated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_market_metrics_bids ON fantasy_player_market_metrics(number_of_bids DESC);
  CREATE INDEX IF NOT EXISTS idx_market_metrics_clause ON fantasy_player_market_metrics(clause_buyouts_24h DESC);
  CREATE INDEX IF NOT EXISTS idx_reward_video_claims_user_time ON reward_video_claims(user_key, claimed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reward_redemptions_user_time ON reward_redemptions(user_key, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
`);

const hashPassword = (password, salt = randomBytes(16).toString("hex")) =>
  `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
};

const publicUser = (user) => user && ({
  id: String(user.id),
  username: user.username,
  email: user.email,
  points: user.points,
  joinedAt: user.created_at,
});

const sanitizeUsername = (value) => {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_ ]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 20);
  return normalized.length >= 3 ? normalized : "player";
};

const findAvailableUsername = (value) => {
  const base = sanitizeUsername(value);
  let candidate = base;
  let suffix = 1;
  while (db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE").get(candidate)) {
    candidate = `${base.slice(0, Math.max(3, 20 - String(suffix).length))}${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export function createUser(username, email, password) {
  const result = db.prepare(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
  ).run(username.trim(), email.trim().toLowerCase(), hashPassword(password));
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid));
}

export function authenticate(email, password) {
  const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email.trim());
  return user && verifyPassword(password, user.password_hash) ? publicUser(user) : null;
}

export function createOrUpdateGoogleUser({ googleSub, email, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const byGoogle = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(googleSub);
  if (byGoogle) return publicUser(byGoogle);

  const byEmail = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(normalizedEmail);
  if (byEmail) {
    if (byEmail.google_sub && byEmail.google_sub !== googleSub) {
      throw new Error("Esta cuenta ya está vinculada a otro acceso de Google");
    }
    db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(googleSub, byEmail.id);
    return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(byEmail.id));
  }

  const username = findAvailableUsername(name || normalizedEmail.split("@")[0]);
  const password = randomBytes(24).toString("hex");
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, google_sub)
    VALUES (?, ?, ?, ?)
  `).run(username, normalizedEmail, hashPassword(password), googleSub);
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid));
}

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function getSessionUser(token) {
  if (!token) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  return publicUser(db.prepare(`
    SELECT users.* FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(token, Date.now()));
}

export const deleteSession = (token) =>
  token && db.prepare("DELETE FROM sessions WHERE token = ?").run(token);

export function getApiCache(key, maxAge) {
  return db.prepare(
    "SELECT status_code, headers, body FROM api_cache WHERE cache_key = ? AND saved_at > ?",
  ).get(key, Date.now() - maxAge);
}

export function setApiCache(key, statusCode, headers, body) {
  db.prepare(`
    INSERT INTO api_cache (cache_key, status_code, headers, body, saved_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      status_code = excluded.status_code,
      headers = excluded.headers,
      body = excluded.body,
      saved_at = excluded.saved_at
  `).run(key, statusCode, JSON.stringify(headers), body, Date.now());
}

export const getSportSync = (sport) =>
  db.prepare("SELECT synced_at, blocked_until FROM sports_sync WHERE sport = ?").get(sport)
  || { synced_at: 0, blocked_until: 0 };

export const setSportSync = (sport, blockedUntil = 0) =>
  db.prepare(`
    INSERT INTO sports_sync (sport, synced_at, blocked_until) VALUES (?, ?, ?)
    ON CONFLICT(sport) DO UPDATE SET
      synced_at = excluded.synced_at,
      blocked_until = excluded.blocked_until
  `).run(sport, Date.now(), blockedUntil);

export function saveSportsEvents(sport, events) {
  const current = db.prepare("SELECT payload FROM sports_events WHERE event_id = ?");
  const save = db.prepare(`
    INSERT INTO sports_events (event_id, sport, payload, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `);
  for (const event of events) {
    const payload = JSON.stringify(event);
    if (current.get(String(event.id))?.payload !== payload) {
      save.run(String(event.id), sport, payload, Date.now());
    }
  }

  const keepIds = events.map((event) => String(event.id));
  const placeholders = keepIds.map(() => "?").join(",") || "''";
  db.prepare(`
    DELETE FROM sports_events
    WHERE sport = ?
      AND json_extract(payload, '$.status') IN ('pending', 'live')
      AND event_id NOT IN (${placeholders})
  `).run(sport, ...keepIds);
}

export const getEventsNeedingOdds = (sport, maxAge) =>
  db.prepare(`
    SELECT event_id FROM sports_events
    WHERE sport = ?
      AND (odds_payload IS NULL OR odds_updated_at < ?)
      AND json_extract(payload, '$.status') IN ('pending', 'live')
    ORDER BY
      CASE WHEN json_extract(payload, '$.status') = 'live' THEN 0 ELSE 1 END,
      json_extract(payload, '$.date') ASC
  `).all(sport, Date.now() - maxAge).map((row) => row.event_id);

export function saveEventOdds(events) {
  const current = db.prepare("SELECT odds_payload FROM sports_events WHERE event_id = ?");
  const save = db.prepare(
    "UPDATE sports_events SET odds_payload = ?, odds_updated_at = ? WHERE event_id = ?",
  );
  const history = db.prepare(
    "INSERT INTO odds_history (event_id, payload, created_at) VALUES (?, ?, ?)",
  );
  for (const event of events) {
    const id = String(event.id);
    const payload = JSON.stringify(event);
    if (current.get(id)?.odds_payload !== payload) {
      history.run(id, payload, Date.now());
    }
    save.run(payload, Date.now(), id);
  }
}

export const getStoredSportsEvents = (sport) =>
  db.prepare(`
    SELECT payload, odds_payload FROM sports_events
    WHERE sport = ?
    ORDER BY json_extract(payload, '$.date')
  `).all(sport).map((row) => JSON.parse(row.odds_payload || row.payload));

export function getStoredSportsEvent(eventId) {
  const row = db.prepare(`
    SELECT payload, odds_payload, odds_updated_at
    FROM sports_events
    WHERE event_id = ?
  `).get(String(eventId));
  return row && {
    event: JSON.parse(row.odds_payload || row.payload),
    oddsUpdatedAt: row.odds_updated_at,
  };
}

export const recordApiUsage = (endpoint, sport, statusCode, durationMs) =>
  db.prepare(`
    INSERT INTO api_usage (endpoint, sport, status_code, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(endpoint, sport, statusCode, durationMs, Date.now());

export const getApiUsageSince = (since) =>
  db.prepare(`
    SELECT sport, endpoint, COUNT(*) AS count
    FROM api_usage
    WHERE created_at >= ?
    GROUP BY sport, endpoint
    ORDER BY sport, endpoint
  `).all(since);

export const getOldestApiUsageSince = (since) =>
  db.prepare("SELECT MIN(created_at) AS oldest FROM api_usage WHERE created_at >= ?").get(since)?.oldest || null;

export const getSportsCoverage = () =>
  db.prepare(`
    SELECT sport, COUNT(*) AS events, SUM(odds_payload IS NOT NULL) AS with_odds
    FROM sports_events
    GROUP BY sport
    ORDER BY sport
  `).all();

export function cleanupSportsData() {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oddsWindowCutoff = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare("DELETE FROM odds_history WHERE created_at < ?").run(ninetyDaysAgo);
  db.prepare("DELETE FROM api_usage WHERE created_at < ?").run(ninetyDaysAgo);
  db.prepare("DELETE FROM api_cache WHERE saved_at < ?").run(sevenDaysAgo);

  // Solo conservamos eventos finalizados de las últimas 24h (para "Últimos Resultados").
  db.prepare(`
    DELETE FROM sports_events
    WHERE json_extract(payload, '$.status') IN ('settled', 'finished')
      AND json_extract(payload, '$.date') < ?
  `).run(oneDayAgoIso);

  // Eliminar eventos pending/live fuera de la ventana de 15 días (nunca los sincronizaremos).
  db.prepare(`
    DELETE FROM sports_events
    WHERE json_extract(payload, '$.status') IN ('pending', 'live')
      AND json_extract(payload, '$.date') > ?
  `).run(oddsWindowCutoff);
}
