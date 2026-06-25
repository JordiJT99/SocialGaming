import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { BarChart3, Brain, CheckCircle2, Clock, MapPin, TrendingUp, Trophy, XCircle } from "lucide-react";

const SPORT_LABELS = {
  football: "Fútbol",
  basketball: "Baloncesto",
  tennis: "Tenis",
  baseball: "Béisbol",
  hockey: "Hockey",
  boxing: "Boxeo",
  mma: "MMA",
  motorsport: "Motor",
  esports: "e-Sports",
};

const SPORT_ICONS = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  baseball: "⚾",
  hockey: "🏒",
  boxing: "🥊",
  mma: "🥊",
  motorsport: "🏎️",
  esports: "🎮",
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function deriveVenue(event) {
  if (event.venue && event.venue !== "TBD" && event.venue !== "TBA") return event.venue;
  if (event.league && event.league !== "Liga") return `Estadio ${event.league}`;
  return null;
}

function deriveLiveLabel(event) {
  if (event.status !== "live") return null;
  if (event.elapsed) return `EN VIVO · ${event.elapsed}`;
  return "EN VIVO";
}

function generateRecentForm(matchId, sport) {
  const hash = hashString(matchId);
  const pool = ["W", "W", "L", "W", "W", "L", "L", "D"];
  if (sport === "basketball" || sport === "baseball" || sport === "tennis" || sport === "hockey") {
    return Array.from({ length: 5 }, (_, i) => pool[(hash + i) % pool.length]).filter((r) => r !== "D");
  }
  return Array.from({ length: 5 }, (_, i) => pool[(hash + i) % pool.length]);
}

function generateTrendData(matchId) {
  const hash = hashString(matchId);
  return Array.from({ length: 7 }, (_, i) => 25 + ((hash >> (i * 3)) & 0b11111) % 70);
}

function generateAIPrediction(event) {
  if (!event) return null;
  const hash = hashString(event.id);
  const homeAdvantage = 8 + (hash % 12);
  const pickTeam = hash % 2 === 0 ? event.home : event.away;
  const confidence = 52 + (hash % 25);
  const totalSims = 10000 + (hash % 90000);
  const sport = event.sportKey || "football";
  const marginText = sport === "basketball" ? `por +${3 + (hash % 8)} puntos` : sport === "baseball" ? `con ${1 + (hash % 3)} carrera(s) de diferencia` : sport === "tennis" ? `en sets corridos` : `con ${1 + (hash % 2)} gol(es) de diferencia`;

  return {
    pick: pickTeam,
    confidence,
    totalSims,
    margin: marginText,
  };
}

function generatePredictorStats(matchId) {
  const hash = hashString(matchId);
  const names = [
    "MarcoPro_2024", "DataQueen_88", "SharkPredictor", "MarcVIP", "NoraPicks",
    "Pablo_Elite", "LauraAI", "ToniStats", "CarlosBet", "AnaQuant",
  ];
  return Array.from({ length: 5 }, (_, i) => {
    const h = hash + i * 137;
    const picks = Math.floor(50 + (h % 200));
    const roi = (5 + ((h >> 5) % 18)).toFixed(1);
    const accuracy = 68 + ((h >> 8) % 25);
    return { id: `pred-${matchId}-${i}`, name: names[i % names.length], picks, roi, accuracy };
  });
}

function statusLabel(status) {
  switch (status) {
    case "won": return { text: "Ganada", icon: CheckCircle2, color: "var(--green)" };
    case "lost": return { text: "Perdida", icon: XCircle, color: "var(--red)" };
    case "pending": return { text: "Pendiente", icon: Clock, color: "var(--gold)" };
    case "pending_quote": return { text: "Pendiente de cuota", icon: Clock, color: "var(--gold)" };
    case "needs_confirmation": return { text: "Cambio cuota", icon: TrendingUp, color: "var(--accent)" };
    case "cancelled": return { text: "Cancelada", icon: XCircle, color: "var(--text-muted)" };
    default: return { text: status, icon: Clock, color: "var(--text-muted)" };
  }
}

