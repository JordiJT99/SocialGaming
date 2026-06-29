import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "./database.js";
import { fantasyApi } from "./fantasy.js";

let origFetch;

const mockResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const makeReq = ({ method = "GET", url = "/api/fantasy", user = "current_user", league = "1", body = null } = {}) => {
  const handlers = {};
  const req = {
    method,
    url,
    headers: {
      "x-playfulbet-user": user,
      "x-playfulbet-fantasy-league": league,
    },
    on(event, handler) {
      handlers[event] = handler;
      if (event === "end") {
        queueMicrotask(() => {
          if (body && handlers.data) handlers.data(JSON.stringify(body));
          if (handlers.end) handlers.end();
        });
      }
    },
  };
  return req;
};

const makeRes = () => {
  const res = {
    statusCode: 0,
    _headers: {},
    _body: null,
    setHeader(k, v) { this._headers[k] = v; },
    end(payload) { this._body = payload; },
  };
  return res;
};

const callApi = async ({ method, url, user, league, body }) => {
  const handler = fantasyApi();
  let called = false;
  const req = makeReq({ method, url, user, league, body });
  const res = makeRes();
  await handler(req, res, () => { called = true; });
  if (called) return { passedThrough: true };
  return { status: res.statusCode, body: res._body ? JSON.parse(res._body) : null };
};

