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
  esports: "e-Sports",
};

const MOCK_USERS = [
  { id: "user2", username: "Marco Elite", points: 17650, accuracy: 89, avatar: "https://i.pravatar.cc/80?u=marco" },
  { id: "user3", username: "DataQueen_88", points: 16980, accuracy: 84, avatar: "https://i.pravatar.cc/80?u=dataqueen" },
  { id: "user4", username: "SharkPredictor", points: 15320, accuracy: 81, avatar: "https://i.pravatar.cc/80?u=shark" },
  { id: "user5", username: "Marc", points: 14890, accuracy: 78, avatar: "https://i.pravatar.cc/80?u=marc" },
  { id: "user6", username: "Nora", points: 14210, accuracy: 76, avatar: "https://i.pravatar.cc/80?u=nora" },
  { id: "user7", username: "Pablo", points: 13540, accuracy: 73, avatar: "https://i.pravatar.cc/80?u=pablo" },
  { id: "user8", username: "Laura", points: 12870, accuracy: 71, avatar: "https://i.pravatar.cc/80?u=laura" },
];

const MOCK_SELECTIONS = ["1", "X", "2"];

const MOCK_PERFORMANCE = ["W", "W", "L", "W", "W"];

const MOCK_TREND = [30, 45, 35, 60, 55, 70, 85];

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

  const { predictions, ranking, distribution } = useMemo(() => {
    if (!event) return { predictions: [], ranking: [], distribution: {} };

    const realPreds = store.predictions.filter((p) => String(p.matchId) === eventId);

    const mockPreds = MOCK_USERS.map((user, i) => {
      const existing = realPreds.find((p) => p.userId === user.id);
      if (existing) return null;
      const pick = MOCK_SELECTIONS[i % 3];
      const odd = event.odds?.[pick] || 2.0;
      const statuses = ["pending", "pending", "pending", "won", "lost"];
      return {
        id: `mock_${user.id}_${eventId}`,
        userId: user.id,
        matchId: eventId,
        selection: pick,
        pointsBet: [50, 100, 200, 150, 75, 300, 250][i],
        pointsWon: 0,
        status: statuses[i % statuses.length],
        isMock: true,
        createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        confirmedOdds: odd,
      };
    }).filter(Boolean);

    const allPreds = [...realPreds, ...mockPreds].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    const dist = {};
    let totalBet = 0;
    for (const pred of allPreds) {
      const pick = pred.selection;
      if (!dist[pick]) dist[pick] = 0;
      dist[pick] += pred.pointsBet;
      totalBet += pred.pointsBet;
    }
    const distribution = totalBet > 0 ? Object.fromEntries(
      Object.entries(dist).map(([k, v]) => [k, { coins: v, pct: Math.round((v / totalBet) * 100) }]),
    ) : {};

    const allUsers = [store.users.find((u) => u.id === "current_user"), ...MOCK_USERS].filter(Boolean);

    const rankMap = {};
    for (const pred of allPreds) {
      const user = allUsers.find((u) => u.id === pred.userId);
      if (!user) continue;
      if (!rankMap[pred.userId]) {
        rankMap[pred.userId] = { ...user, totalBet: 0, selections: [], predictions: [] };
      }
      rankMap[pred.userId].totalBet += pred.pointsBet;
      rankMap[pred.userId].selections.push(pred.selection);
      rankMap[pred.userId].predictions.push(pred);
    }

    const ranking = Object.values(rankMap)
      .sort((a, b) => b.totalBet - a.totalBet)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    return { predictions: allPreds, ranking, distribution };
  }, [event, eventId, store.predictions, store.users]);

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
  const totalDistCoins = Object.values(distribution).reduce((s, d) => s + d.coins, 0);
  const sportName = SPORT_LABELS[event.sportKey] || event.sportKey || "Deporte";
  const leagueName = event.league || event.tournament || "Liga";

  const homePct = distribution["1"]?.pct || 50;
  const awayPct = distribution["2"]?.pct || 50;
  const totalVotes = totalDistCoins || 0;

  const inSlip = slipItems.some((item) => item.eventId === event.id);

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
              {isLive && (
                <div className="apex-event-live-badge">EN VIVO · Q3 04:12</div>
              )}
              {(isLive || isFinished) && event.score && (
                <div className="apex-event-score">{event.score}</div>
              )}
              <div className="apex-event-venue">
                <MapPin size={12} />
                <span>Gainbridge Fieldhouse</span>
              </div>
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
                    const disabled = !!existingPrediction || isLive || isFinished;
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
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted, #6b7280)", marginBottom: "0.5rem" }}>Últimos 5 partidos</div>
                <div className="apex-wl-badges">
                  {MOCK_PERFORMANCE.map((result, i) => (
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
                  {MOCK_TREND.map((value, i) => (
                    <div key={i} className="apex-trend-bar" style={{ height: `${value}%` }} />
                  ))}
                </div>
                <div className="apex-trend-text">
                  Incremento del 15% en el volumen de apuestas en los últimos 10 min.
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
                {ranking.slice(0, 3).map((row) => (
                  <div key={row.id} className="apex-predictor-item">
                    <div className="apex-predictor-avatar">
                      {row.avatar
                        ? <img src={row.avatar} alt="" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "block"; }} />
                        : null}
                      <span style={{ display: row.avatar ? "none" : "block" }}>{row.username?.[0]?.toUpperCase() || "?"}</span>
                    </div>
                    <div className="apex-predictor-info">
                      <div className="apex-predictor-name">{row.username}</div>
                      <div className="apex-predictor-stats">
                        ROI: {(row.accuracy * 0.2).toFixed(1)}% · {row.accuracy}% Precisión
                      </div>
                    </div>
                    <div className="apex-predictor-profit">+{(row.totalBet / 1000).toFixed(1)}k</div>
                  </div>
                ))}
              </div>
              <button className="apex-predictors-button">Ver Ranking Completo</button>
            </div>

            <div className="apex-ai-card">
              <div className="apex-ai-card-title">
                <Brain size={16} />
                IA Apex Prediction
              </div>
              <div className="apex-ai-card-text">
                Basado en 25,000 simulaciones, {event.home} tiene un 78.4% de probabilidad de ganar por &gt;6 puntos.
              </div>
              <button className="apex-ai-card-button">SEGUIR PREDICCIÓN</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
