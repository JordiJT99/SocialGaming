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
