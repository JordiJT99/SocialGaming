import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve("data/playfulbet.db");
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
    price INTEGER NOT NULL DEFAULT 500000 CHECK(price >= 500000),
    previous_price INTEGER NOT NULL DEFAULT 500000,
    total_points INTEGER NOT NULL DEFAULT 0,
    last_round_points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available',
    ownership REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fantasy_teams (
    user_id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    name TEXT NOT NULL,
    budget INTEGER NOT NULL DEFAULT 100000000 CHECK(budget >= 0),
    formation TEXT NOT NULL DEFAULT '4-3-3',
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
    created_at INTEGER NOT NULL
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

`);

const columns = db.prepare("PRAGMA table_info(sports_events)").all().map((column) => column.name);
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
  CREATE UNIQUE INDEX IF NOT EXISTS idx_fantasy_teams_owner_league ON fantasy_teams(owner_user_id, league_id);
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
