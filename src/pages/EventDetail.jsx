import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, Clock, Minus, Plus, TrendingUp, XCircle } from "lucide-react";

const MOCK_USERS = [
  { id: "user2", username: "Marina", points: 17650, accuracy: 68 },
  { id: "user3", username: "Alex", points: 16980, accuracy: 65 },
  { id: "user4", username: "Claudia", points: 15320, accuracy: 70 },
  { id: "user5", username: "Marc", points: 14890, accuracy: 63 },
  { id: "user6", username: "Nora", points: 14210, accuracy: 67 },
  { id: "user7", username: "Pablo", points: 13540, accuracy: 61 },
  { id: "user8", username: "Laura", points: 12870, accuracy: 66 },
];

const MOCK_SELECTIONS = ["1", "X", "2"];

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name?.slice(0, 3).toUpperCase() || "???"}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
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

const MIN_BET = 50;

export default function EventDetail({ sportsData, store, onPredict, user }) {
  const { eventId } = useParams();
  const event = sportsData.matches.find((m) => String(m.id) === eventId);
  const [selectedPick, setSelectedPick] = useState(null);
  const [amount, setAmount] = useState(MIN_BET);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const balance = user?.points || 0;

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

  const handleConfirm = async () => {
    if (!selectedPick || !event || submitting) return;
    if (!Number.isInteger(amount) || amount < MIN_BET || amount > balance) return;
    setSubmitting(true);
    setError("");
    try {
      await onPredict?.(event.id, selectedPick, amount, event.oddsEventId, event.odds[selectedPick], {
        home: event.home,
        away: event.away,
        homeBadge: event.homeBadge,
        awayBadge: event.awayBadge,
      });
      setSelectedPick(null);
      setAmount(MIN_BET);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="product-page sportsbook-page">
      <header className="product-hero sportsbook-hero" style={{ paddingBottom: "1rem" }}>
        <Link to="/events" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          <ArrowLeft size={16} /> Volver a eventos
        </Link>
        <div className="event-info" style={{ padding: "0" }}>
          <span>{event.league || event.tournament || "Evento"}</span>
          <small>
            {new Date(event.date).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            {isLive && <span style={{ color: "var(--green)", marginLeft: "0.5rem" }}>● EN DIRECTO</span>}
            {isFinished && <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>FINALIZADO</span>}
          </small>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem", padding: "2rem 0 1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", flex: 1 }}>
            <Crest src={event.homeBadge} name={event.home} />
            <strong style={{ fontSize: "1.15rem", textAlign: "center", maxWidth: "200px" }}>{event.home}</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>vs</span>
            {(isLive || isFinished) && event.score && (
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-bright)", lineHeight: 1 }}>{event.score}</div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", flex: 1 }}>
            <Crest src={event.awayBadge} name={event.away} />
            <strong style={{ fontSize: "1.15rem", textAlign: "center", maxWidth: "200px" }}>{event.away}</strong>
          </div>
        </div>

        {event.odds && (
          <div style={{ padding: "0 0 0.5rem" }}>
            <div className="event-markets" style={{ justifyContent: "center" }}>
              {options.map((pick) => {
                const dist = distribution[pick];
                const pct = dist?.pct || 0;
                const disabled = !!existingPrediction || isLive || isFinished;
                return (
                  <button
                    type="button"
                    key={pick}
                    className={selectedPick === pick ? "selected" : existingPrediction?.selection === pick ? "selected" : ""}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedPick(selectedPick === pick ? null : pick);
                      setAmount(MIN_BET);
                      setError("");
                    }}
                    style={{ flexDirection: "column", gap: "0.25rem", position: "relative", overflow: "hidden" }}
                  >
                    <span>{pick}</span>
                    <b>{event.odds[pick]?.toFixed(2) ?? "-"}</b>
                    {totalDistCoins > 0 && (
                      <small style={{ fontSize: "0.7rem", opacity: 0.7 }}>{pct}%</small>
                    )}
                    {totalDistCoins > 0 && (
                      <span style={{ position: "absolute", bottom: 0, left: 0, height: "3px", width: `${pct}%`, background: "var(--accent)", borderRadius: "2px" }} />
                    )}
                  </button>
                );
              })}
            </div>
            {totalDistCoins > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                {options.map((pick) => {
                  const d = distribution[pick];
                  return d ? (
                    <span key={pick}>{pick}: {d.coins.toLocaleString("es-ES")} coins ({d.pct}%)</span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {existingPrediction && (
          <div style={{ textAlign: "center", padding: "0.5rem", color: "var(--gold)", fontSize: "0.85rem" }}>
            Ya tienes una predicción en este evento ({existingPrediction.selection} @ {Number(existingPrediction.confirmedOdds || existingPrediction.offeredOdds).toFixed(2)})
          </div>
        )}
      </header>

      {selectedPick && !existingPrediction && !isLive && !isFinished && event.odds?.[selectedPick] && (
        <div className="apex-bet-panel" style={{
          margin: "1rem auto", padding: "1.5rem",
          background: "#0a3546", borderRadius: "16px",
          border: "1px solid rgba(23, 162, 184, 0.3)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(23, 162, 184, 0.2)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#ffffff" }}>
                {selectedPick === "1" ? event.home : selectedPick === "2" ? event.away : "Empate"}
              </span>
              <span style={{ fontSize: "0.72rem", color: "rgba(183, 227, 244, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tu selección</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem" }}>
              <b style={{ color: "#17a2b8", fontSize: "1.2rem" }}>@ {event.odds[selectedPick].toFixed(2)}</b>
              <span style={{ fontSize: "0.72rem", color: "rgba(183, 227, 244, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cuota</span>
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.78rem", color: "rgba(183, 227, 244, 0.7)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Cantidad</span>
              <span style={{
                fontSize: "1.5rem", fontWeight: 800, color: amount >= MIN_BET && amount <= balance ? "#ffffff" : "#ff6b57",
                fontVariantNumeric: "tabular-nums",
              }}>
                {amount.toLocaleString("es-ES")} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "rgba(183, 227, 244, 0.6)" }}>coins</span>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <button type="button"
                disabled={amount <= MIN_BET}
                onClick={() => setAmount(Math.max(MIN_BET, amount - 50))}
                style={{
                  width: "44px", height: "44px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "10px", border: "1px solid rgba(23, 162, 184, 0.4)",
                  background: amount <= MIN_BET ? "rgba(255,255,255,0.03)" : "rgba(23, 162, 184, 0.15)",
                  color: amount <= MIN_BET ? "rgba(183, 227, 244, 0.4)" : "#ffffff",
                  cursor: amount <= MIN_BET ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Minus size={18} />
              </button>

              <div style={{ flex: 1, position: "relative", height: "8px", display: "flex", alignItems: "center" }}>
                <div style={{
                  position: "absolute", left: 0, right: 0, height: "6px",
                  background: "rgba(23, 162, 184, 0.15)", borderRadius: "99px",
                }} />
                <div style={{
                  position: "absolute", left: 0, height: "6px",
                  width: `${Math.min(100, Math.max(0, ((amount - MIN_BET) / Math.max(1, balance - MIN_BET)) * 100))}%`,
                  background: "linear-gradient(90deg, #17a2b8, #39d98a)", borderRadius: "99px",
                }} />
                <input
                  type="range"
                  min={MIN_BET}
                  max={Math.max(MIN_BET, balance)}
                  step="50"
                  value={Math.min(amount, Math.max(MIN_BET, balance))}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  style={{
                    position: "relative", width: "100%", height: "24px",
                    appearance: "none", WebkitAppearance: "none",
                    background: "transparent", cursor: "pointer", margin: 0, padding: 0,
                  }}
                />
              </div>

              <button type="button"
                disabled={amount >= balance}
                onClick={() => setAmount(Math.min(balance, amount + 50))}
                style={{
                  width: "44px", height: "44px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "10px", border: "1px solid rgba(23, 162, 184, 0.4)",
                  background: amount >= balance ? "rgba(255,255,255,0.03)" : "rgba(23, 162, 184, 0.15)",
                  color: amount >= balance ? "rgba(183, 227, 244, 0.4)" : "#ffffff",
                  cursor: amount >= balance ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Plus size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.4rem" }}>
              {[{ label: "Mín", val: MIN_BET }, { label: "¼", val: Math.floor(balance / 4) }, { label: "½", val: Math.floor(balance / 2) }, { label: "Máx", val: balance }].map((preset) => {
                const isActive = amount === preset.val;
                return (
                  <button key={preset.label} type="button"
                    onClick={() => setAmount(Math.max(MIN_BET, Math.min(balance, preset.val)))}
                    style={{
                      flex: 1, padding: "0.5rem", fontSize: "0.78rem", fontWeight: 700,
                      borderRadius: "8px",
                      border: isActive ? "1px solid #17a2b8" : "1px solid rgba(183, 227, 244, 0.2)",
                      background: isActive ? "#17a2b8" : "rgba(255,255,255,0.03)",
                      color: isActive ? "#ffffff" : "rgba(183, 227, 244, 0.8)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "0.85rem 1rem", borderRadius: "10px",
            background: "rgba(23, 162, 184, 0.08)",
            border: "1px solid rgba(23, 162, 184, 0.2)",
            marginBottom: "1.25rem",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
              <span style={{ fontSize: "0.7rem", color: "rgba(183, 227, 244, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Saldo</span>
              <b style={{ fontSize: "0.95rem", color: "#ffffff" }}>{balance.toLocaleString("es-ES")}</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.15rem" }}>
              <span style={{ fontSize: "0.7rem", color: "rgba(183, 227, 244, 0.6)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Posible retorno</span>
              <b style={{ fontSize: "1.1rem", color: "#39d98a" }}>
                {Number.isInteger(amount) && amount >= MIN_BET && amount <= balance
                  ? Math.round(amount * event.odds[selectedPick]).toLocaleString("es-ES")
                  : 0} <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>coins</span>
              </b>
            </div>
          </div>

          {error && <div style={{ color: "#ff6b57", fontSize: "0.85rem", marginBottom: "0.75rem", textAlign: "center", padding: "0.5rem", background: "rgba(255, 107, 87, 0.1)", borderRadius: "8px" }}>{error}</div>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button"
              onClick={() => { setSelectedPick(null); setError(""); }}
              style={{
                padding: "0.8rem 1.2rem", borderRadius: "10px",
                border: "1px solid rgba(183, 227, 244, 0.2)",
                background: "transparent", color: "rgba(183, 227, 244, 0.8)",
                cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
              }}
            >
              Cancelar
            </button>
            <button type="button"
              disabled={!Number.isInteger(amount) || amount < MIN_BET || amount > balance || submitting}
              onClick={handleConfirm}
              style={{
                flex: 1, padding: "0.8rem", borderRadius: "10px", border: "none",
                background: amount >= MIN_BET && amount <= balance ? "#17a2b8" : "rgba(183, 227, 244, 0.15)",
                color: amount >= MIN_BET && amount <= balance ? "#ffffff" : "rgba(183, 227, 244, 0.5)",
                cursor: amount >= MIN_BET && amount <= balance ? "pointer" : "not-allowed",
                fontWeight: 700, fontSize: "0.95rem",
                boxShadow: amount >= MIN_BET && amount <= balance ? "0 4px 12px rgba(23, 162, 184, 0.4)" : "none",
                transition: "all 0.15s",
              }}
            >
              {submitting ? "Validando..." : "Confirmar apuesta"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: "1.5rem", padding: "1.5rem 1rem", maxWidth: "800px", margin: "0 auto" }}>
        <section>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem", marginBottom: "1rem" }}>
            <BarChart3 size={18} /> Ranking de apuestas
          </h2>
          {ranking.length === 0 ? (
            <p className="empty-state">No hay apuestas en este evento.</p>
          ) : (
            <div className="ranking-table compact">
              {ranking.map((row) => {
                const StatusIcon = statusLabel(row.predictions?.[0]?.status || "pending").icon;
                return (
                  <div key={row.id} className={`ranking-row ${row.id === "current_user" ? "is-me" : ""}`}>
                    <span className="rank-number">#{row.rank}</span>
                    <span className="rank-avatar">{row.username?.[0]?.toUpperCase() || "?"}</span>
                    <span className="rank-name" style={{ flex: 1 }}>{row.username}</span>
                    <span className="rank-stats">
                      <span className="rank-points">{row.totalBet.toLocaleString("es-ES")} coins</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {row.selections.join(", ")}
                      </span>
                    </span>
                    {row.predictions?.[0] && (
                      <StatusIcon size={16} style={{ color: statusLabel(row.predictions[0].status).color, marginLeft: "0.5rem" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem", marginBottom: "1rem" }}>
            <Clock size={18} /> Historial de apuestas
          </h2>
          {predictions.length === 0 ? (
            <p className="empty-state">No hay actividad en este evento.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {predictions.map((pred) => {
                const Icon = statusLabel(pred.status).icon;
                const user = [...MOCK_USERS, store.users.find((u) => u.id === "current_user")].find((u) => u?.id === pred.userId);
                return (
                  <div key={pred.id} className="bet-event" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span className="rank-avatar" style={{ width: "32px", height: "32px" }}>
                        {user?.username?.[0]?.toUpperCase() || "?"}
                      </span>
                      <div>
                        <strong style={{ fontSize: "0.9rem" }}>{user?.username || "Anónimo"}</strong>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          <span>{pred.selection} @ {Number(pred.confirmedOdds || pred.offeredOdds || 0).toFixed(2)}</span>
                          <span>·</span>
                          <span>{pred.pointsBet.toLocaleString("es-ES")} coins</span>
                        </div>
                      </div>
                    </div>
                    <Icon size={18} style={{ color: statusLabel(pred.status).color, flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
