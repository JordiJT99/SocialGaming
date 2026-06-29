import assert from "node:assert/strict";
import { db } from "./database.js";
import {
  REASONS,
  DEFAULT_CONFIG,
  calculateDemandScore,
  calculatePerformanceScore,
  calculatePenaltyScore,
  calculateMarketValueChange,
  updatePlayerMarketValue,
  generateAutomaticSaleOffer,
  calculateReleaseClause,
  recomputeMarketMetrics,
} from "./fantasyValuation.js";

const setupPlayer = (overrides = {}) => {
  const now = Date.now();
  const id = overrides.id ?? Math.floor(Math.random() * 1e9) + 1;
  db.prepare("DELETE FROM fantasy_players WHERE id = ?").run(id);
  db.prepare("DELETE FROM fantasy_player_market_metrics WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_player_market_history WHERE player_id = ?").run(id);

  db.prepare(`
    INSERT INTO fantasy_players (
      id, name, team_id, team_name, position, price, previous_price,
      purchase_price, base_clause_amount, last_round_points, last_5_avg_points,
      status, titular_probable, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.name ?? "Test Player",
    overrides.teamId ?? 1,
    overrides.teamName ?? "Test FC",
    overrides.position ?? "DEL",
    overrides.price ?? 1000000,
    overrides.previousPrice ?? overrides.price ?? 1000000,
    overrides.purchasePrice ?? overrides.price ?? 1000000,
    overrides.baseClauseAmount ?? 0,
    overrides.lastRoundPoints ?? 0,
    overrides.last5AvgPoints ?? 0,
    overrides.status ?? "available",
    overrides.titularProbable ?? 1,
    now,
  );

  if (overrides.metrics) {
    db.prepare(`
      INSERT INTO fantasy_player_market_metrics (
        player_id, number_of_bids, average_bid, max_bid,
        avg_bid_over_value_pct, max_bid_over_value_pct,
        clause_buyouts_24h, sales_24h,
        times_in_market_without_bid, titular_probable,
        last_points_5_avg, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      overrides.metrics.numberOfBids ?? 0,
      overrides.metrics.averageBid ?? 0,
      overrides.metrics.maxBid ?? 0,
      overrides.metrics.avgBidOverValuePct ?? 0,
      overrides.metrics.maxBidOverValuePct ?? 0,
      overrides.metrics.clauseBuyouts24h ?? 0,
      overrides.metrics.sales24h ?? 0,
      overrides.metrics.timesInMarketWithoutBid ?? 0,
      overrides.metrics.titularProbable ?? 1,
      overrides.metrics.lastPoints5Avg ?? 0,
      now,
    );
  }
  return id;
};

const cleanupPlayer = (id) => {
  db.prepare("DELETE FROM fantasy_player_market_history WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_player_market_metrics WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_bids WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM fantasy_players WHERE id = ?").run(id);
};

const log = (label, value) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(value, null, 2));
};