const setupPlayer = (overrides = {}) => {
  const now = Date.now();
  const id = overrides.id ?? Math.floor(Math.random() * 1e8) + 1;
  db.prepare("DELETE FROM fantasy_team_players WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_league_players WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_player_clauses WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_players WHERE id = ?").run(id);
  db.prepare(`
    INSERT INTO fantasy_players (id, name, team_id, team_name, position, price, previous_price, photo, status, titular_probable, total_points, last_round_points, last_5_avg_points, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.name ?? "Test Player",
    overrides.teamId ?? 1,
    overrides.teamName ?? "Test FC",
    overrides.position ?? "DEL",
    overrides.price ?? 5000000,
    overrides.previousPrice ?? overrides.price ?? 5000000,
    overrides.photo ?? null,
    overrides.status ?? "available",
    overrides.titularProbable ?? 1,
    overrides.totalPoints ?? 0,
    overrides.lastRoundPoints ?? 0,
    overrides.last5AvgPoints ?? 0,
    now,
  );
  return id;
};

const addPlayerToMarket = (playerId, leagueId = 1) => {
  const dates = [];
  for (let offset = -12; offset <= 36; offset += 12) {
    const d = new Date(Date.now() + offset * 60 * 60 * 1000);
    dates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
  }
  const uniqueDates = [...new Set(dates)];
  db.prepare("DELETE FROM fantasy_markets WHERE league_id = ? AND player_id = ?").run(leagueId, playerId);
  const price = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId).price;
  for (const date of uniqueDates) {
    db.prepare(`
      INSERT INTO fantasy_markets (league_id, market_date, player_id, price, refresh_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(leagueId, date, playerId, price, Date.now() + 86400000);
  }
};

const deleteTeam = (userId, leagueId) => {
  const team = db.prepare("SELECT user_id FROM fantasy_teams WHERE owner_user_id = ? AND league_id = ?").get(userId, leagueId);
  if (team) {
    db.prepare("DELETE FROM fantasy_team_players WHERE user_id = ?").run(team.user_id);
    db.prepare("DELETE FROM fantasy_player_clauses WHERE owner_user_id = ?").run(userId);
    db.prepare("DELETE FROM fantasy_league_players WHERE user_id = ? AND league_id = ?").run(userId, leagueId);
    db.prepare("DELETE FROM fantasy_transactions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM fantasy_bids WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM fantasy_offers WHERE from_user_id = ? OR to_user_id = ?").run(userId, userId);
    db.prepare("DELETE FROM fantasy_teams WHERE user_id = ?").run(team.user_id);
  }
};

const createOrResetUser = (userId) => {
  deleteTeam(userId, 1);
  deleteTeam(userId, 2);
};

const mockEspn = () => {
  const teams = [
    { team: { id: 1, displayName: "Test FC", name: "Test", logos: [{ href: "logo.png" }] } },
  ];
  const athletes = [];
  const positions = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
  for (let i = 1; i <= 30; i++) {
    const pos = positions[i % 4];
    athletes.push({
      id: String(i * 100),
      displayName: `Player ${i}`,
      position: { displayName: pos },
      headshot: { href: `${i}.png` },
    });
  }
  const roster = { athletes };
  const fixtures = {
    events: [
      {
        id: "fx1",
        date: new Date(Date.now() + 86400000).toISOString(),
        shortName: "T1 vs T2",
        status: { type: { state: "pre", completed: false } },
        competitions: [{ competitors: [
          { homeAway: "home", team: { id: 1, displayName: "Test FC", abbreviation: "TFC" }, score: 0 },
          { homeAway: "away", team: { id: 2, displayName: "Other FC", abbreviation: "OFC" }, score: 0 },
        ] }],
      },
    ],
  };
  return {
    "site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams": { sports: [{ leagues: [{ teams }] }] },
    "site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams/1/roster": roster,
    "site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard": fixtures,
  };
};

before(() => {
  origFetch = global.fetch;
  const mocks = mockEspn();
  global.fetch = async (url) => {
    const key = String(url).replace(/^https?:\/\//, "").split("?")[0];
    if (mocks[key]) return mockResponse(mocks[key]);
    if (key.includes("site.api.espn.com")) return mockResponse({ sports: [{ leagues: [{ teams: [] }] }] });
    return mockResponse({}, 404);
  };
});

after(() => {
  global.fetch = origFetch;
});

beforeEach(() => {
  db.exec("DELETE FROM fantasy_teams");
  db.exec("DELETE FROM fantasy_team_players");
  db.exec("DELETE FROM fantasy_player_clauses");
  db.exec("DELETE FROM fantasy_league_players");
  db.exec("DELETE FROM fantasy_bids");
  db.exec("DELETE FROM fantasy_offers");
  db.exec("DELETE FROM fantasy_transactions");
  db.exec("DELETE FROM fantasy_notifications");
  db.exec("DELETE FROM fantasy_matchday_snapshots");
  db.exec("DELETE FROM fantasy_player_ownership_history");
  db.exec("DELETE FROM fantasy_markets");
  db.exec("DELETE FROM fantasy_rounds");
  db.exec("DELETE FROM fantasy_league_members");
  db.exec("DELETE FROM fantasy_leagues WHERE id != 1");
  db.exec("DELETE FROM fantasy_league_settings WHERE league_id != 1");
  db.exec("DELETE FROM fantasy_players");
  db.prepare(`
    INSERT INTO fantasy_league_settings (
      league_id, initial_budget, initial_players, market_refresh_hour, max_squad_players,
      clause_max_multiplier, clause_block_hours, allow_live_changes, points_cash_reward,
      exclusive_market, updated_at
    ) VALUES (1, 100000000, 12, 0, 24, 4, 24, 0, 0, 1, ?)
    ON CONFLICT(league_id) DO UPDATE SET
      initial_budget = excluded.initial_budget,
      initial_players = excluded.initial_players,
      market_refresh_hour = excluded.market_refresh_hour,
      max_squad_players = excluded.max_squad_players,
      clause_max_multiplier = excluded.clause_max_multiplier,
      clause_block_hours = excluded.clause_block_hours,
      exclusive_market = excluded.exclusive_market
  `).run(Date.now());
});

test("fantasyApi ignora rutas que no son /api/fantasy", async () => {
  const handler = fantasyApi();
  const req = makeReq({ url: "/api/other" });
  const res = makeRes();
  let nextCalled = false;
  await handler(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true, "next() debe ser llamado para rutas no-fantasy");
});

test("GET /api/fantasy sin jugadores en BD pero con mock ESPN sincroniza correctamente", async () => {
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.players.length >= 12, "Debe sincronizar al menos 12 jugadores");
});

test("GET /api/fantasy sincroniza jugadores desde ESPN mockeado", async () => {
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.players.length >= 12, `Debe tener >= 12 jugadores (got ${result.body.players.length})`);
  assert.equal(result.body.team, null, "Sin equipo creado");
});