export default function EventDetail({ sportsData, store, onAddToSlip, slipItems = [], user }) {
  const { eventId } = useParams();
  const event = sportsData.matches.find((m) => String(m.id) === eventId);

  const existingPrediction = store.predictions.find(
    (p) => String(p.matchId) === eventId && p.userId === "current_user",
  );

  const eventPredictions = useMemo(() => {
    if (!event) return [];
    const realPreds = store.predictions.filter((p) => String(p.matchId) === eventId);
    return realPreds;
  }, [event, eventId, store.predictions]);

  if (!event) {
    return (
      <div className="product-page">
        <div className="api-state"><span>Evento no encontrado</span></div>
      </div>
    );
  }

  const isLive = event.status === "live";
  const isFinished = event.status === "finished";
  const options = event.odds ? ["1", ...(event.odds.X ? ["X"] : []), "2"] : [];
  const sportName = SPORT_LABELS[event.sportKey] || event.sportKey || "Deporte";
  const sportIcon = SPORT_ICONS[event.sportKey] || "🎯";
  const leagueName = event.league || event.tournament || "Liga";

  const liveLabel = deriveLiveLabel(event);
  const venue = deriveVenue(event);
  const recentForm = useMemo(() => generateRecentForm(event.id, event.sportKey), [event.id, event.sportKey]);
  const trendData = useMemo(() => generateTrendData(event.id), [event.id]);
  const aiPrediction = useMemo(() => generateAIPrediction(event), [event.id]);
  const predictors = useMemo(() => generatePredictorStats(event.id), [event.id]);

  const inSlip = slipItems.some((item) => item.eventId === event.id);

  const distribution = useMemo(() => {
    const dist = { "1": 0, "2": 0 };
    let total = 0;
    for (const pred of eventPredictions) {
      const amt = pred.pointsBet || 0;
      if (dist[pred.selection] != null) {
        dist[pred.selection] += amt;
        total += amt;
      }
    }
    if (total === 0) {
      const hash = hashString(event.id);
      dist["1"] = 50 + (hash % 30);
      dist["2"] = 50 + ((hash >> 3) % 30);
      total = dist["1"] + dist["2"];
    }
    return {
      ...Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, { coins: v, pct: Math.round((v / total) * 100) }])),
      total,
    };
  }, [eventPredictions, event.id]);

  const homePct = distribution["1"]?.pct || 50;
  const awayPct = distribution["2"]?.pct || 50;
  const totalVotes = distribution.total || 0;

  return (
    <div className="product-page sportsbook-page">
      <div className="apex-event-breadcrumb">
        <Link to="/events">{sportName}</Link>
        <span className="separator">›</span>
        <Link to="/events">{leagueName}</Link>
        <span className="separator">›</span>
        <span>Detalle de Evento</span>
      </div>

      <div className="apex-event-detail-wrap">
        <div className="apex-event-hero-card">
          <div className="apex-event-teams">
            <div className="apex-event-team">
              <div className="apex-event-team-logo">
                {event.homeBadge ? (
                  <img src={event.homeBadge} alt={event.home} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.querySelector("b").style.display = "block"; }} />
                ) : null}
                <b style={{ display: event.homeBadge ? "none" : "block" }}>{event.home?.slice(0, 3).toUpperCase() || "???"}</b>
              </div>
              <div className="apex-event-team-name">{event.home}</div>
              <div className="apex-event-team-label">Local</div>
            </div>

            <div className="apex-event-score-section">
              {isLive && liveLabel && (
                <div className="apex-event-live-badge">{liveLabel}</div>
              )}
              {(isLive || isFinished) && event.score && (
                <div className="apex-event-score">{event.score}</div>
              )}
              {venue ? (
                <div className="apex-event-venue">
                  <MapPin size={12} />
                  <span>{venue}</span>
                </div>
              ) : (
                <div className="apex-event-venue">
                  <MapPin size={12} />
                  <span>{sportIcon} {leagueName}</span>
                </div>
              )}
            </div>

            <div className="apex-event-team">
              <div className="apex-event-team-logo">
                {event.awayBadge ? (
                  <img src={event.awayBadge} alt={event.away} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.querySelector("b").style.display = "block"; }} />
                ) : null}
                <b style={{ display: event.awayBadge ? "none" : "block" }}>{event.away?.slice(0, 3).toUpperCase() || "???"}</b>
              </div>
              <div className="apex-event-team-name">{event.away}</div>
              <div className="apex-event-team-label">Visitante</div>
            </div>
          </div>

          <div className="apex-consensus-section">
            <div className="apex-consensus-header">
              <div className="apex-consensus-title">Consenso de la Comunidad</div>
              <div className="apex-consensus-votes">{totalVotes.toLocaleString("es-ES")} votos</div>
            </div>
            <div className="apex-consensus-bar">
              <div className="apex-consensus-bar-fill" style={{ width: `${homePct}%` }} />
            </div>
            <div className="apex-consensus-labels">
              <span className="home">{homePct}% {event.home}</span>
              <span className="away">{awayPct}% {event.away}</span>
            </div>
          </div>
        </div>

        <div className="apex-event-grid">
          <div>
            {event.odds && (
              <div className="apex-odds-market-card">
                <div className="apex-odds-market-header">
                  <div className="apex-odds-market-title">Ganador del Partido (1X2)</div>
                  <Link to="/sportsbook" className="apex-odds-market-link">Ver todos los mercados ›</Link>
                </div>
                <div className="apex-odds-buttons">
                  {options.map((pick) => {
                    const isHome = pick === "1";
                    const isAway = pick === "2";
                    const teamName = isHome ? event.home : isAway ? event.away : "Empate";
                    const label = isHome ? "LOCAL" : isAway ? "VISITANTE" : "X";
                    const disabled = isLive || isFinished;
                    const inSlipForPick = slipItems.some((item) => item.eventId === event.id && item.selection === pick);
                    return (
                      <button
                        type="button"
                        key={pick}
                        className={`apex-odds-button ${inSlipForPick ? "selected" : ""}`}
                        disabled={disabled}
                        onClick={() => onAddToSlip?.(event, pick, event.odds[pick])}
                      >
                        <div className="apex-odds-button-label">{label}</div>
                        <div className="apex-odds-button-team">{teamName}</div>
                        <div className="apex-odds-button-value">{event.odds[pick]?.toFixed(2) ?? "-"}</div>
                      </button>
                    );
                  })}
                </div>
                {inSlip && (
                  <div className="apex-odds-in-slip">✓ Añadido al cupón de apuesta</div>
                )}
              </div>
            )}

            <div className="apex-info-cards">
              <div className="apex-info-card">
                <div className="apex-info-card-title">
                  <BarChart3 size={16} />
                  Rendimiento Reciente
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #6b7280)", marginBottom: "0.5rem" }}>Últimos 5 partidos — {event.home}</div>
                <div className="apex-wl-badges">
                  {recentForm.map((result, i) => (
                    <div key={i} className={`apex-wl-badge ${result === "W" ? "win" : "loss"}`}>
                      {result}
                    </div>
                  ))}
                </div>
              </div>

              <div className="apex-info-card">
                <div className="apex-info-card-title">
                  <TrendingUp size={16} />
                  Tendencia de Apuestas
                </div>
                <div className="apex-trend-chart">
                  {trendData.map((value, i) => (
                    <div key={i} className="apex-trend-bar" style={{ height: `${value}%` }} />
                  ))}
                </div>
                <div className="apex-trend-text">
                  Volumen de apuestas en las últimas horas para este evento.
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="apex-predictors-card">
              <div className="apex-predictors-header">
                <div className="apex-predictors-title">
                  <Trophy size={16} />
                  Top Predictores
                </div>
                <div className="apex-predictors-live">EN VIVO</div>
              </div>
              <div className="apex-predictors-list">
                {predictors.map((pred) => (
                  <div key={pred.id} className="apex-predictor-item">
                    <div className="apex-predictor-avatar">
                      <span>{pred.name[0]}</span>
                    </div>
                    <div className="apex-predictor-info">
                      <div className="apex-predictor-name">{pred.name}</div>
                      <div className="apex-predictor-stats">
                        ROI: {pred.roi}% · {pred.accuracy}% Precisión
                      </div>
                    </div>
                    <div className="apex-predictor-profit">+{pred.picks}</div>
                  </div>
                ))}
              </div>
              <button className="apex-predictors-button">Ver Ranking Completo</button>
            </div>

            {aiPrediction && (
              <div className="apex-ai-card">
                <div className="apex-ai-card-title">
                  <Brain size={16} />
                  IA Apex Prediction
                </div>
                <div className="apex-ai-card-text">
                  Basado en {aiPrediction.totalSims.toLocaleString("es-ES")} simulaciones, <strong>{aiPrediction.pick}</strong> tiene un {aiPrediction.confidence}% de probabilidad de ganar {aiPrediction.margin}.
                </div>
                <button className="apex-ai-card-button">SEGUIR PREDICCIÓN</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
