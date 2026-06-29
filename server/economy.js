import { db, getAppState, saveAppState } from "./database.js";
import { getRequestUser } from "./session.js";

const DAILY_REWARD_TABLE = [25, 30, 35, 40, 50, 70, 100];
const DAILY_VIDEO_LIMIT = 5;
const VIDEO_REWARD = 15;
const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 20_000) reject(new Error("Solicitud demasiado grande"));
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(body || "{}"));
    } catch {
      reject(new Error("JSON no valido"));
    }
  });
});

const dayStart = (value = Date.now()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const isPreviousDay = (older, newer) => dayStart(newer) - dayStart(older) === 24 * 60 * 60 * 1000;

function resolveUser(req) {
  const user = getRequestUser(req);
  if (!user) throw new Error("Sesion no valida");
  return user;
}

function rewardUserKey(user) {
  return `user:${user.id}`;
}

function getStoredPoints(user) {
  const state = getAppState(user.id)?.state;
  const points = Number(state?.users?.find((item) => item.id === "current_user")?.points);
  return Number.isFinite(points) ? points : Number(user.points || 0);
}

function applyStoredPointDelta(user, delta) {
  const stored = getAppState(user.id);
  if (!stored?.state?.users?.length) return;
  const state = structuredClone(stored.state);
  const currentUser = state.users.find((item) => item.id === "current_user");
  if (!currentUser) return;
  currentUser.points = Math.max(0, Number(currentUser.points || 0) + delta);
  if (delta > 0) currentUser.totalEarned = Number(currentUser.totalEarned || 0) + delta;
  saveAppState(user.id, state);
}

function ensureProfile(userKey) {
  const existing = db.prepare("SELECT * FROM reward_profiles WHERE user_key = ?").get(userKey);
  if (existing) return existing;
  const now = Date.now();
  db.prepare(`
    INSERT INTO reward_profiles (user_key, streak, last_daily_claim_at, created_at, updated_at)
    VALUES (?, 0, NULL, ?, ?)
  `).run(userKey, now, now);
  return db.prepare("SELECT * FROM reward_profiles WHERE user_key = ?").get(userKey);
}

function buildState(userKey) {
  const profile = ensureProfile(userKey);
  const today = dayStart();
  const videoClaimsToday = db.prepare(`
    SELECT COUNT(*) AS count
    FROM reward_video_claims
    WHERE user_key = ? AND claimed_at >= ?
  `).get(userKey, today)?.count || 0;
  const offers = db.prepare(`
    SELECT offer_id, title, amount, claimed_at
    FROM reward_offer_claims
    WHERE user_key = ?
    ORDER BY claimed_at DESC
  `).all(userKey);
  const redemptions = db.prepare(`
    SELECT id, reward_id, reward_name, cost, status, delivery_type, created_at
    FROM reward_redemptions
    WHERE user_key = ?
    ORDER BY created_at DESC
    LIMIT 12
  `).all(userKey).map((row) => ({
    id: `reward_${row.id}`,
    rewardId: row.reward_id,
    name: row.reward_name,
    cost: row.cost,
    status: row.status,
    deliveryType: row.delivery_type,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  const streak = Number(profile.streak || 0);
  const dailyAvailable = !profile.last_daily_claim_at || dayStart(profile.last_daily_claim_at) !== today;
  return {
    userKey,
    streak,
    dailyAvailable,
    dailyReward: DAILY_REWARD_TABLE[Math.min(streak, DAILY_REWARD_TABLE.length - 1)],
    videoClaimsToday,
    videoClaimsRemaining: Math.max(0, DAILY_VIDEO_LIMIT - videoClaimsToday),
    videoReward: VIDEO_REWARD,
    completedOffers: offers.map((offer) => offer.offer_id),
    offerHistory: offers.map((offer) => ({
      offerId: offer.offer_id,
      title: offer.title,
      reward: offer.amount,
      completedAt: new Date(offer.claimed_at).toISOString(),
    })),
    redemptions,
  };
}

function importLegacyState(userKey, payload = {}) {
  const hasProfile = db.prepare("SELECT 1 FROM reward_profiles WHERE user_key = ?").get(userKey);
  const hasVideo = db.prepare("SELECT 1 FROM reward_video_claims WHERE user_key = ? LIMIT 1").get(userKey);
  const hasOffers = db.prepare("SELECT 1 FROM reward_offer_claims WHERE user_key = ? LIMIT 1").get(userKey);
  const hasRedemptions = db.prepare("SELECT 1 FROM reward_redemptions WHERE user_key = ? LIMIT 1").get(userKey);
  if (hasProfile || hasVideo || hasOffers || hasRedemptions) return;

  const now = Date.now();
  const rewardStreak = Math.max(0, Number(payload.user?.rewardStreak || 0));
  const lastRewardClaimAt = payload.user?.lastRewardClaimAt ? new Date(payload.user.lastRewardClaimAt).getTime() : null;
  db.prepare(`
    INSERT OR REPLACE INTO reward_profiles (user_key, streak, last_daily_claim_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userKey, rewardStreak, lastRewardClaimAt, now, now);

  for (const claim of payload.rewardActivity?.videoClaims || []) {
    const claimedAt = new Date(claim.claimedAt || now).getTime();
    db.prepare(`
      INSERT INTO reward_video_claims (user_key, amount, claimed_at)
      VALUES (?, ?, ?)
    `).run(userKey, Number(claim.amount || VIDEO_REWARD), claimedAt);
  }

  for (const offer of payload.rewardActivity?.completedOffers || []) {
    db.prepare(`
      INSERT OR IGNORE INTO reward_offer_claims (user_key, offer_id, title, amount, claimed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userKey,
      String(offer.offerId || offer.id || ""),
      String(offer.title || "Oferta"),
      Number(offer.reward || 0),
      new Date(offer.completedAt || now).getTime(),
    );
  }

  for (const redemption of payload.prizesRedeemed || []) {
    db.prepare(`
      INSERT INTO reward_redemptions (user_key, reward_id, reward_name, cost, status, delivery_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userKey,
      String(redemption.rewardId || redemption.id || ""),
      String(redemption.name || "Premio"),
      Number(redemption.cost || 0),
      String(redemption.status || "processing"),
      String(redemption.deliveryType || "digital"),
      new Date(redemption.createdAt || now).getTime(),
    );
  }
}

function claimDaily(user) {
  const userKey = rewardUserKey(user);
  const profile = ensureProfile(userKey);
  const now = Date.now();
  if (profile.last_daily_claim_at && dayStart(profile.last_daily_claim_at) === dayStart(now)) {
    throw new Error("La recompensa diaria ya esta reclamada");
  }
  const nextStreak = profile.last_daily_claim_at && isPreviousDay(profile.last_daily_claim_at, now)
    ? Number(profile.streak || 0) + 1
    : 1;
  const reward = DAILY_REWARD_TABLE[Math.min(nextStreak - 1, DAILY_REWARD_TABLE.length - 1)];
  db.prepare(`
    UPDATE reward_profiles
    SET streak = ?, last_daily_claim_at = ?, updated_at = ?
    WHERE user_key = ?
  `).run(nextStreak, now, now, userKey);
  applyStoredPointDelta(user, reward);
  return { reward, streak: nextStreak };
}

function claimVideo(user) {
  const userKey = rewardUserKey(user);
  const today = dayStart();
  const used = db.prepare(`
    SELECT COUNT(*) AS count
    FROM reward_video_claims
    WHERE user_key = ? AND claimed_at >= ?
  `).get(userKey, today)?.count || 0;
  if (used >= DAILY_VIDEO_LIMIT) throw new Error("Ya has agotado los videos de hoy");
  db.prepare(`
    INSERT INTO reward_video_claims (user_key, amount, claimed_at)
    VALUES (?, ?, ?)
  `).run(userKey, VIDEO_REWARD, Date.now());
  applyStoredPointDelta(user, VIDEO_REWARD);
  return { reward: VIDEO_REWARD };
}

function claimOffer(user, offer) {
  const userKey = rewardUserKey(user);
  if (!offer?.id || !offer?.title || !Number(offer.reward)) throw new Error("Oferta invalida");
  const exists = db.prepare(`
    SELECT 1 FROM reward_offer_claims WHERE user_key = ? AND offer_id = ?
  `).get(userKey, offer.id);
  if (exists) throw new Error("Esta oferta ya esta completada");
  db.prepare(`
    INSERT INTO reward_offer_claims (user_key, offer_id, title, amount, claimed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userKey, String(offer.id), String(offer.title), Number(offer.reward), Date.now());
  applyStoredPointDelta(user, Number(offer.reward));
  return { reward: Number(offer.reward) };
}

function redeemReward(user, reward) {
  const cost = Number(reward?.cost || 0);
  if (!reward?.id || !reward?.name || cost <= 0) throw new Error("Premio invalido");
  const userKey = rewardUserKey(user);
  if (getStoredPoints(user) < cost) throw new Error("No tienes coins suficientes");
  const status = reward.deliveryType === "digital" ? "processing" : "coming_soon";
  const result = db.prepare(`
    INSERT INTO reward_redemptions (user_key, reward_id, reward_name, cost, status, delivery_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userKey,
    String(reward.id),
    String(reward.name),
    cost,
    status,
    String(reward.deliveryType || "digital"),
    Date.now(),
  );
  applyStoredPointDelta(user, -cost);
  return { id: result.lastInsertRowid, cost };
}

export function economyApi() {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/economy")) return next();

    try {
      if (req.method === "GET" && req.url === "/api/economy") {
        const userKey = rewardUserKey(resolveUser(req));
        return json(res, 200, buildState(userKey));
      }

      if (req.method !== "POST") return json(res, 405, { error: "Metodo no permitido" });
      const body = await readBody(req);
      const user = resolveUser(req);
      const userKey = rewardUserKey(user);

      if (req.url === "/api/economy/sync") {
        importLegacyState(userKey, body.legacy || {});
        return json(res, 200, buildState(userKey));
      }
      if (req.url === "/api/economy/daily") {
        const result = claimDaily(user);
        return json(res, 200, { ...result, state: buildState(userKey) });
      }
      if (req.url === "/api/economy/video") {
        const result = claimVideo(user);
        return json(res, 200, { ...result, state: buildState(userKey) });
      }
      if (req.url === "/api/economy/offer") {
        const result = claimOffer(user, body.offer);
        return json(res, 200, { ...result, state: buildState(userKey) });
      }
      if (req.url === "/api/economy/redeem") {
        const result = redeemReward(user, body.reward);
        return json(res, 200, { ...result, state: buildState(userKey) });
      }

      return json(res, 404, { error: "Ruta no encontrada" });
    } catch (error) {
      return json(res, 400, { error: error.message || "No se pudo procesar la economia" });
    }
  };
}