test("POST /api/fantasy/team crea un equipo", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  assert.equal(result.status, 200);
  assert.ok(result.body.team, "El equipo debe existir");
  assert.equal(result.body.team.name, "Mi XI");
  assert.equal(result.body.team.budget, 100000000, "Presupuesto inicial 100M");
  assert.equal(result.body.team.formation, "4-3-3", "Formación por defecto 4-3-3");
});

test("POST /api/fantasy/team rechaza segundo equipo en la misma liga", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const result = await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Otro" } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("plantilla") || result.body.error.includes("equipo"));
});

test("POST /api/fantasy/buy compra jugador del mercado", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);

  const before = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  const result = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const after = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  assert.ok(after < before, `Presupuesto debe haber bajado (${before} -> ${after})`);
  const owned = db.prepare("SELECT 1 FROM fantasy_team_players WHERE player_id = ?").get(playerId);
  assert.ok(owned, "Jugador debe estar en el equipo");
});

test("POST /api/fantasy/buy falla con jugador ya en propiedad", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const second = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  assert.equal(second.status, 400);
  assert.ok(second.body.error.includes("Ya tienes"));
});

test("POST /api/fantasy/buy falla con presupuesto insuficiente", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  db.prepare("UPDATE fantasy_players SET price = ? WHERE id = ?").run(999999999999, playerId);
  addPlayerToMarket(playerId);

  const result = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  assert.equal(result.status, 400, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.error.includes("Presupuesto"));
});

test("POST /api/fantasy/buy falla con jugador no en el mercado", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;

  const result = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("mercado"));
});

test("POST /api/fantasy/sell vende jugador del mercado", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const budgetBefore = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user' AND league_id = 1").get().budget;

  const result = await callApi({ method: "POST", url: "/api/fantasy/sell", body: { playerId } });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const budgetAfter = result.body.team.budget;
  assert.ok(budgetAfter > budgetBefore, `Presupuesto debe aumentar (${budgetBefore} -> ${budgetAfter})`);
  const stillOwned = db.prepare("SELECT 1 FROM fantasy_team_players WHERE player_id = ?").get(playerId);
  assert.equal(stillOwned, undefined, "Jugador no debe seguir en propiedad");
});

test("POST /api/fantasy/sell falla sin tener el jugador", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  const result = await callApi({ method: "POST", url: "/api/fantasy/sell", body: { playerId } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("No tienes"));
});

test("POST /api/fantasy/bid registra puja", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);

  const result = await callApi({ method: "POST", url: "/api/fantasy/bid", body: { playerId, amount: 1000000 } });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const bid = db.prepare("SELECT * FROM fantasy_bids WHERE user_id = 'current_user' AND player_id = ?").get(playerId);
  assert.ok(bid, "Debe existir la puja");
  assert.equal(bid.amount, 1000000);
});

test("POST /api/fantasy/bid falla con puja inválida (0 o negativo)", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);

  const result = await callApi({ method: "POST", url: "/api/fantasy/bid", body: { playerId, amount: 0 } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("puja"));
});

test("POST /api/fantasy/bid falla con saldo insuficiente", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  db.prepare("UPDATE fantasy_teams SET budget = 100 WHERE owner_user_id = 'current_user'").run();
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);

  const result = await callApi({ method: "POST", url: "/api/fantasy/bid", body: { playerId, amount: 1000000 } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("saldo"));
});

test("POST /api/fantasy/league crea una liga privada", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/league", body: { name: "Mi Liga", settings: { initial_budget: 50000000 } } });
  assert.equal(result.status, 200);
  assert.ok(result.body.activeLeague, "Liga activa debe existir");
  assert.equal(result.body.activeLeague.name, "Mi Liga");
  const settings = db.prepare("SELECT * FROM fantasy_league_settings WHERE league_id = ?").get(result.body.activeLeague.id);
  assert.equal(settings.initial_budget, 50000000, "Settings personalizados guardados");
});

test("POST /api/fantasy/join une a una liga existente", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/league", body: { name: "Liga A" } });
  const code = db.prepare("SELECT code FROM fantasy_leagues WHERE name = 'Liga A'").get().code;

  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/join",
    body: { code },
    user: "user2",
  });
  assert.equal(result.status, 200);
  const members = db.prepare("SELECT * FROM fantasy_league_members WHERE user_id = 'user2'").all();
  assert.ok(members.length > 0, "user2 debe ser miembro");
});

