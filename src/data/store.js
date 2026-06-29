import { scorePorraEntry } from "../services/porraService.js";

const STORE_KEY = "playfulbet_data";
const AUTH_USER_KEY = "playfulbet_auth_user";

const DEFAULT_LEAGUE_SCORING = {
  predictionWeight: 1,
  fantasyWeight: 1,
  quinielaWeight: 1,
  porraWeight: 1,
};

const DAILY_REWARD_TABLE = [25, 30, 35, 40, 50, 70, 100];
const DAILY_VIDEO_LIMIT = 5;
const VIDEO_REWARD = 15;

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
      rewardStreak: 0,
      lastRewardClaimAt: null,
    },
  ],
  predictions: [],
  leagues: [
    {
      id: "league_1",
      name: "Peña Champions",
      code: "CHAMP24",
      type: "predictions",
      visibility: "private",
      competition: "all",
      description: "Liga de prueba entre amigos para Champions League",
      createdBy: "current_user",
      ownerId: "current_user",
      entryCost: 0,
      maxMembers: 20,
      prizePool: 0,
      status: "active",
      scoringConfig: { ...DEFAULT_LEAGUE_SCORING },
      startDate: new Date().toISOString(),
      endDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [
        { userId: "current_user", joinedAt: new Date().toISOString(), role: "owner" },
        { userId: "user2", joinedAt: new Date().toISOString(), role: "member" },
        { userId: "user3", joinedAt: new Date().toISOString(), role: "member" },
        { userId: "user4", joinedAt: new Date().toISOString(), role: "member" },
      ],
    },
  ],
  leagueActivity: [],
  transactions: [],
  prizesRedeemed: [],
  rewardActivity: {
    videoClaims: [],
    completedOffers: [],
  },
  quinielas: [],
  userQuinielas: [],
  porras: [],
  porraEntries: [],
});

const scopedStoreKey = () => {
  try {
    const authUser = localStorage.getItem(AUTH_USER_KEY);
    return authUser ? `${STORE_KEY}:${authUser}` : STORE_KEY;
  } catch {
    return STORE_KEY;
  }
};

export function setActiveAuthUser(user) {
  try {
    if (user?.email) localStorage.setItem(AUTH_USER_KEY, user.email.toLowerCase());
    else localStorage.removeItem(AUTH_USER_KEY);
  } catch {}
}

export function loadStore() {
  try {
    const raw = localStorage.getItem(scopedStoreKey());
    if (raw) {
      const data = JSON.parse(raw);
      return { ...defaultStore(), ...data };
    }
  } catch {}
  return defaultStore();
}

export function saveStore(store) {
  localStorage.setItem(scopedStoreKey(), JSON.stringify(store));
}

const dayKey = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);

const isPreviousDay = (older, newer) => {
  const olderDate = new Date(older);
  const newerDate = new Date(newer);
  olderDate.setHours(0, 0, 0, 0);
  newerDate.setHours(0, 0, 0, 0);
  return newerDate.getTime() - olderDate.getTime() === 24 * 60 * 60 * 1000;
};

function ensureRewardState(store) {
  if (!store.rewardActivity) {
    store.rewardActivity = { videoClaims: [], completedOffers: [] };
  }
  if (!Array.isArray(store.rewardActivity.videoClaims)) store.rewardActivity.videoClaims = [];
  if (!Array.isArray(store.rewardActivity.completedOffers)) store.rewardActivity.completedOffers = [];
  if (!Array.isArray(store.prizesRedeemed)) store.prizesRedeemed = [];
}

function rewardTransaction(store, type, amount, description, metadata = {}) {
  store.transactions.push({
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    amount,
    description,
    createdAt: new Date().toISOString(),
    ...metadata,
  });
}

export function getRewardStatus(store, now = Date.now()) {
  ensureRewardState(store);
  const user = getCurrentUser(store);
  const today = dayKey(now);
  const videoClaimsToday = store.rewardActivity.videoClaims.filter((item) => dayKey(item.claimedAt) === today);
  const completedOffers = new Set(store.rewardActivity.completedOffers.map((item) => item.offerId));
  return {
    currentCoins: user?.points || 0,
    streak: user?.rewardStreak || 0,
    dailyAvailable: !user?.lastRewardClaimAt || dayKey(user.lastRewardClaimAt) !== today,
    dailyReward: DAILY_REWARD_TABLE[Math.min(user?.rewardStreak || 0, DAILY_REWARD_TABLE.length - 1)],
    videoClaimsToday: videoClaimsToday.length,
    videoClaimsRemaining: Math.max(0, DAILY_VIDEO_LIMIT - videoClaimsToday.length),
    videoReward: VIDEO_REWARD,
    completedOffers,
    totalRedeemed: (store.prizesRedeemed || []).length,
  };
}

