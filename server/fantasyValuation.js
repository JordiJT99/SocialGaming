import { db } from "./database.js";

const DAY = 86400000;
const DEFAULT_MIN_VALUE = 150000;
const DEFAULT_MAX_VALUE = 100000000;
const DEFAULT_MAX_DAILY_CHANGE_PCT = 15;
const DEFAULT_ROUNDING = 50000;
const DEFAULT_CLAUSE_FLOOR = 1000000;
const DEFAULT_CLAUSE_MULTIPLIER = 1.5;
const DEFAULT_CLAUSE_MAX_MULTIPLIER = 4.0;
const DEFAULT_CLAUSE_VALUE_THRESHOLD = 666666;
const DEFAULT_SALE_OFFER_LOWER_PCT = 5;
const DEFAULT_SALE_OFFER_UPPER_PCT = 5;
const MARKET_REASONS = {
  DEMAND: "demanda",
  PERFORMANCE: "rendimiento",
  INJURY: "lesion",
  SUSPENSION: "sancion",
  LOW_DEMAND: "baja_demanda",
  CLAUSE_BUYOUTS: "clausulazos",
  DOUBT: "duda",
  NON_STARTER: "no_titular",
  STALE_MARKET: "mercado_estancado",
  STABILITY: "estabilidad",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const roundToStep = (value, step) => Math.max(step, Math.round(value / step) * step);

const defaultConfig = {
  minValue: DEFAULT_MIN_VALUE,
  maxValue: DEFAULT_MAX_VALUE,
  maxDailyChangePct: DEFAULT_MAX_DAILY_CHANGE_PCT,
  rounding: DEFAULT_ROUNDING,
  clauseFloor: DEFAULT_CLAUSE_FLOOR,
  clauseMultiplier: DEFAULT_CLAUSE_MULTIPLIER,
  clauseMaxMultiplier: DEFAULT_CLAUSE_MAX_MULTIPLIER,
  clauseValueThreshold: DEFAULT_CLAUSE_VALUE_THRESHOLD,
  saleOfferLowerPct: DEFAULT_SALE_OFFER_LOWER_PCT,
  saleOfferUpperPct: DEFAULT_SALE_OFFER_UPPER_PCT,
};

const STATUS_PENALTIES = {
  injured: 5,
  suspended: 3,
  doubt: 1.5,
};

const getConfig = (overrides = {}) => ({ ...defaultConfig, ...overrides });

const getMarketMetrics = (playerId) => {
  const row = db.prepare("SELECT * FROM fantasy_player_market_metrics WHERE player_id = ?").get(playerId);
  if (row) return row;
  return {
    player_id: playerId,
    number_of_bids: 0,
    average_bid: 0,
    max_bid: 0,
    avg_bid_over_value_pct: 0,
    max_bid_over_value_pct: 0,
    clause_buyouts_24h: 0,
    sales_24h: 0,
    times_in_market_without_bid: 0,
    titular_probable: 1,
    last_points_5_avg: 0,
    updated_at: 0,
  };
};

const getPlayer = (playerId) =>
  db.prepare("SELECT * FROM fantasy_players WHERE id = ?").get(playerId);

const persistMarketMetrics = (playerId, metrics) => {
  db.prepare(`
    INSERT INTO fantasy_player_market_metrics (
      player_id, number_of_bids, average_bid, max_bid,
      avg_bid_over_value_pct, max_bid_over_value_pct,
      clause_buyouts_24h, sales_24h,
      times_in_market_without_bid, titular_probable,
      last_points_5_avg, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      number_of_bids = excluded.number_of_bids,
      average_bid = excluded.average_bid,
      max_bid = excluded.max_bid,
      avg_bid_over_value_pct = excluded.avg_bid_over_value_pct,
      max_bid_over_value_pct = excluded.max_bid_over_value_pct,
      clause_buyouts_24h = excluded.clause_buyouts_24h,
      sales_24h = excluded.sales_24h,
      times_in_market_without_bid = excluded.times_in_market_without_bid,
      titular_probable = excluded.titular_probable,
      last_points_5_avg = excluded.last_points_5_avg,
      updated_at = excluded.updated_at
  `).run(
    playerId,
    metrics.number_of_bids ?? 0,
    metrics.average_bid ?? 0,
    metrics.max_bid ?? 0,
    metrics.avg_bid_over_value_pct ?? 0,
    metrics.max_bid_over_value_pct ?? 0,
    metrics.clause_buyouts_24h ?? 0,
    metrics.sales_24h ?? 0,
    metrics.times_in_market_without_bid ?? 0,
    metrics.titular_probable ?? 1,
    metrics.last_points_5_avg ?? 0,
    Date.now(),
  );
};

export function calculateDemandScore(playerId) {
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);
  const metrics = getMarketMetrics(playerId);
  const value = Number(player.price || 0);

  const bidScore = Number(metrics.number_of_bids || 0) * 1.0;
  const clauseScore = Number(metrics.clause_buyouts_24h || 0) * 2.0;
  const avgBidPct = Number(metrics.avg_bid_over_value_pct || 0);
  const maxBidPct = Number(metrics.max_bid_over_value_pct || 0);
  const avgBidBonus = Math.max(0, avgBidPct - 1) * 10;
  const maxBidBonus = Math.max(0, maxBidPct - 1) * 5;

  const total = bidScore + clauseScore + avgBidBonus + maxBidBonus;
  return {
    score: total,
    breakdown: {
      bidScore,
      clauseScore,
      avgBidBonus,
      maxBidBonus,
      numberOfBids: Number(metrics.number_of_bids || 0),
      clauseBuyouts24h: Number(metrics.clause_buyouts_24h || 0),
      avgBidOverValuePct: avgBidPct,
      maxBidOverValuePct: maxBidPct,
    },
  };
}