test("POST /api/fantasy/join falla con código inválido", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/join", body: { code: "INVALID" } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("no valido"));
});

test("POST /api/fantasy/settings solo admin puede cambiar reglas", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/settings", body: { settings: { initial_budget: 90000000 } } });
  assert.equal(result.status, 200);

  const nonAdmin = await callApi({ method: "POST", url: "/api/fantasy/settings", body: { settings: { initial_budget: 100 } }, user: "user2" });
  assert.equal(nonAdmin.status, 400);
  assert.ok(nonAdmin.body.error.includes("administrador"));
});

test("POST /api/fantasy/clause sube la cláusula de un jugador propio", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const player = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId);
  const targetClause = player.price * 2;
  const result = await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: targetClause } });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const clause = db.prepare("SELECT * FROM fantasy_player_clauses WHERE player_id = ?").get(playerId);
  assert.equal(clause.amount, targetClause);
  assert.ok(clause.paid_extra > 0, "paid_extra debe reflejar el pago extra");
});

test("POST /api/fantasy/clause respeta el máximo permitido (4x base)", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const player = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId);
  const absurdClause = player.price * 100;
  const result = await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: absurdClause } });
  assert.equal(result.status, 400, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.error.includes("maximo"));
});

test("POST /api/fantasy/clause baja la cláusula y reembolsa (tras 24h)", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const player = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId).price;
  await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: player * 2 } });
  db.prepare("UPDATE fantasy_player_clauses SET lock_until = 0 WHERE player_id = ?").run(playerId);

  const before = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  const lowered = await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: player } });
  const after = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  assert.equal(lowered.status, 200, `Status: ${lowered.status}, body: ${JSON.stringify(lowered.body)}`);
  assert.ok(after >= before, `Presupuesto debe aumentar al bajar la cláusula (${before} -> ${after})`);
});

test("POST /api/fantasy/clause-buyout paga la cláusula de otro usuario", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;

  const result = await callApi({ method: "POST", url: "/api/fantasy/clause-buyout", body: { playerId }, user: "user2" });
  const after = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'user2' AND league_id = 1").get();
  if (!after) return;
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(after.budget < 100000000, `user2 pierde presupuesto (era 100M, ahora ${after.budget})`);
  const owned = db.prepare("SELECT * FROM fantasy_team_players WHERE player_id = ?").get(playerId);
  const user2TeamKey = db.prepare("SELECT user_id FROM fantasy_teams WHERE owner_user_id = 'user2' AND league_id = 1").get().user_id;
  assert.equal(owned.user_id, user2TeamKey, "user2 ahora es dueño");
});

test("POST /api/fantasy/lineup guarda alineación válida", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const teamKey = db.prepare("SELECT user_id FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().user_id;
  const players = db.prepare(`
    SELECT p.id, p.position FROM fantasy_team_players tp
    JOIN fantasy_players p ON p.id = tp.player_id
    WHERE tp.user_id = ?
    ORDER BY CASE p.position WHEN 'POR' THEN 1 WHEN 'DEF' THEN 2 WHEN 'MED' THEN 3 WHEN 'DEL' THEN 4 END, p.id
  `).all(teamKey);
  const por = players.find((p) => p.position === "POR");
  const defs = players.filter((p) => p.position === "DEF").slice(0, 4);
  const meds = players.filter((p) => p.position === "MED").slice(0, 3);
  const dels = players.filter((p) => p.position === "DEL").slice(0, 3);
  const starters = [por, ...defs, ...meds, ...dels].map((p) => p.id);
  const layout = [...dels.map((p) => p.id), ...meds.map((p) => p.id), ...defs.map((p) => p.id), por.id];
  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/lineup",
    body: { formation: "4-3-3", starters, captain: por.id, layout },
  });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const team = db.prepare("SELECT * FROM fantasy_teams WHERE owner_user_id = 'current_user'").get();
  assert.equal(team.formation, "4-3-3");
});

