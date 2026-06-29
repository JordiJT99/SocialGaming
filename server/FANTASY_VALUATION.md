# Sistema de Valoración Económica Dinámica — Fantasy

Motor de valoración de mercado para jugadores fantasy basado en **demanda + rendimiento + penalizaciones**, con histórico transaccional y cláusulas dinámicas.

> Inspirado en juegos tipo Fantasy MARCA, pero con fórmula propia.

## 📁 Estructura

```
server/
├── fantasyValuation.js       # Lógica de cálculo
├── fantasyValuation.test.js  # Tests con los 10 ejemplos
└── database.js               # Schema (3 tablas nuevas + 5 columnas)
```

## 🗄️ Modelo de datos

### `fantasy_players` (columnas añadidas)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `last_5_avg_points` | REAL | Media de puntos en las últimas 5 jornadas |
| `titular_probable` | INTEGER | 1 si es probable titular, 0 si no |
| `purchase_price` | INTEGER | Precio al que el usuario lo compró |
| `base_clause_amount` | INTEGER | Base de la cláusula |
| `last_value_update` | INTEGER | Timestamp del último recálculo |
| `status` | TEXT | `available` / `injured` / `suspended` / `doubt` |

### `fantasy_player_market_metrics`

Métricas del mercado en las últimas 24h por jugador:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `number_of_bids` | INTEGER | Nº de pujas abiertas |
| `average_bid` | INTEGER | Puja media |
| `max_bid` | INTEGER | Puja máxima |
| `avg_bid_over_value_pct` | REAL | `puja_media / valor_mercado` |
| `max_bid_over_value_pct` | REAL | `puja_max / valor_mercado` |
| `clause_buyouts_24h` | INTEGER | Nº de cláusulas pagadas en 24h |
| `sales_24h` | INTEGER | Nº de ventas en 24h |
| `times_in_market_without_bid` | INTEGER | Contador de días sin puja |
| `titular_probable` | INTEGER | Espejo del jugador |
| `last_points_5_avg` | REAL | Espejo del jugador |

### `fantasy_player_market_history`

Histórico completo de cambios de valor:

| Columna | Descripción |
|---------|-------------|
| `previous_value` | Valor antes del cambio |
| `new_value` | Valor nuevo |
| `percentage_change` | % de cambio aplicado (limitado a ±15%) |
| `primary_reason` | `demanda` / `rendimiento` / `lesion` / `sancion` / `baja_demanda` / `clausulazos` / `duda` / `no_titular` / `mercado_estancado` / `estabilidad` |
| `demand_score` | Score de demanda calculado |
| `performance_score` | Score de rendimiento |
| `penalty_score` | Score de penalización |
| `raw_variation_pct` | Variación sin limitar |
| `detail` | JSON con el desglose completo |

## ⚙️ Funciones principales

```js
import {
  calculateDemandScore,         // Score de demanda
  calculatePerformanceScore,     // Score de rendimiento
  calculatePenaltyScore,         // Score de penalización
  calculateMarketValueChange,    // Variación sin persistir
  updatePlayerMarketValue,       // Aplica y guarda el cambio (transaccional)
  updateAllPlayersMarketValues,  // Recalcula todos (1 vez al día)
  generateAutomaticSaleOffer,    // Oferta auto entre -5% y +5%
  calculateReleaseClause,        // Cláusula con extra paid
  recordBid,                     // Registra puja + recalcula métricas
  recordClauseBuyout,            // Registra clausulazo
  recordSale,                    // Registra venta
  recomputeMarketMetrics,        // Recalcula métricas 24h
  getPriceHistory,               // Histórico de un jugador
  getPlayerValuationReport,      // Reporte completo
} from "./fantasyValuation.js";
```

## 🧮 Fórmulas

### 1. Demanda
```
demanda_score = pujas × 1.0
              + clausulazos_24h × 2.0
              + max(0, avg_bid_pct - 1) × 10
              + max(0, max_bid_pct - 1) × 5
```