console.log("---------------------------------------------");
console.log("EJEMPLO 1: Jugador joven barato, muchas pujas y buena jornada");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Joven Promesa",
    position: "DEL",
    price: 2000000,
    previousPrice: 2000000,
    purchasePrice: 1500000,
    lastRoundPoints: 10,
    last5AvgPoints: 7,
    status: "available",
    titularProbable: 1,
    metrics: {
      numberOfBids: 12,
      averageBid: 2600000,
      maxBid: 3000000,
      avgBidOverValuePct: 1.30,
      maxBidOverValuePct: 1.50,
      clauseBuyouts24h: 1,
      sales24h: 0,
      timesInMarketWithoutBid: 0,
      titularProbable: 1,
      lastPoints5Avg: 7,
    },
  });

  const demand = calculateDemandScore(id);
  const performance = calculatePerformanceScore(id);
  const penalty = calculatePenaltyScore(id);
  const change = calculateMarketValueChange(id);
  const result = updatePlayerMarketValue(id);

  log("Demanda", demand);
  log("Rendimiento", performance);
  log("Penalización", penalty);
  log("Variación calculada", change);
  log("Resultado final", result);

  assert.ok(result.newValue > result.previousValue, "El jugador debe subir de valor");
  assert.ok(result.percentageChange <= 15, `La subida no debe superar el 15% diario (fue ${result.percentageChange.toFixed(2)}%)`);
  assert.equal(result.primaryReason, REASONS.DEMAND, "La razón principal debe ser demanda");
  console.log(`✅ Subida: ${result.previousValue.toLocaleString("es-ES")} → ${result.newValue.toLocaleString("es-ES")} (+${result.percentageChange.toFixed(2)}%)`);
  console.log(`✅ Razón principal: ${result.primaryReason}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 2: Jugador caro lesionado, sin pujas");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Estrella Lesionada",
    position: "DEL",
    price: 18000000,
    previousPrice: 18000000,
    purchasePrice: 20000000,
    lastRoundPoints: 0,
    last5AvgPoints: 2,
    status: "injured",
    titularProbable: 0,
    metrics: {
      numberOfBids: 0,
      averageBid: 0,
      maxBid: 0,
      avgBidOverValuePct: 0,
      maxBidOverValuePct: 0,
      clauseBuyouts24h: 0,
      sales24h: 2,
      timesInMarketWithoutBid: 3,
      titularProbable: 0,
      lastPoints5Avg: 2,
    },
  });

  const demand = calculateDemandScore(id);
  const performance = calculatePerformanceScore(id);
  const penalty = calculatePenaltyScore(id);
  const result = updatePlayerMarketValue(id);

  log("Demanda", demand);
  log("Rendimiento", performance);
  log("Penalización", penalty);
  log("Resultado final", result);

  assert.ok(result.newValue < result.previousValue, "El jugador debe bajar de valor");
  assert.ok(result.percentageChange >= -15, `La bajada no debe superar el 15% diario (fue ${result.percentageChange.toFixed(2)}%)`);
  assert.equal(result.primaryReason, REASONS.INJURY, "La razón principal debe ser lesión");
  console.log(`✅ Bajada: ${result.previousValue.toLocaleString("es-ES")} → ${result.newValue.toLocaleString("es-ES")} (${result.percentageChange.toFixed(2)}%)`);
  console.log(`✅ Razón principal: ${result.primaryReason}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 3: Jugador top muy clausulado");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Crack del Equipo",
    position: "DEL",
    price: 25000000,
    previousPrice: 25000000,
    purchasePrice: 22000000,
    lastRoundPoints: 8,
    last5AvgPoints: 9,
    status: "available",
    titularProbable: 1,
    metrics: {
      numberOfBids: 5,
      averageBid: 27000000,
      maxBid: 32000000,
      avgBidOverValuePct: 1.08,
      maxBidOverValuePct: 1.28,
      clauseBuyouts24h: 6,
      sales24h: 0,
      timesInMarketWithoutBid: 0,
      titularProbable: 1,
      lastPoints5Avg: 9,
    },
  });

  const demand = calculateDemandScore(id);
  const performance = calculatePerformanceScore(id);
  const result = updatePlayerMarketValue(id);

  log("Demanda", demand);
  log("Rendimiento", performance);
  log("Resultado final", result);

  assert.ok(result.newValue > result.previousValue, "El jugador debe subir de valor");
  assert.ok(result.percentageChange <= 15, `La subida no debe superar el 15% diario (fue ${result.percentageChange.toFixed(2)}%)`);
  assert.equal(result.primaryReason, REASONS.DEMAND, "La razón principal debe ser demanda");
  console.log(`✅ Subida: ${result.previousValue.toLocaleString("es-ES")} → ${result.newValue.toLocaleString("es-ES")} (+${result.percentageChange.toFixed(2)}%)`);
  console.log(`✅ Razón principal: ${result.primaryReason}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 4: Oferta automática de venta (jugador 10M)");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Oferta",
    position: "MED",
    price: 10000000,
    purchasePrice: 8000000,
  });
  const offer = generateAutomaticSaleOffer(id);
  log("Oferta", offer);
  assert.ok(offer.systemOffer >= offer.minOffer, "La oferta debe estar dentro del rango mínimo");
  assert.ok(offer.systemOffer <= offer.maxOffer, "La oferta debe estar dentro del rango máximo");
  console.log(`✅ Oferta: ${offer.systemOffer.toLocaleString("es-ES")} (rango ${offer.minOffer.toLocaleString("es-ES")} - ${offer.maxOffer.toLocaleString("es-ES")})`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 5: Cláusula base (jugador 25M, compra 20M)");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Cláusula",
    position: "DEL",
    price: 25000000,
    purchasePrice: 20000000,
  });
  const clause = calculateReleaseClause(id, 0);
  log("Cláusula", clause);
  assert.equal(clause.baseClause, 37500000, `Base cláusula = 25M * 1.5 = 37.5M (fue ${clause.baseClause})`);
  assert.ok(clause.finalClause >= 37500000, "La cláusula final debe ser >= base");
  console.log(`✅ Cláusula final: ${clause.finalClause.toLocaleString("es-ES")}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 6: Cláusula con jugador barato (umbral 666.666)");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Barato",
    position: "DEF",
    price: 500000,
    purchasePrice: 500000,
  });
  const clause = calculateReleaseClause(id, 0);
  log("Cláusula barato", clause);
  assert.equal(clause.finalClause, 1000000, `Cláusula debe ser 1M por el umbral (fue ${clause.finalClause})`);
  assert.ok(clause.floorApplied, "Debe aplicar el suelo de 1M");
  console.log(`✅ Suelo aplicado: ${clause.finalClause.toLocaleString("es-ES")}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 7: Cláusula con paid extra");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Pro",
    position: "DEL",
    price: 10000000,
    purchasePrice: 8000000,
  });
  const clause = calculateReleaseClause(id, 5000000);
  log("Cláusula con extra", clause);
  assert.equal(clause.paidExtra, 5000000, "El extra debe ser 5M");
  assert.equal(clause.finalClause, 20000000, `Cláusula final = 15M base + 5M extra = 20M (fue ${clause.finalClause})`);
  console.log(`✅ Cláusula con extra: ${clause.finalClause.toLocaleString("es-ES")}`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 8: Límite diario - intento de duplicar valor");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Estrella Explosiva",
    price: 1000000,
    lastRoundPoints: 50,
    last5AvgPoints: 40,
    metrics: {
      numberOfBids: 100,
      averageBid: 5000000,
      maxBid: 10000000,
      avgBidOverValuePct: 5,
      maxBidOverValuePct: 10,
      clauseBuyouts24h: 20,
      titularProbable: 1,
      lastPoints5Avg: 40,
    },
  });
  const result = updatePlayerMarketValue(id);
  log("Resultado límite", result);
  assert.ok(result.newValue <= result.previousValue * 2, "El valor no debe duplicarse en un día");
  assert.ok(result.percentageChange <= 15, `Variación debe estar limitada al 15% (fue ${result.percentageChange.toFixed(2)}%)`);
  console.log(`✅ Valor limitado: ${result.previousValue.toLocaleString("es-ES")} → ${result.newValue.toLocaleString("es-ES")} (+${result.percentageChange.toFixed(2)}%)`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 9: Suelo mínimo - El valor nunca debe bajar de 150.000");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Marginal",
    price: 500000,
    purchasePrice: 500000,
    status: "injured",
    titularProbable: 0,
    metrics: {
      numberOfBids: 0,
      timesInMarketWithoutBid: 5,
      titularProbable: 0,
    },
  });
  const result = updatePlayerMarketValue(id);
  log("Resultado suelo", result);
  assert.ok(result.newValue >= DEFAULT_CONFIG.minValue, `El valor no debe bajar de 150.000 (fue ${result.newValue})`);
  console.log(`✅ Suelo aplicado: ${result.newValue.toLocaleString("es-ES")} (mínimo ${DEFAULT_CONFIG.minValue.toLocaleString("es-ES")})`);
  cleanupPlayer(id);
}

console.log("\n---------------------------------------------");
console.log("EJEMPLO 10: Recalcular métricas tras pujas");
console.log("---------------------------------------------");
{
  const id = setupPlayer({
    name: "Jugador Pujas",
    price: 5000000,
    metrics: { numberOfBids: 0 },
  });
  const now = Date.now();
  db.prepare("INSERT INTO fantasy_bids (league_id, user_id, player_id, amount, status, created_at) VALUES (1, 'u1', ?, 5500000, 'open', ?)").run(id, now);
  db.prepare("INSERT INTO fantasy_bids (league_id, user_id, player_id, amount, status, created_at) VALUES (1, 'u2', ?, 6000000, 'open', ?)").run(id, now);
  db.prepare("INSERT INTO fantasy_bids (league_id, user_id, player_id, amount, status, created_at) VALUES (1, 'u3', ?, 5200000, 'open', ?)").run(id, now);
  recomputeMarketMetrics(id, 1);
  const metrics = db.prepare("SELECT * FROM fantasy_player_market_metrics WHERE player_id = ?").get(id);
  log("Métricas recalculadas", metrics);
  assert.equal(metrics.number_of_bids, 3, "Debe haber 3 pujas");
  assert.equal(metrics.max_bid, 6000000, "Puja máxima debe ser 6M");
  assert.ok(metrics.avg_bid_over_value_pct > 1, "La puja media debe superar el valor");
  console.log(`✅ Pujas: ${metrics.number_of_bids}, max=${metrics.max_bid.toLocaleString("es-ES")}, media=${metrics.average_bid.toLocaleString("es-ES")}`);
  db.prepare("DELETE FROM fantasy_bids WHERE player_id = ?").run(id);
  cleanupPlayer(id);
}

console.log("\n🎉 Todos los ejemplos se ejecutaron correctamente.");