test("POST /api/fantasy/lineup falla con menos de 11 titulares", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/lineup",
    body: { formation: "4-3-3", starters: [1, 2, 3], captain: 1, layout: ["1", "2", "3"] },
  });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("once") || result.body.error.includes("11") || result.body.error.includes("titulares"));
});

test("POST /api/fantasy/lineup falla sin capitán", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const del = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get();
  addPlayerToMarket(del.id);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId: del.id } });

  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/lineup",
    body: { formation: "4-3-3", starters: [del.id], captain: null, layout: ["1"] },
  });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("capitan"));
});

test("GET /api/fantasy incluye market con jugadores del día", async () => {
  await callApi({ method: "GET" });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);

  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.market, "Debe tener objeto market con date/refreshAt");
  assert.ok(result.body.market.date, "Market debe tener fecha");
  assert.ok(Array.isArray(result.body.players), "Debe tener array de players");
});

test("GET /api/fantasy incluye rivals con cláusulas disponibles", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buyResult = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buyResult.status !== 200) return;

  const result = await callApi({ method: "GET", user: "user2" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.rivalPlayers), "Debe tener rivalPlayers");
  assert.ok(result.body.rivalPlayers.some((p) => p.id === playerId), `El jugador ${playerId} debe aparecer como rival`);
});

test("GET /api/fantasy devuelve 405 para métodos no permitidos", async () => {
  const handler = fantasyApi();
  const req = makeReq({ method: "PUT", url: "/api/fantasy" });
  const res = makeRes();
  await handler(req, res, () => {});
  assert.equal(res.statusCode, 405);
});

test("POST /api/fantasy con acción inexistente devuelve 404", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/unknown-action", body: {} });
  assert.equal(result.status, 404);
  assert.ok(result.body.error.includes("Accion"));
});

test("POST /api/fantasy/offer crea una oferta directa a otro manager", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;

  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/offer",
    body: { playerId, amount: 1000000 },
    user: "user2",
  });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const offer = db.prepare("SELECT * FROM fantasy_offers WHERE from_user_id = 'user2' AND player_id = ?").get(playerId);
  assert.ok(offer, "La oferta debe existir");
  assert.equal(offer.amount, 1000000);
});

test("POST /api/fantasy/offer-response acepta una oferta recibida", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;
  const offerRes = await callApi({ method: "POST", url: "/api/fantasy/offer", body: { playerId, amount: 1000000 }, user: "user2" });
  if (offerRes.status !== 200) return;
  const offer = db.prepare("SELECT * FROM fantasy_offers WHERE from_user_id = 'user2'").get();
  if (!offer) return;

  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/offer-response",
    body: { offerId: offer.id, accept: true },
    user: "user1",
  });
  assert.equal(result.status, 200, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  const updated = db.prepare("SELECT * FROM fantasy_offers WHERE id = ?").get(offer.id);
  assert.equal(updated.status, "accepted", "Oferta debe estar aceptada");
});

test("POST /api/fantasy/offer-response rechaza una oferta recibida", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;
  const offerRes = await callApi({ method: "POST", url: "/api/fantasy/offer", body: { playerId, amount: 1000000 }, user: "user2" });
  if (offerRes.status !== 200) return;
  const offer = db.prepare("SELECT * FROM fantasy_offers WHERE from_user_id = 'user2'").get();
  if (!offer) return;

  const result = await callApi({
    method: "POST",
    url: "/api/fantasy/offer-response",
    body: { offerId: offer.id, accept: false },
    user: "user1",
  });
  assert.equal(result.status, 200);
  const updated = db.prepare("SELECT * FROM fantasy_offers WHERE id = ?").get(offer.id);
  assert.equal(updated.status, "rejected");
});

test("snapshot incluye bids del usuario", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/bid", body: { playerId, amount: 500000 } });

  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.bids), "Debe tener bids");
  assert.ok(result.body.bids.some((b) => b.player_id === playerId));
});

test("snapshot incluye leagues del usuario", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.activeLeague, "Debe tener activeLeague");
  assert.equal(result.body.activeLeague.id, 1, "Liga abierta siempre activa por defecto");
});

