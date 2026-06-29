import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
  key: (i) => Array.from(memory.keys())[i] || null,
  get length() { return memory.size; },
};

const {
  createLeague, joinLeague, leaveLeague, getLeagueMemberStats,
  getLeagueRankingV2, getLeagueActivity, recordLeagueActivity,
  makePrediction, resolvePrediction,
} = await import("../src/data/store.js");

beforeEach(() => {
  memory.clear();
});

function setupStore() {
  return {
    users: [{
      id: "current_user",
      username: "Tester",
      points: 100000,
      totalEarned: 100000,
      predictionsCount: 0,
      correctCount: 0,
      accuracy: 0,
      streak: 0,
      bestStreak: 0,
      xp: 0,
      level: 1,
      joinedAt: new Date().toISOString(),
    }],
    predictions: [],
    leagues: [],
    leagueActivity: [],
    transactions: [],
    quinielas: [],
    userQuinielas: [],
    porras: [],
    porraEntries: [],
    fantasyTeams: {},
  };
}

function addUser(store, id, username, points = 1000) {
  store.users.push({ id, username, points, predictionsCount: 0, correctCount: 0, accuracy: 0, streak: 0, bestStreak: 0, totalEarned: points });
}

beforeEach(() => {});

test("createLeague: crea liga de predicciones con código único", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Test Liga", type: "predictions", visibility: "private" });
  assert.equal(league.name, "Test Liga");
  assert.equal(league.type, "predictions");
  assert.equal(league.visibility, "private");
  assert.equal(league.status, "open");
  assert.equal(league.code.length, 6);
  assert.equal(league.members.length, 1);
  assert.equal(league.members[0].role, "owner");
  assert.equal(league.scoringConfig.predictionWeight, 1);
  assert.equal(store.leagueActivity.length, 1);
  assert.equal(store.leagueActivity[0].type, "league_created");
});

test("createLeague: tipo inválido cae a predictions por defecto", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Test", type: "invalid" });
  assert.equal(league.type, "predictions");
});

test("createLeague: tipo mixed guarda scoringConfig completo", () => {
  const store = setupStore();
  const league = createLeague(store, {
    name: "Mixta", type: "mixed",
    scoringConfig: { predictionWeight: 2, fantasyWeight: 1, quinielaWeight: 0.5, porraWeight: 0 },
  });
  assert.equal(league.scoringConfig.predictionWeight, 2);
  assert.equal(league.scoringConfig.fantasyWeight, 1);
  assert.equal(league.scoringConfig.quinielaWeight, 0.5);
  assert.equal(league.scoringConfig.porraWeight, 0);
});

test("createLeague: con entryCost descuenta coins y suma al prize pool", () => {
  const store = setupStore();
  const before = store.users[0].points;
  const league = createLeague(store, { name: "Cara", type: "predictions", entryCost: 500 });
  assert.equal(store.users[0].points, before - 500);
  assert.equal(league.prizePool, 500);
  assert.equal(league.entryCost, 500);
  assert.equal(store.transactions.length, 1);
  assert.equal(store.transactions[0].amount, -500);
});

test("createLeague: falla si no hay coins suficientes", () => {
  const store = setupStore();
  store.users[0].points = 100;
  assert.throws(() => createLeague(store, { name: "Cara", type: "predictions", entryCost: 500 }), /coins/i);
});

test("joinLeague: une con código válido", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Test", code: "ABCDEF", visibility: "public" });
  store.leagues[0] = league;
  addUser(store, "user2", "Other");
  const result = joinLeague(store, "ABCDEF", "user2");
  assert.equal(result.members.length, 2);
  assert.ok(result.members.some((m) => m.userId === "user2"));
});

test("joinLeague: falla con código inválido", () => {
  const store = setupStore();
  createLeague(store, { name: "Test" });
  assert.throws(() => joinLeague(store, "NOPE12"), /no v/i);
});

test("joinLeague: evita duplicar miembro", () => {
  const store = setupStore();
  createLeague(store, { name: "Test", code: "TEST12", visibility: "public" });
  const result = joinLeague(store, "TEST12", "current_user");
  assert.equal(result.members.length, 1, "no debe duplicar al current_user");
});

test("joinLeague: respeta maxMembers", () => {
  const store = setupStore();
  createLeague(store, { name: "Test", code: "TEST12", visibility: "public", maxMembers: 2 });
  addUser(store, "user2", "Other2");
  addUser(store, "user3", "Other3");
  joinLeague(store, "TEST12", "user2");
  assert.equal(store.leagues[0].members.length, 2, "owner + user2 = 2");
  addUser(store, "user4", "Other4");
  assert.throws(() => joinLeague(store, "TEST12", "user4"), /completa/i);
});

test("joinLeague: con entryCost descuenta coins y suma al prize pool", () => {
  const store = setupStore();
  createLeague(store, { name: "Test", code: "TEST12", visibility: "public", entryCost: 1000 });
  addUser(store, "user2", "Rich", 5000);
  const before = store.users.find((u) => u.id === "user2").points;
  joinLeague(store, "TEST12", "user2");
  assert.equal(store.users.find((u) => u.id === "user2").points, before - 1000, "user2 pierde 1000 coins");
  assert.equal(store.leagues[0].prizePool, 2000, "prizePool suma entryCost del creador + entryCost del miembro");
});

test("leaveLeague: saca a un miembro", () => {
  const store = setupStore();
  createLeague(store, { name: "Test", code: "TEST12", visibility: "public" });
  addUser(store, "user2", "Other");
  joinLeague(store, "TEST12");
  leaveLeague(store, store.leagues[0].id, "user2");
  assert.equal(store.leagues[0].members.length, 1);
});