export function calculatePerformanceScore(playerId) {
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);
  const lastRound = Number(player.last_round_points || 0);
  const last5 = Number(player.last_5_avg_points || 0);
  const score = lastRound * 0.3 + last5 * 0.7;
  return {
    score,
    breakdown: {
      lastRoundPoints: lastRound,
      last5AvgPoints: last5,
      lastRoundContribution: lastRound * 0.3,
      last5Contribution: last5 * 0.7,
    },
  };
}

export function calculatePenaltyScore(playerId) {
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);
  const metrics = getMarketMetrics(playerId);

  const reasons = [];
  let total = 0;

  const status = player.status || "available";
  if (STATUS_PENALTIES[status]) {
    total += STATUS_PENALTIES[status];
    reasons.push({
      reason: status === "injured" ? MARKET_REASONS.INJURY
        : status === "suspended" ? MARKET_REASONS.SUSPENSION
        : MARKET_REASONS.DOUBT,
      amount: STATUS_PENALTIES[status],
    });
  }

  if (Number(metrics.titular_probable || 1) === 0) {
    total += 2;
    reasons.push({ reason: MARKET_REASONS.NON_STARTER, amount: 2 });
  }

  const stale = Number(metrics.times_in_market_without_bid || 0);
  if (stale >= 2) {
    total += 2;
    reasons.push({ reason: MARKET_REASONS.STALE_MARKET, amount: 2 });
  }

  return { score: total, reasons };
}

export function calculateMarketValueChange(playerId, configOverrides = {}) {
  const config = getConfig(configOverrides);
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);

  const demand = calculateDemandScore(playerId);
  const performance = calculatePerformanceScore(playerId);
  const penalty = calculatePenaltyScore(playerId);

  const variation = demand.score * 0.3 + performance.score * 0.05 - penalty.score * 0.4;

  const limited = clamp(variation, -config.maxDailyChangePct, config.maxDailyChangePct);

  return {
    playerId,
    previousValue: player.price,
    previousClause: player.base_clause_amount,
    demandScore: demand.score,
    performanceScore: performance.score,
    penaltyScore: penalty.score,
    rawVariationPct: variation,
    limitedVariationPct: limited,
    demandBreakdown: demand.breakdown,
    performanceBreakdown: performance.breakdown,
    penaltyReasons: penalty.reasons,
    config,
  };
}

const pickPrimaryReason = ({ demandScore, performanceScore, penaltyReasons }) => {
  if (!penaltyReasons.length) {
    if (demandScore > 0) return MARKET_REASONS.DEMAND;
    if (performanceScore > 0) return MARKET_REASONS.PERFORMANCE;
    return MARKET_REASONS.STABILITY;
  }
  const sorted = [...penaltyReasons].sort((a, b) => b.amount - a.amount);
  return sorted[0].reason;
};