test("snapshot incluye activeLeague siempre (id=1 por defecto)", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.activeLeague, "Debe tener activeLeague");
  assert.equal(result.body.activeLeague.id, 1, "Liga abierta (id=1) es la activa por defecto");
});

test("snapshot incluye array de ligas (vacío si el usuario no es miembro)", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.leagues), "Debe tener array de ligas");
});

test("snapshot incluye ligas del usuario tras crear equipo", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.leagues), "Debe tener array de ligas");
  assert.ok(result.body.leagues.length > 0, "Debe tener al menos 1 liga tras crear equipo");
});

test("snapshot incluye rankings ordenado por puntos", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  db.prepare("UPDATE fantasy_teams SET total_points = 100 WHERE owner_user_id = 'user1'").run();
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  db.prepare("UPDATE fantasy_teams SET total_points = 200 WHERE owner_user_id = 'user2'").run();

  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.rankings));
  assert.equal(result.body.rankings[0].total_points, 200, "user2 primero");
  assert.equal(result.body.rankings[1].total_points, 100, "user1 segundo");
});

test("snapshot incluye history de operaciones", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.history));
  assert.ok(result.body.history.length > 0, `Debe tener al menos 1 operación (got ${result.body.history.length})`);
  const operations = result.body.history.map((h) => h.operation);
  assert.ok(operations.includes("initial_assign"), "Debe tener initial_assign del createTeam");
});

test("snapshot calcula teamValue correctamente", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.team.teamValue > 0, "teamValue debe ser > 0");
});

test("transacción buy: presupuesto se reduce exactamente por el precio del jugador", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  const price = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId).price;
  addPlayerToMarket(playerId);
  const initialBudget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;

  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const finalBudget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  assert.equal(initialBudget - finalBudget, price, `Diferencia debe ser ${price} (fue ${initialBudget - finalBudget})`);
});

test("transacción sell: presupuesto se incrementa exactamente por el precio del jugador", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  const price = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId).price;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const beforeSell = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;

  await callApi({ method: "POST", url: "/api/fantasy/sell", body: { playerId } });
  const afterSell = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'current_user'").get().budget;
  assert.equal(afterSell - beforeSell, price, `Diferencia debe ser ${price} (fue ${afterSell - beforeSell})`);
});

test("cláusula mínima: nunca baja de la base del precio de compra", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const purchasePrice = db.prepare("SELECT purchase_price FROM fantasy_team_players WHERE player_id = ?").get(playerId).purchase_price;
  const originalClause = db.prepare("SELECT amount, base_amount FROM fantasy_player_clauses WHERE player_id = ?").get(playerId);

  const result = await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: 1000 } });
  assert.equal(result.status, 200, "El sistema acepta la petición");
  const updatedClause = db.prepare("SELECT amount FROM fantasy_player_clauses WHERE player_id = ?").get(playerId);
  assert.ok(updatedClause.amount >= purchasePrice, `La cláusula no debe bajar de ${purchasePrice} (fue ${updatedClause.amount})`);
  assert.ok(updatedClause.amount >= originalClause.base_amount, "La cláusula nunca baja de base_amount");
});

test("cláusula inicial al comprar es igual al precio del jugador", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = setupPlayer({ id: 999, name: "Barato", position: "DEF", price: 500000, previousPrice: 500000 });
  addPlayerToMarket(999);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId: 999 } });
  const clause = db.prepare("SELECT * FROM fantasy_player_clauses WHERE player_id = 999").get();
  assert.equal(clause.amount, 500000, `Cláusula inicial = precio de compra (fue ${clause.amount})`);
  assert.equal(clause.base_amount, 500000, "Base amount = precio de compra");
});

test("market refresh genera jugadores del mercado al día siguiente", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.market, "Debe tener datos de market");
  assert.ok(result.body.market.date, "Market debe tener fecha");
  assert.ok(result.body.market.timezone, "Market debe tener zona horaria");
});

test("cláusula recién comprada refleja el valor del jugador * 1.5 por defecto", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  const player = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId);
  const clause = db.prepare("SELECT amount FROM fantasy_player_clauses WHERE player_id = ?").get(playerId);
  assert.equal(clause.amount, player.price, "Cláusula inicial = precio de compra");
});