test("leaveLeague: owner no puede salir", () => {
  const store = setupStore();
  createLeague(store, { name: "Test" });
  assert.throws(() => leaveLeague(store, store.leagues[0].id, "current_user"), /propietario/i);
});

test("getLeagueMemberStats: suma puntos de predicciones resueltas del usuario", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Test" });
  const pred1 = makePrediction(store, "m1", "1", 100, { offeredOdds: 2.0 });
  const pred2 = makePrediction(store, "m2", "X", 50, { offeredOdds: 3.0 });
  const pred3 = makePrediction(store, "m3", "2", 200, { offeredOdds: 1.5 });
  resolvePrediction(store, pred1.id, "1", "1-0");
  resolvePrediction(store, pred2.id, "1", "1-0");
  resolvePrediction(store, pred3.id, "1", "1-0");
  const stats = getLeagueMemberStats(store, league.id, "current_user", []);
  assert.equal(stats.totalPreds, 3);
  assert.equal(stats.correct, 1);
  assert.equal(stats.failed, 2);
  assert.equal(stats.predictionTotal, 200);
  assert.equal(stats.accuracy, 33);
  assert.equal(stats.total, 200);
});

test("getLeagueMemberStats: liga de tipo fantasy suma puntos de fantasy", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Fantasy", type: "fantasy" });
  store.fantasyTeams["current_user:1"] = {
    user_id: "current_user:1", owner_user_id: "current_user",
    total_points: 1500, round_points: 200,
  };
  const stats = getLeagueMemberStats(store, league.id, "current_user", []);
  assert.equal(stats.fantasyTotal, 1500);
  assert.equal(stats.total, 1500);
});

test("getLeagueMemberStats: liga mixta pondera con scoringConfig", () => {
  const store = setupStore();
  const league = createLeague(store, {
    name: "Mixta", type: "mixed",
    scoringConfig: { predictionWeight: 1, fantasyWeight: 2, quinielaWeight: 1, porraWeight: 1 },
  });
  store.fantasyTeams["current_user:1"] = {
    user_id: "current_user:1", owner_user_id: "current_user",
    total_points: 1000, round_points: 0,
  };
  const pred = makePrediction(store, "m1", "1", 100, { offeredOdds: 2.0 });
  resolvePrediction(store, pred.id, "1", "1-0");
  const stats = getLeagueMemberStats(store, league.id, "current_user", []);
  assert.equal(stats.predictionTotal, 200);
  assert.equal(stats.fantasyTotal, 1000);
  assert.equal(stats.total, 200 * 1 + 1000 * 2);
});

test("getLeagueRankingV2: ordena por puntos mixtos descendente", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "Rank", type: "mixed", code: "RANK01", visibility: "public" });
  addUser(store, "user2", "Second", 5000);
  addUser(store, "user3", "Third", 3000);
  addUser(store, "user4", "Fourth", 1000);
  store.fantasyTeams["current_user:1"] = { user_id: "current_user:1", owner_user_id: "current_user", total_points: 2000, round_points: 0 };
  store.fantasyTeams["user2:1"] = { user_id: "user2:1", owner_user_id: "user2", total_points: 4000, round_points: 0 };
  store.fantasyTeams["user3:1"] = { user_id: "user3:1", owner_user_id: "user3", total_points: 1500, round_points: 0 };
  store.fantasyTeams["user4:1"] = { user_id: "user4:1", owner_user_id: "user4", total_points: 0, round_points: 0 };
  joinLeague(store, "RANK01", "user2");
  joinLeague(store, "RANK01", "user3");
  joinLeague(store, "RANK01", "user4");
  const ranking = getLeagueRankingV2(store, league.id, [], [
    { id: "current_user", username: "Tester" },
    { id: "user2", username: "Second" },
    { id: "user3", username: "Third" },
    { id: "user4", username: "Fourth" },
  ]);
  assert.equal(ranking.length, 4);
  assert.equal(ranking[0].userId, "user2");
  assert.equal(ranking[0].position, 1);
  assert.equal(ranking[1].userId, "current_user");
  assert.equal(ranking[2].userId, "user3");
  assert.equal(ranking[3].userId, "user4");
});

test("getLeagueActivity: devuelve últimas N actividades", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "L" });
  recordLeagueActivity(store, league.id, "u1", "joined", "se unió");
  recordLeagueActivity(store, league.id, "u2", "joined", "se unió");
  recordLeagueActivity(store, league.id, "u3", "joined", "se unió");
  const acts = getLeagueActivity(store, league.id, 2);
  assert.equal(acts.length, 2);
  assert.equal(acts[0].userId, "u3");
  assert.equal(acts[1].userId, "u2");
});

test("Predictions: predicciones pendientes no suman puntos", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "P" });
  const pred = makePrediction(store, "m1", "1", 100, { offeredOdds: 2.0 });
  const stats = getLeagueMemberStats(store, league.id, "current_user", []);
  assert.equal(stats.total, 0, "predicción pendiente no debe sumar puntos");
  assert.equal(stats.pending, 1);
});

test("Predictions: liga filtra por competición", () => {
  const store = setupStore();
  const league = createLeague(store, { name: "L", type: "predictions", competition: "LaLiga" });
  const pred = makePrediction(store, "m1", "1", 100, { offeredOdds: 2.0 });
  resolvePrediction(store, pred.id, "1", "1-0");
  const matches = [{ id: "m1", league: "LaLiga" }];
  const stats = getLeagueMemberStats(store, league.id, "current_user", matches);
  assert.equal(stats.predictionTotal, 200, "predicción de LaLiga debe contar");
  const otherMatches = [{ id: "m1", league: "Premier League" }];
  const stats2 = getLeagueMemberStats(store, league.id, "current_user", otherMatches);
  assert.equal(stats2.predictionTotal, 0, "predicción de Premier no debe contar");
});
