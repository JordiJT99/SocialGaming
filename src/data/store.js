import { scorePorraEntry } from "../services/porraService";

const STORE_KEY = "playfulbet_data";

const defaultStore = () => ({
  users: [
    {
      id: "current_user",
      username: "Jordi",
      email: "jordi@playfulbet.com",
      points: 1500,
      totalEarned: 1500,
      predictionsCount: 0,
      correctCount: 0,
      accuracy: 0,
      streak: 0,
      bestStreak: 0,
      xp: 2450,
      level: 24,
      joinedAt: new Date().toISOString(),
    },
  ],
  predictions: [],
  leagues: [
    {
      id: "league_1",
      name: "Peña Champions",
      code: "CHAMP24",
      createdBy: "current_user",
      members: [
        { userId: "current_user", joinedAt: new Date().toISOString() },
        { userId: "user2", joinedAt: new Date().toISOString() },
        { userId: "user3", joinedAt: new Date().toISOString() },
        { userId: "user4", joinedAt: new Date().toISOString() },
      ],
    },
  ],
  transactions: [],
  prizesRedeemed: [],
  quinielas: [],
  userQuinielas: [],
  porras: [],
  porraEntries: [],
});

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...defaultStore(), ...data };
    }
  } catch {}
  return defaultStore();
}

export function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getCurrentUser(store) {
  return store.users.find((u) => u.id === "current_user");
}

export function makePrediction(store, matchId, selection, pointsBet, extra = {}) {
  const matchDate = extra.date || extra.matchDate || null;
  const prediction = {
    id: `pred_${Date.now()}`,
    userId: "current_user",
    matchId,
    selection,
    pointsBet,
    pointsWon: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    matchDate,
    ...extra,
  };

  store.predictions.push(prediction);
  const user = getCurrentUser(store);
  user.points -= pointsBet;
  user.predictionsCount += 1;
  user.totalEarned += pointsBet;

  store.transactions.push({
    id: `tx_${Date.now()}`,
    type: "bet",
    amount: -pointsBet,
    description: `Predicción #${matchId}`,
    createdAt: new Date().toISOString(),
  });

  saveStore(store);
  return prediction;
}

export function updatePrediction(store, predictionId, patch) {
  const prediction = store.predictions.find((item) => item.id === predictionId);
  if (!prediction) return null;
  Object.assign(prediction, patch);
  saveStore(store);
  return prediction;
}

export function refundPrediction(store, predictionId, description = "Prediccion cancelada") {
  const prediction = store.predictions.find((item) => item.id === predictionId);
  if (!prediction || prediction.status === "cancelled") return null;
  const user = getCurrentUser(store);
  user.points += prediction.pointsBet;
  prediction.status = "cancelled";
  prediction.pointsWon = 0;
  prediction.cancelledAt = new Date().toISOString();
  store.transactions.push({
    id: `tx_${Date.now()}`,
    type: "refund",
    amount: prediction.pointsBet,
    description,
    createdAt: new Date().toISOString(),
  });
  saveStore(store);
  return prediction;
}

export function resolvePrediction(store, predictionId, matchResult, matchScore = null) {
  const pred = store.predictions.find((p) => p.id === predictionId);
  if (!pred || pred.status !== "pending") return null;

  const user = getCurrentUser(store);
  const isCorrect = pred.selection === matchResult;
  const settledAt = new Date().toISOString();

  const won = isCorrect
    ? Math.round(pred.pointsBet * Number(pred.confirmedOdds || pred.offeredOdds || 1))
    : 0;

  const updatedPred = {
    ...pred,
    matchResult,
    matchScore,
    settledAt,
    pointsWon: won,
    status: isCorrect ? "won" : "lost",
  };

  const updatedUser = { ...user };
  if (isCorrect) {
    updatedUser.points = (user.points || 0) + won;
    updatedUser.totalEarned = (user.totalEarned || 0) + won;
    updatedUser.correctCount = (user.correctCount || 0) + 1;
    updatedUser.streak = (user.streak || 0) + 1;
    if (updatedUser.streak > (user.bestStreak || 0)) updatedUser.bestStreak = updatedUser.streak;
  } else {
    updatedUser.streak = 0;
  }
  updatedUser.accuracy = updatedUser.predictionsCount > 0
    ? Math.round((updatedUser.correctCount / updatedUser.predictionsCount) * 100)
    : 0;

  store.predictions = store.predictions.map((p) => p.id === predictionId ? updatedPred : p);
  store.users = store.users.map((u) => u.id === user.id ? updatedUser : u);

  store.transactions.push({
    id: `tx_${Date.now()}`,
    type: isCorrect ? "win" : "loss",
    amount: won,
    description: isCorrect
      ? `Acierto predicción #${pred.matchId} (+${won})`
      : `Fallaste predicción #${pred.matchId}`,
    createdAt: settledAt,
  });

  saveStore(store);
  return { prediction: updatedPred, user: updatedUser };
}