### 2. Rendimiento
```
rendimiento_score = puntos_ultima × 0.3 + media_5 × 0.7
```

### 3. Penalización
| Estado / condición | Penalización |
|--------------------|--------------|
| `injured` | 5 |
| `suspended` | 3 |
| `doubt` | 1.5 |
| `titular_probable = 0` | 2 |
| `times_in_market_without_bid ≥ 2` | 2 |

### 4. Variación porcentual
```
variacion = demanda × 0.3 + rendimiento × 0.05 - penalizacion × 0.4
```

### 5. Límites diarios
- `±15%` por día
- Valor mínimo: `150.000`
- Valor máximo: `100.000.000` (configurable)
- Redondeo a múltiplos de `50.000`
- **No se permite duplicar el valor** en un solo día

### 6. Cláusula
```
base = max(precio_compra, valor_mercado)
clausula = base × 1.5
if valor_mercado ≤ 666.666:  clausula = 1.000.000
clausula_final = max(precio_compra, base_clause) + paid_extra
paid_extra_max = base × 3  (hasta 400% del base)
```

### 7. Oferta automática de venta
```
min = valor_mercado × 0.95
max = valor_mercado × 1.05
oferta = random(min, max)
```

## 🛡️ Reglas de seguridad

✅ **Transaccional**: cada cambio se hace con `BEGIN` / `COMMIT` / `ROLLBACK`
✅ **Anti-duplicación**: si `nuevo_valor ≥ 2 × valor_actual`, se anula
✅ **Anti-negativo**: `max(0, …)` en todos los cálculos
✅ **Anti-cambio-duro**: variaciones se limitan a `±15%`
✅ **Histórico completo**: cada cambio guarda `previous_value`, `new_value`, `percentage_change`, `primary_reason` y `detail` JSON
✅ **Idempotente**: `updateAllPlayersMarketValues` se salta si se ejecutó hace <20h

## 📊 Ejemplos verificados (10/10 ✅)

| # | Escenario | Resultado |
|---|-----------|-----------|
| 1 | Joven 2M con 12 pujas + buena jornada | Sube a 2.1M (+5%) por demanda |
| 2 | Caro 18M lesionado + 0 pujas | Baja a 17.5M (-2.78%) por lesión |
| 3 | Top 25M con 6 clausulazos | Sube a 26.55M (+6.2%) por demanda |
| 4 | Oferta auto de 10M | Random entre 9.5M y 10.5M |
| 5 | Cláusula base 25M / compra 20M | 37.5M (= 25M × 1.5) |
| 6 | Jugador 500K (umbral 666K) | Cláusula forzada a 1M |
| 7 | Cláusula con +5M paid extra | 20M (= 15M base + 5M extra) |
| 8 | Intento de duplicar valor | Limitado a +15% |
| 9 | Bajada forzada | Nunca baja de 150.000 |
| 10 | Recalcular métricas tras 3 pujas | 3 pujas, max 6M, media 5.57M |

## 🚀 Uso

```js
// Cálculo individual (sin persistir)
const calc = calculateMarketValueChange(playerId);
console.log(calc.limitedVariationPct, calc.demandBreakdown);

// Aplicar y guardar
const result = updatePlayerMarketValue(playerId);
console.log(`${result.previousValue} → ${result.newValue} (${result.primaryReason})`);

// Recalcular todos los jugadores (1 vez al día)
const summary = updateAllPlayersMarketValues();
console.log(`${summary.updated.length} actualizados, ${summary.errors.length} errores`);

// Oferta automática
const offer = generateAutomaticSaleOffer(playerId);
console.log(`Sistema ofrece: ${offer.systemOffer}`);

// Cláusula
const clause = calculateReleaseClause(playerId, paidExtra = 5_000_000);

// Histórico
const history = getPriceHistory(playerId, 30);
```

## ✅ Tests

```bash
node --experimental-sqlite --test server/fantasyValuation.test.js
```

**Resultado**: `1 pass, 0 fail` — todos los ejemplos se ejecutan correctamente.