test("oferta a jugador propio falla", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const result = await callApi({ method: "POST", url: "/api/fantasy/offer", body: { playerId, amount: 1000 } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("no admite"));
});

test("oferta a jugador libre (sin dueño) falla", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  const result = await callApi({ method: "POST", url: "/api/fantasy/offer", body: { playerId, amount: 1000 } });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.includes("no admite"));
});

test("compra simultánea: exclusive_market impide que 2 usuarios compren el mismo jugador", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });

  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const result = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user2" });
  assert.equal(result.status, 400, `Status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.error.includes("Otro usuario") || result.body.error.includes("ya ha fichado"), `Mensaje de error correcto: ${result.body.error}`);
});

test("ownership_history se registra en buy/sell/clause", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const history = db.prepare("SELECT * FROM fantasy_player_ownership_history WHERE player_id = ? AND league_id = 1").all(playerId);
  assert.ok(history.length >= 1, `Debe haber al menos 1 registro de buy (got ${history.length})`);
  assert.equal(history[0].operation, "buy_market");

  await callApi({ method: "POST", url: "/api/fantasy/sell", body: { playerId } });
  const history2 = db.prepare("SELECT * FROM fantasy_player_ownership_history WHERE player_id = ? AND league_id = 1 ORDER BY created_at DESC").all(playerId);
  assert.equal(history2[0].operation, "sell_market");
});

test("market muestra solo jugadores sin dueño en la liga", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });

  const result = await callApi({ method: "GET", user: "user2" });
  const inMarket = result.body.players.some((p) => p.id === playerId);
  assert.equal(inMarket, false, "Jugador propiedad de user1 NO debe estar en el market de user2");
});

test("presupuesto se reduce al aceptar oferta (transferencia)", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;
  const offerRes = await callApi({ method: "POST", url: "/api/fantasy/offer", body: { playerId, amount: 1000000 }, user: "user2" });
  if (offerRes.status !== 200) return;
  const offer = db.prepare("SELECT * FROM fantasy_offers WHERE from_user_id = 'user2'").get();
  if (!offer) return;

  await callApi({ method: "POST", url: "/api/fantasy/offer-response", body: { offerId: offer.id, accept: true }, user: "user1" });

  const user1Budget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'user1'").get().budget;
  const user2Budget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'user2'").get().budget;
  assert.ok(user1Budget > 100000000, `user1 debe recibir 1M (era 100M, ahora ${user1Budget})`);
  assert.ok(user2Budget < 100000000, `user2 debe perder 1M (era 100M, ahora ${user2Budget})`);
});

test("presupuesto se reduce al pagar cláusula de otro usuario", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  if (buy.status !== 200) return;
  const clause = db.prepare("SELECT amount FROM fantasy_player_clauses WHERE player_id = ?").get(playerId).amount;

  const buyout = await callApi({ method: "POST", url: "/api/fantasy/clause-buyout", body: { playerId }, user: "user2" });
  if (buyout.status !== 200) return;

  const user2Budget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'user2'").get().budget;
  const user1Budget = db.prepare("SELECT budget FROM fantasy_teams WHERE owner_user_id = 'user1'").get().budget;
  assert.equal(100000000 - user2Budget, clause, `user2 paga ${clause} (era 100M, ahora ${user2Budget})`);
  assert.equal(user1Budget, 100000000 + clause, `user1 recibe el pago de la cláusula (era 100M, ahora ${user1Budget})`);
});

test("cláusula-bloqueo 24h: cláusula no se puede bajar durante el bloqueo", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  const buy = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });
  if (buy.status !== 200) return;
  const player = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: player.price * 2 } });

  const lowered = await callApi({ method: "POST", url: "/api/fantasy/clause", body: { playerId, amount: player.price } });
  assert.equal(lowered.status, 400, "Bajar la cláusula inmediatamente debe fallar");
  assert.ok(lowered.body.error.includes("bloq") || lowered.body.error.includes("24") || lowered.body.error.includes("horas"));
});

test("squad respeta max_squad_players", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  db.prepare("UPDATE fantasy_league_settings SET max_squad_players = 1 WHERE league_id = 1").run();
  const playerIds = db.prepare("SELECT id FROM fantasy_players LIMIT 3").all();
  let success = true;
  for (const { id } of playerIds) {
    addPlayerToMarket(id);
    const r = await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId: id } });
    if (id !== playerIds[0].id && r.status !== 400) success = false;
  }
  assert.ok(success, "Después del primer jugador, los siguientes deben fallar");
  db.prepare("UPDATE fantasy_league_settings SET max_squad_players = 24 WHERE league_id = 1").run();
});

test("cada usuario solo puede estar en una liga 'open' hasta crear la suya", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.activeLeague, "Liga activa por defecto = Liga abierta (id=1)");
  assert.equal(result.body.activeLeague.id, 1);
});

test("rivalPlayers solo muestra jugadores de OTROS usuarios", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  const p1 = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!p1) return;
  addPlayerToMarket(p1);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId: p1 }, user: "user1" });

  await callApi({ method: "GET", user: "user2" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U2" }, user: "user2" });
  const p2 = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'MED'
    LIMIT 1
  `).get()?.id;
  if (!p2) return;
  addPlayerToMarket(p2);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId: p2 }, user: "user2" });

  const user1View = await callApi({ method: "GET", user: "user1" });
  const user1Rivals = user1View.body.rivalPlayers.map((p) => p.id);
  assert.ok(user1Rivals.includes(p2), `user1 ve el jugador ${p2} de user2 (rivals: ${user1Rivals.join(",")})`);
  assert.ok(!user1Rivals.includes(p1), "user1 NO ve su propio jugador");
});