export function updatePlayerMarketValue(playerId, configOverrides = {}) {
  const config = getConfig(configOverrides);
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);

  const calc = calculateMarketValueChange(playerId, configOverrides);
  const newRaw = Math.round(player.price * (1 + calc.limitedVariationPct / 100));
  const newCapped = clamp(newRaw, config.minValue, config.maxValue);
  const newRounded = roundToStep(newCapped, config.rounding);

  const doubled = newRounded >= player.price * 2;
  const finalValue = doubled ? player.price : newRounded;

  const reason = pickPrimaryReason({
    demandScore: calc.demandScore,
    performanceScore: calc.performanceScore,
    penaltyReasons: calc.penaltyReasons,
  });

  const previousValue = player.price;
  const calculatedAt = Date.now();
  const detail = {
    demand: calc.demandBreakdown,
    performance: calc.performanceBreakdown,
    penalties: calc.penaltyReasons,
    config: { minValue: config.minValue, maxValue: config.maxValue, maxDailyChangePct: config.maxDailyChangePct },
  };

  const run = () => {
    db.prepare(`
      UPDATE fantasy_players
      SET previous_price = ?, price = ?, last_value_update = ?
      WHERE id = ?
    `).run(previousValue, finalValue, calculatedAt, playerId);

    db.prepare(`
      INSERT INTO fantasy_player_market_history (
        player_id, previous_value, new_value, percentage_change,
        primary_reason, demand_score, performance_score, penalty_score,
        raw_variation_pct, detail, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId,
      previousValue,
      finalValue,
      calc.limitedVariationPct,
      reason,
      calc.demandScore,
      calc.performanceScore,
      calc.penaltyScore,
      calc.rawVariationPct,
      JSON.stringify(detail),
      calculatedAt,
    );
  };

  try {
    db.exec("BEGIN");
    run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    playerId,
    previousValue,
    newValue: finalValue,
    percentageChange: previousValue ? ((finalValue - previousValue) / previousValue) * 100 : 0,
    primaryReason: reason,
    limited: finalValue !== newRounded,
    blocked: doubled,
    calculatedAt,
  };
}

export function updateAllPlayersMarketValues(configOverrides = {}) {
  const config = getConfig(configOverrides);
  const lastRun = db.prepare(`
    SELECT MAX(calculated_at) AS last FROM fantasy_player_market_history
  `).get()?.last || 0;
  if (lastRun && Date.now() - lastRun < 20 * 60 * 60 * 1000) {
    return { skipped: true, reason: "already_run_recently", lastRun };
  }
  const players = db.prepare("SELECT id FROM fantasy_players").all();
  const results = { updated: [], errors: [], runAt: Date.now() };
  for (const { id } of players) {
    try {
      results.updated.push(updatePlayerMarketValue(id, config));
    } catch (error) {
      results.errors.push({ playerId: id, message: error.message });
    }
  }
  return results;
}

export function generateAutomaticSaleOffer(playerId, configOverrides = {}) {
  const config = getConfig(configOverrides);
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);
  const value = Number(player.price || 0);
  const lower = value * (1 - config.saleOfferLowerPct / 100);
  const upper = value * (1 + config.saleOfferUpperPct / 100);
  const offer = Math.round(lower + Math.random() * (upper - lower));
  return {
    playerId,
    marketValue: value,
    minOffer: Math.round(lower),
    maxOffer: Math.round(upper),
    systemOffer: offer,
    percentageRange: `±${config.saleOfferUpperPct}%`,
  };
}

export function calculateReleaseClause(playerId, paidExtra = 0, configOverrides = {}) {
  const config = getConfig(configOverrides);
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);

  const purchasePrice = Number(player.purchase_price || 0);
  const marketValue = Number(player.price || 0);
  const base = Math.max(purchasePrice, marketValue);
  const baseClause = base * config.clauseMultiplier;
  const floorAdjusted = marketValue <= config.clauseValueThreshold ? config.clauseFloor : baseClause;

  const extra = Math.max(0, Number(paidExtra || 0));
  const maxAllowedExtra = base * (config.clauseMaxMultiplier - 1);
  const cappedExtra = Math.min(extra, maxAllowedExtra);

  const minimumClause = Math.max(purchasePrice, floorAdjusted);
  const finalClause = minimumClause + cappedExtra;

  return {
    playerId,
    purchasePrice,
    marketValue,
    base,
    baseClause: floorAdjusted,
    paidExtra: cappedExtra,
    paidExtraRaw: extra,
    maxExtraAllowed: maxAllowedExtra,
    finalClause: Math.round(finalClause),
    floorApplied: marketValue <= config.clauseValueThreshold,
    config,
  };
}

export function recordBid(playerId, leagueId, userId, amount) {
  db.prepare(`
    INSERT INTO fantasy_bids (league_id, user_id, player_id, amount, status, created_at)
    VALUES (?, ?, ?, ?, 'open', ?)
  `).run(leagueId, userId, playerId, amount, Date.now());
  recomputeMarketMetrics(playerId, leagueId);
}

export function recordClauseBuyout(playerId, leagueId, userId, fromUserId, clauseAmount) {
  db.prepare(`
    INSERT INTO fantasy_player_ownership_history (league_id, player_id, from_user_id, to_user_id, operation, price, clause_amount, created_at)
    VALUES (?, ?, ?, ?, 'clause_buyout', ?, ?, ?)
  `).run(leagueId, playerId, fromUserId, userId, clauseAmount, clauseAmount, Date.now());
  recomputeMarketMetrics(playerId, leagueId);
}

export function recordSale(playerId, leagueId, userId, toUserId, price) {
  db.prepare(`
    INSERT INTO fantasy_player_ownership_history (league_id, player_id, from_user_id, to_user_id, operation, price, created_at)
    VALUES (?, ?, ?, ?, 'sell', ?, ?)
  `).run(leagueId, playerId, userId, toUserId, price, Date.now());
  recomputeMarketMetrics(playerId, leagueId);
}

export function recomputeMarketMetrics(playerId, leagueId) {
  const since = Date.now() - DAY;
  const bids = db.prepare(`
    SELECT amount FROM fantasy_bids
    WHERE player_id = ? AND created_at >= ?
  `).all(playerId, since);
  const clauseBuyouts = db.prepare(`
    SELECT COUNT(*) AS c FROM fantasy_player_ownership_history
    WHERE player_id = ? AND operation = 'clause_buyout' AND created_at >= ?
  `).get(playerId, since);
  const sales = db.prepare(`
    SELECT COUNT(*) AS c FROM fantasy_player_ownership_history
    WHERE player_id = ? AND operation = 'sell' AND created_at >= ?
  `).get(playerId, since);
  const player = getPlayer(playerId);
  if (!player) return;
  const value = Number(player.price || 0);
  const sumBids = bids.reduce((s, b) => s + Number(b.amount || 0), 0);
  const maxBid = bids.reduce((m, b) => Math.max(m, Number(b.amount || 0)), 0);
  const avgBid = bids.length ? sumBids / bids.length : 0;
  const previousMetrics = getMarketMetrics(playerId);

  persistMarketMetrics(playerId, {
    number_of_bids: bids.length,
    average_bid: Math.round(avgBid),
    max_bid: Math.round(maxBid),
    avg_bid_over_value_pct: value > 0 && avgBid > 0 ? avgBid / value : 0,
    max_bid_over_value_pct: value > 0 && maxBid > 0 ? maxBid / value : 0,
    clause_buyouts_24h: clauseBuyouts.c,
    sales_24h: sales.c,
    times_in_market_without_bid: bids.length === 0 ? previousMetrics.times_in_market_without_bid + 1 : 0,
    titular_probable: previousMetrics.titular_probable ?? 1,
    last_points_5_avg: previousMetrics.last_points_5_avg ?? 0,
  });
}

export function getPriceHistory(playerId, limit = 30) {
  return db.prepare(`
    SELECT previous_value, new_value, percentage_change, primary_reason, demand_score, performance_score, penalty_score, raw_variation_pct, calculated_at
    FROM fantasy_player_market_history
    WHERE player_id = ?
    ORDER BY calculated_at DESC
    LIMIT ?
  `).all(playerId, limit);
}

export function getPlayerValuationReport(playerId, configOverrides = {}) {
  const player = getPlayer(playerId);
  if (!player) throw new Error(`Jugador ${playerId} no encontrado`);
  const change = calculateMarketValueChange(playerId, configOverrides);
  const offer = generateAutomaticSaleOffer(playerId, configOverrides);
  const clause = calculateReleaseClause(playerId, 0, configOverrides);
  const history = getPriceHistory(playerId, 10);
  return {
    player: {
      id: player.id,
      name: player.name,
      teamName: player.team_name,
      position: player.position,
      status: player.status,
    },
    change,
    offer,
    clause,
    history,
  };
}

export const REASONS = MARKET_REASONS;
export const DEFAULT_CONFIG = defaultConfig;
