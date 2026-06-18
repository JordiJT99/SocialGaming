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

export function makePrediction(store, matchId, selection, pointsBet) {
  const prediction = {
    id: `pred_${Date.now()}`,
    userId: "current_user",
    matchId,
    selection,
    pointsBet,
    pointsWon: 0,
    status: "pending",
    createdAt: new Date().toISOString(),
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

  return prediction;
}

export function resolvePrediction(store, predictionId, matchResult) {
  const pred = store.predictions.find((p) => p.id === predictionId);
  if (!pred || pred.status !== "pending") return;

  const user = getCurrentUser(store);
  const isCorrect = pred.selection === matchResult;

  if (isCorrect) {
    const multiplier = pred.selection === "X" ? 3 : 2;
    const won = pred.pointsBet * multiplier;
    pred.pointsWon = won;
    pred.status = "won";
    user.points += won;
    user.correctCount += 1;
    user.streak += 1;
    if (user.streak > user.bestStreak) user.bestStreak = user.streak;

    store.transactions.push({
      id: `tx_${Date.now()}`,
      type: "win",
      amount: won,
      description: `Acierto predicción #${pred.matchId}`,
      createdAt: new Date().toISOString(),
    });
  } else {
    pred.pointsWon = 0;
    pred.status = "lost";
    user.streak = 0;

    store.transactions.push({
      id: `tx_${Date.now()}`,
      type: "loss",
      amount: 0,
      description: `Fallaste predicción #${pred.matchId}`,
      createdAt: new Date().toISOString(),
    });
  }

  user.accuracy = user.predictionsCount > 0
    ? Math.round((user.correctCount / user.predictionsCount) * 100)
    : 0;

  saveStore(store);
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