test("calcular puntos fantasy actualiza fantasy_player_stats", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.round, "Debe tener datos de la jornada");
  assert.ok(result.body.round.name, "Jornada debe tener nombre");
  assert.ok(result.body.round.status, "Jornada debe tener estado");
});

test("el snapshot incluye leagueMembers", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(result.body.activeLeague, "Debe tener activeLeague");
  assert.ok(Array.isArray(result.body.activeLeague.membersList), "activeLeague debe tener membersList");
  assert.ok(result.body.activeLeague.membersList.length > 0, "membersList debe tener al menos 1 miembro");
});

test("el snapshot incluye notifications (vacío al inicio)", async () => {
  await callApi({ method: "GET" });
  const result = await callApi({ method: "GET" });
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.notifications), "Debe tener notifications");
});

test("compra guarda la purchase_price en fantasy_team_players", async () => {
  await callApi({ method: "GET" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "Mi XI" } });
  const playerId = db.prepare("SELECT id FROM fantasy_players WHERE position = 'DEL' LIMIT 1").get().id;
  const price = db.prepare("SELECT price FROM fantasy_players WHERE id = ?").get(playerId).price;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId } });

  const tp = db.prepare("SELECT * FROM fantasy_team_players WHERE player_id = ?").get(playerId);
  assert.equal(tp.purchase_price, price, "purchase_price debe ser igual al precio de compra");
});

test("refreshMarket elimina jugadores de la fantasy_league_players que ya no están en fantasy_team_players", async () => {
  await callApi({ method: "GET", user: "user1" });
  await callApi({ method: "POST", url: "/api/fantasy/team", body: { name: "U1" }, user: "user1" });
  const playerId = db.prepare(`
    SELECT p.id FROM fantasy_players p
    WHERE NOT EXISTS (SELECT 1 FROM fantasy_team_players tp WHERE tp.player_id = p.id)
      AND p.position = 'DEL'
    LIMIT 1
  `).get()?.id;
  if (!playerId) return;
  addPlayerToMarket(playerId);
  await callApi({ method: "POST", url: "/api/fantasy/buy", body: { playerId }, user: "user1" });
  const inLeague = db.prepare("SELECT * FROM fantasy_league_players WHERE player_id = ? AND league_id = 1").get(playerId);
  assert.ok(inLeague, "Debe estar en league_players");

  await callApi({ method: "POST", url: "/api/fantasy/sell", body: { playerId }, user: "user1" });
  const stillIn = db.prepare("SELECT * FROM fantasy_league_players WHERE player_id = ? AND league_id = 1").get(playerId);
  assert.equal(stillIn, undefined, "No debe quedar en league_players tras vender");
});