export function deriveResult(match) {
  if (match.result) return match.result;
  if (!match.score) return null;
  const m = String(match.score).match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!m) return null;
  const home = Number(m[1]);
  const away = Number(m[2]);
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

const Q_ENTRY = 100;
const Q_FEE = 10;
const Q_DIST = [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }];
const hasResolvedTeams = (match) => {
  const text = `${match?.home || ""} ${match?.away || ""}`.trim();
  if (!text) return false;
  return !/\b\d+[a-z]\b|\b\d+[a-z](?:\/\d+[a-z])+\b/i.test(text);
};

export function getQuinielas(store, matches = [], now = Date.now()) {
  const saved = store.quinielas || [];
  const upcoming = matches
    .filter((m) => (m.status === "upcoming" || m.status === "scheduled") && m.sportKey === "football" && hasResolvedTeams(m))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const leagues = [...new Set(upcoming.map((m) => m.league).filter(Boolean))];
  const generated = leagues.map((league, index) => {
    const leagueMatches = upcoming.filter((m) => m.league === league).slice(0, 8);
    const startsAt = leagueMatches[0]?.date;
    return startsAt && {
      id: `auto_${league.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: `Quiniela ${league}`,
      league,
      round: index + 1,
      entryCost: Q_ENTRY,
      platformFeePercentage: Q_FEE,
      matchIds: leagueMatches.map((m) => m.id),
      registrationDeadline: startsAt,
      startsAt,
      endsAt: leagueMatches.at(-1)?.date || startsAt,
      createdAt: startsAt,
    };
  }).filter(Boolean);
  const byId = new Map([...generated, ...saved].map((q) => [q.id, q]));
  return [...byId.values()].map((q) => hydrateQuiniela(store, q, matches, now));
}

export function hydrateQuiniela(store, quiniela, matches = [], now = Date.now()) {
  const entries = (store.userQuinielas || []).filter((u) => u.quinielaId === quiniela.id);
  const qMatches = quiniela.matchIds.map((id) => matches.find((m) => m.id === id)).filter(Boolean);
  const started = new Date(quiniela.startsAt).getTime() <= now || new Date(quiniela.registrationDeadline).getTime() <= now;
  const finished = qMatches.length > 0 && qMatches.every((m) => m.status === "finished");
  const paid = entries.length > 0 && entries.every((e) => e.status === "rewarded");
  const gross = entries.length * quiniela.entryCost;
  return {
    ...quiniela,
    participantsCount: entries.length,
    prizePool: gross,
    finalPrizePool: Math.round(gross * (1 - (quiniela.platformFeePercentage || 0) / 100)),
    status: paid ? "paid" : finished ? "finished" : started ? "in_progress" : "open",
    matches: qMatches,
  };
}

export function joinQuiniela(store, quiniela, userId = "current_user") {
  const q = hydrateQuiniela(store, quiniela);
  if (q.status !== "open") throw new Error("La quiniela ya esta cerrada");
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("Usuario no autenticado");
  if ((user.points || 0) < q.entryCost) throw new Error("No tienes coins suficientes");
  user.points -= q.entryCost;
  store.quinielas = store.quinielas || [];
  if (!store.quinielas.some((item) => item.id === q.id)) store.quinielas.push({ ...q, matches: undefined });
  store.userQuinielas = store.userQuinielas || [];
  store.userQuinielas.push({
    id: `userQuiniela_${Date.now()}`,
    userId,
    quinielaId: q.id,
    selections: {},
    totalPoints: 0,
    correctPredictions: 0,
    position: null,
    prizeWon: 0,
    status: "draft",
    submittedAt: null,
    updatedAt: new Date().toISOString(),
  });
  store.transactions.push({
    id: `tx_${Date.now()}`,
    userId,
    type: "spend",
    source: "quiniela_entry",
    amount: -q.entryCost,
    relatedId: q.id,
    description: `Entrada ${q.name}`,
    createdAt: new Date().toISOString(),
  });
  saveStore(store);
  return q;
}

export function saveUserQuiniela(store, quiniela, selections, userId = "current_user", now = Date.now()) {
  const q = hydrateQuiniela(store, quiniela, [], now);
  if (q.status !== "open") throw new Error("La quiniela ya esta bloqueada");
  if (!quiniela.matchIds.every((id) => ["1", "X", "2"].includes(selections[id]))) throw new Error("Completa todos los partidos");
  const entry = (store.userQuinielas || []).find((u) => u.userId === userId && u.quinielaId === q.id);
  if (!entry) throw new Error("Primero tienes que participar");
  Object.assign(entry, {
    selections: { ...selections },
    status: "submitted",
    submittedAt: entry.submittedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  saveStore(store);
  return entry;
}

export function resolveQuiniela(store, quiniela, matches, userId = "current_user") {
  const q = hydrateQuiniela(store, quiniela, matches);
  if (!["finished", "paid"].includes(q.status)) throw new Error("Aun faltan resultados");
  const entries = (store.userQuinielas || []).filter((u) => u.quinielaId === q.id && u.status !== "draft");
  const ranked = entries.map((entry) => {
    const correct = q.matches.reduce((sum, match) => sum + (entry.selections[match.id] === deriveResult(match) ? 1 : 0), 0);
    return { ...entry, correctPredictions: correct, totalPoints: correct };
  }).sort((a, b) => b.totalPoints - a.totalPoints || new Date(a.submittedAt) - new Date(b.submittedAt));
  const paid = store.transactions.some((tx) => tx.source === "quiniela_prize" && tx.relatedId === q.id);
  ranked.forEach((entry, index) => {
    const position = index + 1;
    const prize = paid ? entry.prizeWon : Math.round(q.finalPrizePool * ((Q_DIST.find((d) => d.position === position)?.percentage || 0) / 100));
    const target = store.userQuinielas.find((u) => u.id === entry.id);
    Object.assign(target, { totalPoints: entry.totalPoints, correctPredictions: entry.correctPredictions, position, prizeWon: prize, status: prize > 0 ? "rewarded" : "resolved" });
    if (!paid && prize > 0) {
      const user = store.users.find((u) => u.id === entry.userId);
      if (user) user.points += prize;
      store.transactions.push({ id: `tx_${Date.now()}_${position}`, userId: entry.userId, type: "earn", source: "quiniela_prize", amount: prize, relatedId: q.id, description: `Premio ${q.name}`, createdAt: new Date().toISOString() });
    }
  });
  saveStore(store);
  return ranked.find((entry) => entry.userId === userId);
}

const P_ENTRY = 50;
const P_FEE = 10;
const P_DIST = [{ position: 1, percentage: 70 }, { position: 2, percentage: 20 }, { position: 3, percentage: 10 }];
const inviteCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export function hydratePorra(store, porra, matches = [], now = Date.now()) {
  const entries = (store.porraEntries || []).filter((entry) => entry.porraId === porra.id);
  const pMatches = porra.matchIds.map((id) => matches.find((match) => match.id === id)).filter(Boolean);
  const started = new Date(porra.startsAt).getTime() <= now || new Date(porra.registrationDeadline).getTime() <= now;
  const finished = pMatches.length > 0 && pMatches.every((match) => match.status === "finished");
  const paid = entries.length > 0 && entries.every((entry) => entry.status === "rewarded");
  const gross = entries.length * porra.entryCost;
  return {
    ...porra,
    matches: pMatches,
    participantsCount: entries.length,
    prizePool: gross,
    finalPrizePool: Math.round(gross * (1 - (porra.platformFeePercentage || 0) / 100)),
    status: porra.status === "cancelled" ? "cancelled" : paid ? "paid" : finished ? "finished" : started ? "in_progress" : "open",
  };
}

export function getPorras(store, matches = [], now = Date.now()) {
  const saved = store.porras || [];
  const upcoming = matches
    .filter((match) => ["upcoming", "scheduled"].includes(match.status) && match.home && match.away)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const generated = upcoming.map((match) => ({
    id: `public_${match.id}`,
    name: `${match.home} vs ${match.away}`,
    description: "Porra publica de marcador exacto",
    type: "single_match",
    visibility: "public",
    createdBy: "platform",
    league: match.league || "Evento",
    matchIds: [match.id],
    entryCost: P_ENTRY,
    platformFeePercentage: P_FEE,
    distribution: P_DIST,
    inviteCode: inviteCode(),
    registrationDeadline: match.date,
    startsAt: match.date,
    endsAt: match.date,
    createdAt: match.date,
    updatedAt: match.date,
  }));
  return [...new Map([...generated, ...saved].map((porra) => [porra.id, porra])).values()]
    .map((porra) => hydratePorra(store, porra, matches, now));
}

export function createPorra(store, data, matches, userId = "current_user") {
  const matchIds = Array.isArray(data.matchIds) ? data.matchIds.filter(Boolean) : [data.matchId].filter(Boolean);
  const pMatches = matchIds.map((id) => matches.find((match) => match.id === id)).filter(Boolean);
  if (!pMatches.length) throw new Error("Selecciona al menos un partido");
  const startsAt = pMatches.map((match) => match.date).sort()[0];
  const entryCost = Math.max(0, Number(data.entryCost || P_ENTRY));
  const porra = {
    id: `porra_${Date.now()}`,
    name: data.name?.trim() || `Porra ${pMatches[0].home} vs ${pMatches[0].away}`,
    description: data.description?.trim() || "",
    type: matchIds.length > 1 ? "round" : "single_match",
    visibility: data.visibility || "private",
    createdBy: userId,
    league: pMatches[0].league || "Evento",
    matchIds,
    entryCost,
    platformFeePercentage: P_FEE,
    distribution: P_DIST,
    status: "open",
    inviteCode: inviteCode(),
    registrationDeadline: startsAt,
    startsAt,
    endsAt: pMatches.at(-1)?.date || startsAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.porras = [...(store.porras || []), porra];
  saveStore(store);
  return porra;
}

export function joinPorra(store, porra, userId = "current_user", invite = null) {
  const p = hydratePorra(store, porra);
  if (p.visibility === "private" && invite && invite !== p.inviteCode) throw new Error("Codigo de invitacion no valido");
  if (p.status !== "open") throw new Error("La porra ya esta cerrada");
  if ((store.porraEntries || []).some((entry) => entry.userId === userId && entry.porraId === p.id)) return p;
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new Error("Usuario no autenticado");
  if ((user.points || 0) < p.entryCost) throw new Error("No tienes coins suficientes");
  user.points -= p.entryCost;
  store.porras = store.porras || [];
  if (!store.porras.some((item) => item.id === p.id)) store.porras.push({ ...p, matches: undefined });
  store.porraEntries = store.porraEntries || [];
  store.porraEntries.push({
    id: `porraEntry_${Date.now()}`,
    porraId: p.id,
    userId,
    predictions: {},
    points: 0,
    exactScores: 0,
    correctWinners: 0,
    position: null,
    prizeWon: 0,
    status: "joined",
    joinedAt: new Date().toISOString(),
    submittedAt: null,
    updatedAt: new Date().toISOString(),
  });
  store.transactions.push({ id: `tx_${Date.now()}`, userId, type: "spend", source: "porra_entry", amount: -p.entryCost, relatedId: p.id, description: `Entrada ${p.name}`, createdAt: new Date().toISOString() });
  saveStore(store);
  return p;
}

export function savePorraPrediction(store, porra, predictions, userId = "current_user") {
  const p = hydratePorra(store, porra);
  if (p.status !== "open") throw new Error("La porra ya esta bloqueada");
  const entry = (store.porraEntries || []).find((item) => item.userId === userId && item.porraId === p.id);
  if (!entry) throw new Error("Primero tienes que participar");
  if (!porra.matchIds.every((id) => Number.isInteger(Number(predictions[id]?.homeScore)) && Number.isInteger(Number(predictions[id]?.awayScore)))) {
    throw new Error("Completa todos los marcadores");
  }
  Object.assign(entry, { predictions, status: "submitted", submittedAt: entry.submittedAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  saveStore(store);
  return entry;
}

export function resolvePorra(store, porra, matches) {
  const p = hydratePorra(store, porra, matches);
  if (!["finished", "paid"].includes(p.status)) throw new Error("Aun faltan resultados");
  const paid = store.transactions.some((tx) => tx.source === "porra_prize" && tx.relatedId === p.id);
  const ranked = (store.porraEntries || [])
    .filter((entry) => entry.porraId === p.id && entry.status !== "joined")
    .map((entry) => ({ ...entry, ...scorePorraEntry(entry, p, matches) }))
    .sort((a, b) => b.points - a.points || b.exactScores - a.exactScores || b.correctWinners - a.correctWinners || new Date(a.submittedAt) - new Date(b.submittedAt));
  ranked.forEach((entry, index) => {
    const position = index + 1;
    const prize = paid ? entry.prizeWon : Math.round(p.finalPrizePool * ((p.distribution || P_DIST).find((item) => item.position === position)?.percentage || 0) / 100);
    const target = store.porraEntries.find((item) => item.id === entry.id);
    Object.assign(target, { points: entry.points, exactScores: entry.exactScores, correctWinners: entry.correctWinners, position, prizeWon: prize, status: prize > 0 ? "rewarded" : "resolved" });
    if (!paid && prize > 0) {
      const user = store.users.find((item) => item.id === entry.userId);
      if (user) user.points += prize;
      store.transactions.push({ id: `tx_${Date.now()}_${position}`, userId: entry.userId, type: "earn", source: "porra_prize", amount: prize, relatedId: p.id, description: `Premio ${p.name}`, createdAt: new Date().toISOString() });
    }
  });
  saveStore(store);
  return ranked;
}

export function computeLevel(xp) {
  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;
  const xpForNext = 100;
  return { level, xpInLevel, xpForNext };
}

export function awardXP(store, amount) {
  const user = getCurrentUser(store);
  if (!user) return null;
  const newXp = (user.xp || 0) + amount;
  const { level, xpInLevel, xpForNext } = computeLevel(newXp);
  const updated = { ...user, xp: newXp, level, _xpInLevel: xpInLevel, _xpForNext: xpForNext };
  store.users = store.users.map((u) => u.id === user.id ? updated : u);
  return updated;
}

export function getStalePendingPredictions(store, now = Date.now()) {
  return store.predictions
    .filter((p) => {
      if (p.status !== "pending") return false;
      const matchTime = p.matchDate ? new Date(p.matchDate).getTime() : null;
      if (!matchTime) return false;
      return now - matchTime > 3 * 60 * 60 * 1000;
    })
    .map((p) => ({ ...p }));
}

export function expireOldPrediction(store, predictionId) {
  const pred = store.predictions.find((p) => p.id === predictionId);
  if (!pred || pred.status !== "pending") return null;
  const user = getCurrentUser(store);
  const refund = pred.pointsBet;
  const updatedPred = { ...pred, status: "expired", settledAt: new Date().toISOString(), pointsWon: 0 };
  const updatedUser = {
    ...user,
    points: (user.points || 0) + refund,
    accuracy: user.predictionsCount > 0
      ? Math.round((user.correctCount / user.predictionsCount) * 100)
      : 0,
  };
  store.predictions = store.predictions.map((p) => p.id === predictionId ? updatedPred : p);
  store.users = store.users.map((u) => u.id === user.id ? updatedUser : u);
  store.transactions.push({
    id: `tx_${Date.now()}`,
    type: "refund",
    amount: refund,
    description: `Reembolso por partido no resuelto: #${pred.matchId}`,
    createdAt: updatedPred.settledAt,
  });
  saveStore(store);
  return { prediction: updatedPred, user: updatedUser };
}

export function createLeague(store, name) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const league = {
    id: `league_${Date.now()}`,
    name,
    code,
    createdBy: "current_user",
    members: [{ userId: "current_user", joinedAt: new Date().toISOString() }],
  };
  store.leagues.push(league);
  saveStore(store);
  return league;
}

export function joinLeague(store, code) {
  const league = store.leagues.find((l) => l.code === code);
  if (!league) return null;
  if (league.members.some((m) => m.userId === "current_user")) return league;
  league.members.push({ userId: "current_user", joinedAt: new Date().toISOString() });
  saveStore(store);
  return league;
}

export function getUserPredictions(store, userId = "current_user") {
  return store.predictions
    .filter((p) => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getUserHistory(store, matches, userId = "current_user") {
  return store.predictions
    .filter((p) => p.userId === userId)
    .map((p) => {
      const match = matches.find((m) => m.id === p.matchId);
      return { ...p, match };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getLeagueRanking(store, leagueId, allUsers) {
  const league = store.leagues.find((l) => l.id === leagueId);
  if (!league) return [];

  return league.members
    .map((m) => {
      const user = allUsers.find((u) => u.id === m.userId) || store.users.find((u) => u.id === m.userId);
      return user;
    })
    .filter(Boolean)
    .sort((a, b) => b.points - a.points)
    .map((u, i) => ({ ...u, rank: i + 1 }));
}