export function claimDailyReward(store, now = Date.now()) {
  ensureRewardState(store);
  const user = getCurrentUser(store);
  if (!user) throw new Error("Usuario no encontrado");
  if (user.lastRewardClaimAt && dayKey(user.lastRewardClaimAt) === dayKey(now)) {
    throw new Error("La recompensa diaria ya está reclamada");
  }
  const nextStreak = user.lastRewardClaimAt && isPreviousDay(user.lastRewardClaimAt, now)
    ? (user.rewardStreak || 0) + 1
    : 1;
  const reward = DAILY_REWARD_TABLE[Math.min(nextStreak - 1, DAILY_REWARD_TABLE.length - 1)];
  user.rewardStreak = nextStreak;
  user.lastRewardClaimAt = new Date(now).toISOString();
  user.points = (user.points || 0) + reward;
  user.totalEarned = (user.totalEarned || 0) + reward;
  rewardTransaction(store, "earn", reward, `Bonus diario racha ${nextStreak}`, { source: "daily_reward" });
  saveStore(store);
  return { reward, streak: nextStreak };
}

export function claimVideoReward(store, now = Date.now()) {
  ensureRewardState(store);
  const today = dayKey(now);
  const claimsToday = store.rewardActivity.videoClaims.filter((item) => dayKey(item.claimedAt) === today);
  if (claimsToday.length >= DAILY_VIDEO_LIMIT) {
    throw new Error("Ya has agotado los videos de hoy");
  }
  const user = getCurrentUser(store);
  if (!user) throw new Error("Usuario no encontrado");
  const claim = {
    id: `video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    claimedAt: new Date(now).toISOString(),
    amount: VIDEO_REWARD,
  };
  store.rewardActivity.videoClaims.push(claim);
  user.points = (user.points || 0) + VIDEO_REWARD;
  user.totalEarned = (user.totalEarned || 0) + VIDEO_REWARD;
  rewardTransaction(store, "earn", VIDEO_REWARD, "Video recompensado", { source: "rewarded_video" });
  saveStore(store);
  return claim;
}

export function completeOfferReward(store, offer, now = Date.now()) {
  ensureRewardState(store);
  if (!offer?.id || !offer?.reward) throw new Error("Oferta inválida");
  if (store.rewardActivity.completedOffers.some((item) => item.offerId === offer.id)) {
    throw new Error("Esta oferta ya está completada");
  }
  const user = getCurrentUser(store);
  if (!user) throw new Error("Usuario no encontrado");
  const completed = {
    offerId: offer.id,
    title: offer.title,
    reward: Number(offer.reward),
    completedAt: new Date(now).toISOString(),
  };
  store.rewardActivity.completedOffers.push(completed);
  user.points = (user.points || 0) + completed.reward;
  user.totalEarned = (user.totalEarned || 0) + completed.reward;
  rewardTransaction(store, "earn", completed.reward, `Oferta completada: ${offer.title}`, { source: "offerwall", relatedId: offer.id });
  saveStore(store);
  return completed;
}

export function redeemPrize(store, prize, now = Date.now()) {
  ensureRewardState(store);
  const cost = Number(prize?.cost || 0);
  if (!prize?.id || !prize?.name || cost <= 0) throw new Error("Premio inválido");
  const user = getCurrentUser(store);
  if (!user) throw new Error("Usuario no encontrado");
  if ((user.points || 0) < cost) throw new Error("No tienes coins suficientes");
  user.points -= cost;
  const redemption = {
    id: `reward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    rewardId: prize.id,
    name: prize.name,
    cost,
    status: prize.deliveryType === "digital" ? "processing" : "coming_soon",
    deliveryType: prize.deliveryType || "digital",
    createdAt: new Date(now).toISOString(),
  };
  store.prizesRedeemed.unshift(redemption);
  rewardTransaction(store, "spend", -cost, `Canje: ${prize.name}`, { source: "reward_redeem", relatedId: prize.id });
  saveStore(store);
  return redemption;
}

export function getCurrentUser(store) {
  return store.users.find((u) => u.id === "current_user");
}

export function makePrediction(store, matchId, selection, pointsBet, extra = {}) {
  const matchDate = extra.date || extra.matchDate || null;
  const prediction = {
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

export function createLeague(store, input) {
  const now = new Date().toISOString();
  const name = (typeof input === "string" ? input : input?.name || "Liga").trim().slice(0, 60) || "Liga";
  const type = ["predictions", "mixed", "fantasy"].includes(input?.type) ? input.type : "predictions";
  const visibility = ["public", "private"].includes(input?.visibility) ? input.visibility : "private";
  const competition = input?.competition || "all";
  const entryCost = Math.max(0, Number(input?.entryCost) || 0);
  const maxMembers = input?.maxMembers ? Math.max(2, Number(input.maxMembers)) : null;
  const description = String(input?.description || "").trim().slice(0, 200);
  const startDate = input?.startDate || now;
  const endDate = input?.endDate || null;
  const scoringConfig = {
    predictionWeight: input?.scoringConfig?.predictionWeight !== undefined ? Number(input.scoringConfig.predictionWeight) : 1,
    fantasyWeight: input?.scoringConfig?.fantasyWeight !== undefined ? Number(input.scoringConfig.fantasyWeight) : 1,
    quinielaWeight: input?.scoringConfig?.quinielaWeight !== undefined ? Number(input.scoringConfig.quinielaWeight) : 1,
    porraWeight: input?.scoringConfig?.porraWeight !== undefined ? Number(input.scoringConfig.porraWeight) : 1,
  };

  const user = store.users.find((u) => u.id === "current_user");
  if (user && entryCost > 0) {
    if ((user.points || 0) < entryCost) throw new Error("No tienes coins suficientes para crear esta liga");
    user.points -= entryCost;
    store.transactions.push({
      id: `tx_${Date.now()}_league`,
      type: "spend",
      amount: -entryCost,
      description: `Coste de entrada liga "${name}"`,
      createdAt: now,
    });
  }

  const league = {
    id: `league_${Date.now()}`,
    name,
    code: input?.code || Math.random().toString(36).substring(2, 8).toUpperCase(),
    type,
    visibility,
    competition,
    description,
    createdBy: "current_user",
    ownerId: "current_user",
    entryCost,
    maxMembers,
    prizePool: entryCost,
    status: "open",
    scoringConfig,
    startDate,
    endDate,
    createdAt: now,
    updatedAt: now,
    members: [{ userId: "current_user", joinedAt: now, role: "owner" }],
  };
  store.leagues.push(league);
  if (!store.leagueActivity) store.leagueActivity = [];
  store.leagueActivity.unshift({
    id: `act_${Date.now()}`,
    leagueId: league.id,
    userId: "current_user",
    type: "league_created",
    message: `creó la liga "${name}"`,
    createdAt: now,
  });
  saveStore(store);
  return league;
}

export function joinLeague(store, code, userId = "current_user") {
  const normalized = String(code || "").trim().toUpperCase();
  const league = (store.leagues || []).find((l) => l.code === normalized);
  if (!league) throw new Error("Código de liga no válido");

  const now = new Date().toISOString();
  if (league.status === "finished" || league.status === "cancelled") throw new Error("La liga está cerrada");
  if (league.members.some((m) => m.userId === userId)) return league;
  if (league.maxMembers && league.members.length >= league.maxMembers) throw new Error("Liga completa");
  if (league.entryCost > 0) {
    const user = store.users.find((u) => u.id === userId);
    if (!user || (user.points || 0) < league.entryCost) throw new Error("No tienes coins suficientes");
    user.points -= league.entryCost;
    league.prizePool = (league.prizePool || 0) + league.entryCost;
    store.transactions.push({
      id: `tx_${Date.now()}_join`,
      type: "spend",
      amount: -league.entryCost,
      description: `Entrada liga "${league.name}"`,
      createdAt: now,
    });
  }

  league.members.push({ userId, joinedAt: now, role: "member" });
  league.updatedAt = now;
  if (!store.leagueActivity) store.leagueActivity = [];
  store.leagueActivity.unshift({
    id: `act_${Date.now()}_join`,
    leagueId: league.id,
    userId,
    type: "joined",
    message: `se unió a "${league.name}"`,
    createdAt: now,
  });
  saveStore(store);
  return league;
}

export function leaveLeague(store, leagueId, userId = "current_user") {
  const league = (store.leagues || []).find((l) => l.id === leagueId);
  if (!league) return null;
  if (league.ownerId === userId) throw new Error("El propietario no puede salir de la liga");
  league.members = league.members.filter((m) => m.userId !== userId);
  if (!store.leagueActivity) store.leagueActivity = [];
  store.leagueActivity.unshift({
    id: `act_${Date.now()}_leave`,
    leagueId,
    userId,
    type: "left",
    message: `salió de "${league.name}"`,
    createdAt: new Date().toISOString(),
  });
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

function withinLeagueWindow(prediction, league) {
  if (!league) return true;
  const startTs = league.startDate ? new Date(league.startDate).getTime() : 0;
  const endTs = league.endDate ? new Date(league.endDate).getTime() : Infinity;
  const created = prediction.createdAt ? new Date(prediction.createdAt).getTime() : 0;
  if (startTs && created < startTs) return false;
  if (endTs && created > endTs) return false;
  return true;
}

function inCompetition(prediction, matches, competition) {
  if (!competition || competition === "all") return true;
  const match = matches.find((m) => m.id === prediction.matchId);
  if (!match) return true;
  const league = (match.league || "").toLowerCase();
  const comp = String(competition).toLowerCase();
  if (comp.includes("laliga") || comp === "la_liga") return league.includes("la liga") || league.includes("laliga");
  if (comp.includes("champion")) return league.includes("champion");
  if (comp.includes("premier")) return league.includes("premier");
  if (comp.includes("serie a") || comp === "seriea") return league.includes("serie a");
  if (comp.includes("bundesliga") || comp === "bundesliga") return league.includes("bundesliga");
  return league.includes(comp);
}

function computePredictionPoints(store, userId, matches = [], competition = "all") {
  const preds = (store.predictions || []).filter((p) => p.userId === userId);
  let total = 0;
  let roundTotal = 0;
  let totalPreds = 0;
  let correct = 0;
  let failed = 0;
  let pending = 0;
  const now = Date.now();
  for (const p of preds) {
    if (!inCompetition(p, matches, competition)) continue;
    totalPreds += 1;
    if (p.status === "won") {
      total += p.pointsWon || 0;
      correct += 1;
    } else if (p.status === "lost") {
      failed += 1;
    } else {
      pending += 1;
      const match = matches.find((m) => m.id === p.matchId);
      const matchTs = match?.date ? new Date(match.date).getTime() : 0;
      if (matchTs > 0 && matchTs < now && matchTs > now - 7 * 86400000) roundTotal += (p.pointsWon || 0);
    }
  }
  return {
    total,
    round: roundTotal,
    totalPreds,
    correct,
    failed,
    pending,
    accuracy: totalPreds > 0 ? Math.round((correct / totalPreds) * 100) : 0,
  };
}

function computeFantasyPoints(store, userId) {
  let total = 0;
  let round = 0;
  if (!store.fantasyTeams) return { total, round };
  for (const team of Object.values(store.fantasyTeams)) {
    if (team?.owner_user_id !== userId && team?.user_id !== userId) continue;
    total += team.total_points || 0;
    round += team.round_points || 0;
  }
  return { total, round };
}

function computeQuinielaPoints(store, userId) {
  let total = 0;
  for (const uq of (store.userQuinielas || [])) {
    if (uq.userId !== userId) continue;
    if (uq.status === "submitted" || uq.status === "won" || uq.status === "resolved") {
      total += uq.pointsWon || 0;
    }
  }
  return total;
}

function computePorraPoints(store, userId, matches = []) {
  let total = 0;
  for (const entry of (store.porraEntries || [])) {
    if (entry.userId !== userId) continue;
    const porra = (store.porras || []).find((p) => p.id === entry.porraId);
    if (!porra) continue;
    const score = scorePorraEntry(entry, porra, matches);
    total += score.points || 0;
  }
  return total;
}

export function getLeagueMemberStats(store, leagueId, userId, matches = []) {
  const league = (store.leagues || []).find((l) => l.id === leagueId);
  if (!league) return null;
  const competition = league.competition || "all";
  const cfg = league.scoringConfig || DEFAULT_LEAGUE_SCORING;
  const pred = computePredictionPoints(store, userId, matches, competition);
  const withinWindow = (entry) => {
    if (!league) return entry;
    if (entry.joinedAt && league.startDate && new Date(entry.joinedAt) < new Date(league.startDate)) return false;
    return true;
  };
  const inMemberWindow = (p) => {
    if (!withinLeagueWindow(p, league)) return false;
    return inCompetition(p, matches, competition);
  };
  let totalPreds = 0, correct = 0, failed = 0, pending = 0;
  let predictionTotal = 0, predictionRound = 0;
  for (const p of (store.predictions || []).filter((x) => x.userId === userId)) {
    if (!inMemberWindow(p)) continue;
    totalPreds += 1;
    if (p.status === "won") { predictionTotal += p.pointsWon || 0; correct += 1; }
    else if (p.status === "lost") failed += 1;
    else { pending += 1; predictionRound += 0; }
  }

  const fantasy = computeFantasyPoints(store, userId);
  const quiniela = computeQuinielaPoints(store, userId);
  const porra = computePorraPoints(store, userId, matches);

  const leagueType = league.type || "predictions";
  let mixedTotal = 0;
  if (leagueType === "predictions") mixedTotal = predictionTotal;
  else if (leagueType === "fantasy") mixedTotal = fantasy.total;
  else if (leagueType === "mixed") {
    mixedTotal = predictionTotal * cfg.predictionWeight
              + fantasy.total * cfg.fantasyWeight
              + quiniela * cfg.quinielaWeight
              + porra * cfg.porraWeight;
  }

  return {
    userId,
    predictionTotal,
    predictionRound,
    fantasyTotal: fantasy.total,
    fantasyRound: fantasy.round,
    quinielaTotal: quiniela,
    porraTotal: porra,
    totalPreds,
    correct,
    failed,
    pending,
    accuracy: totalPreds > 0 ? Math.round((correct / totalPreds) * 100) : 0,
    total: Math.round(mixedTotal),
  };
}

export function getLeagueRankingV2(store, leagueId, matches = [], allUsers = []) {
  const league = (store.leagues || []).find((l) => l.id === leagueId);
  if (!league) return [];
  const rows = league.members.map((m) => {
    const stats = getLeagueMemberStats(store, leagueId, m.userId, matches) || {};
    const user = allUsers.find((u) => u.id === m.userId) || store.users.find((u) => u.id === m.userId) || {};
    return {
      userId: m.userId,
      username: user.username || m.userId,
      avatar: user.avatar || null,
      joinedAt: m.joinedAt,
      role: m.role || "member",
      previousPosition: m.previousPosition || null,
      position: 0,
      ...stats,
    };
  });
  const sorted = rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.fantasyTotal !== a.fantasyTotal) return b.fantasyTotal - a.fantasyTotal;
    if (b.predictionTotal !== a.predictionTotal) return b.predictionTotal - a.predictionTotal;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (a.joinedAt && b.joinedAt) return new Date(a.joinedAt) - new Date(b.joinedAt);
    return 0;
  });
  return sorted.map((row, index) => {
    const position = index + 1;
    const previousPosition = row.previousPosition || position;
    return {
      ...row,
      position,
      previousPosition,
      trend: position < previousPosition ? "up" : position > previousPosition ? "down" : "stable",
    };
  });
}

export function getLeagueActivity(store, leagueId, limit = 30) {
  return (store.leagueActivity || [])
    .filter((a) => !leagueId || a.leagueId === leagueId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

export function recordLeagueActivity(store, leagueId, userId, type, message, metadata = {}) {
  if (!store.leagueActivity) store.leagueActivity = [];
  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leagueId,
    userId,
    type,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  };
  store.leagueActivity.unshift(entry);
  if (store.leagueActivity.length > 200) store.leagueActivity = store.leagueActivity.slice(0, 200);
  saveStore(store);
  return entry;
}
