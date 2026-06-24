import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, CircleDot, Flame, Info, LoaderCircle, PlayCircle, ShieldCheck, Trophy, X } from "lucide-react";

const SPORTS = [
  { key: "football", name: "Fútbol" },
  { key: "basketball", name: "Baloncesto" },
  { key: "tennis", name: "Tenis" },
  { key: "baseball", name: "Béisbol" },
  { key: "hockey", name: "Hockey" },
  { key: "boxing", name: "Boxeo" },
  { key: "mma", name: "MMA" },
];

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name?.slice(0, 3).toUpperCase() || "???"}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

export default function Eventos({ sportsData, onSportSelect, store, onPredict, user }) {
  const [sportFilter, setSportFilter] = useState("all");
  const [viewMode, setViewMode] = useState("proximos");
  const [slip, setSlip] = useState([]);
  const [slipAmount, setSlipAmount] = useState(50);
  const [slipOpen, setSlipOpen] = useState(false);
  const [slipSubmitting, setSlipSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (text, kind = "success") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2400);
  };

  const addToSlip = (event, pick) => {
    if (event.status === "live" || event.status === "finished") return;
    setSlip((current) => {
      const filtered = current.filter((item) => item.eventId !== event.id);
      return [...filtered, { eventId: event.id, event, pick }];
    });
    setSlipOpen(true);
  };

  const removeFromSlip = (eventId) => {
    setSlip((current) => current.filter((item) => item.eventId !== eventId));
  };

  const slipTotalOdds = slip.reduce((acc, item) => acc * (item.event.odds?.[item.pick] || 1), 1);
  const slipPotentialReturn = Math.round(slipAmount * slipTotalOdds);

  const confirmSlip = async () => {
    if (slip.length === 0) return;
    if ((user?.points || 0) < slipAmount) {
      navigate("/earn");
      return;
    }
    setSlipSubmitting(true);
    try {
      for (const item of slip) {
        await onPredict?.(item.eventId, item.pick, Math.floor(slipAmount / slip.length), item.event.oddsEventId, item.event.odds[item.pick], {
          home: item.event.home,
          away: item.event.away,
          homeBadge: item.event.homeBadge,
          awayBadge: item.event.awayBadge,
        });
      }
      showToast(`¡Apuesta confirmada! +${slipPotentialReturn.toLocaleString("es-ES")} coins posibles`);
      setSlip([]);
      setSlipOpen(false);
    } catch (err) {
      showToast(err.message || "Error al confirmar", "error");
    } finally {
      setSlipSubmitting(false);
    }
  };

  const allMatches = sportsData.matches.filter((match) =>
    sportFilter === "all" || (match.sportKey || "football") === sportFilter,
  );

  const filtered = allMatches.filter((match) => match.status !== "finished");

  const liveMatches = allMatches.filter((match) => match.status === "live").slice(0, 8);

  const betCountByEvent = useMemo(() => {
    const counts = new Map();
    for (const pred of store?.predictions || []) {
      counts.set(pred.matchId, (counts.get(pred.matchId) || 0) + 1);
    }
    return counts;
  }, [store?.predictions]);

  const { events, groups } = useMemo(() => {
    if (viewMode === "proximos") {
      const sorted = [...allMatches].sort((a, b) => {
        const aUpcoming = a.status !== "finished" ? 0 : 1;
        const bUpcoming = b.status !== "finished" ? 0 : 1;
        if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
        return new Date(a.date) - new Date(b.date);
      });
      return { events: sorted, groups: null };
    }
    if (viewMode === "populares") {
      const sorted = [...filtered].sort((a, b) => {
        const aBets = betCountByEvent.get(a.id) || 0;
        const bBets = betCountByEvent.get(b.id) || 0;
        if (aBets !== bBets) return bBets - aBets;
        return new Date(a.date) - new Date(b.date);
      });
      return { events: sorted, groups: null };
    }
    const grouped = {};
    for (const match of filtered) {
      const league = match.league || "Otros";
      if (!grouped[league]) grouped[league] = [];
      grouped[league].push(match);
    }
    for (const league of Object.keys(grouped)) {
      grouped[league].sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    return { events: null, groups: grouped };
  }, [allMatches, filtered, viewMode, betCountByEvent]);

  return (
    <div className="product-page sportsbook-page">
      <header className="product-hero sportsbook-hero" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", minHeight: "auto", padding: "1.25rem 1.5rem" }}>
        <div>
          <span className="product-eyebrow"><CircleDot size={14} /> Eventos deportivos</span>
          <h1 style={{ fontSize: "1.5rem" }}>Eventos</h1>
          <p style={{ marginTop: "0.25rem" }}>Explora todos los eventos disponibles y filtra por deporte.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.6rem", flexShrink: 0 }}>
          <Link to="/earn" style={{
            display: "inline-flex", alignItems: "center", gap: "0.55rem",
            padding: "0.55rem 1rem", borderRadius: "999px", textDecoration: "none",
            background: "linear-gradient(135deg, #ff6b57, #ff9a3c)",
            color: "#fff", fontSize: "0.82rem", fontWeight: 700,
            boxShadow: "0 4px 14px rgba(255, 107, 87, 0.35)",
          }}>
            <PlayCircle size={16} fill="#fff" stroke="#ff6b57" />
            <span>Mira este video y gana <b style={{ color: "#fff23d" }}>15 coins</b></span>
          </Link>
          <div className="virtual-only"><ShieldCheck size={16} /><div><strong>Modo gratuito</strong><span>Sin depósito ni retirada de dinero</span></div></div>
        </div>
      </header>

      {liveMatches.length > 0 && (
        <div className="apex-live-strip">
          <div className="apex-live-strip-head">
            <span className="apex-live-dot" />
            <strong>EN DIRECTO</strong>
            <small>{liveMatches.length} {liveMatches.length === 1 ? "partido" : "partidos"}</small>
          </div>
          <div className="apex-live-strip-scroll">
            {liveMatches.map((event) => {
              const odds = event.odds;
              const inSlip = slip.some((item) => item.eventId === event.id);
              return (
                <Link to={`/events/${event.id}`} key={event.id} className="apex-live-tile" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className="apex-live-tile-head">
                    <span>{event.league}</span>
                    <span className="apex-live-tile-score">{event.score || "—"}</span>
                  </div>
                  <div className="apex-live-tile-teams">
                    <strong>{event.home}</strong>
                    <span>vs</span>
                    <strong>{event.away}</strong>
                  </div>
                  {odds && (
                    <div className="apex-live-tile-odds">
                      {["1", "2"].map((pick) => (
                        <button
                          key={pick}
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToSlip(event, pick); }}
                          className={inSlip ? "in-slip" : ""}
                        >
                          <span>{pick}</span>
                          <b>{odds[pick]?.toFixed(2)}</b>
                        </button>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="eventos-content">
      <div className="market-toolbar">
        <div className="market-sports">
          <button className={sportFilter === "all" ? "active" : ""} onClick={() => setSportFilter("all")}>Todos</button>
          {SPORTS.map((sport) => (
            <button
              key={sport.key}
              className={sportFilter === sport.key ? "active" : ""}
              onClick={() => { setSportFilter(sport.key); onSportSelect?.(sport.key); }}
            >
              {sport.name}
            </button>
          ))}
        </div>
      </div>

      <div className="market-toolbar" style={{ marginTop: "0.5rem" }}>
        <div className="market-sports">
          <button className={viewMode === "proximos" ? "active" : ""} onClick={() => setViewMode("proximos")}>
            <CircleDot size={15} /> Próximos
          </button>
          <button className={viewMode === "populares" ? "active" : ""} onClick={() => setViewMode("populares")}>
            <Flame size={15} /> Populares
          </button>
          <button className={viewMode === "competicion" ? "active" : ""} onClick={() => setViewMode("competicion")}>
            <Trophy size={15} /> Competición
          </button>
        </div>
      </div>

      {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando eventos</strong></div>}
      {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error al cargar eventos</strong><p>{sportsData.error}</p></div>}
      {!sportsData.loading && !sportsData.error && allMatches.length === 0 && (
        <div className="api-state"><Info size={24} /><strong>No hay eventos disponibles</strong></div>
      )}

<div className="event-list" style={{ marginTop: "1rem" }}>
        {(viewMode === "proximos" || viewMode === "populares") && events?.map((event) => {
          const odds = event.odds;
          const hasOdds = !!odds;
          const picks = hasOdds ? [["1", odds[1]], ...(odds.X ? [["X", odds.X]] : []), ["2", odds[2]]] : [["1", null], ["2", null]];
          const betCount = betCountByEvent.get(event.id) || 0;
          return (
          <Link to={`/events/${event.id}`} key={event.id} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <article className="bet-event" style={{ cursor: "pointer" }}>
              <div className="event-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem 0.4rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{event.league || event.tournament || "Evento"}</span>
                  <small style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(event.date).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {betCount > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "999px", background: "rgba(255, 107, 87, 0.1)", color: "#ff6b57" }}>
                      <Flame size={11} /> {betCount} {betCount === 1 ? "apuesta" : "apuestas"}
                    </span>
                  )}
                  {event.status === "live" && <span style={{ fontSize: "0.7rem", color: "var(--green)", fontWeight: 700 }}>● EN DIRECTO</span>}
                </div>
              </div>
                  <div className="event-teams">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Crest src={event.homeBadge} name={event.home} />
                  <strong style={{ fontSize: "0.9rem" }}>{event.home}</strong>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end" }}>
                  <strong style={{ fontSize: "0.9rem", textAlign: "right" }}>{event.away}</strong>
                  <Crest src={event.awayBadge} name={event.away} />
                </div>
              </div>
              <div className="event-markets" style={{ padding: "0.5rem 1rem 1rem", gap: "0.5rem" }} onClick={(e) => e.preventDefault()}>
                {picks.map(([pick, odd]) => {
                  const inSlip = slip.some((item) => item.eventId === event.id && item.pick === pick);
                  return (
                    <button
                      key={pick}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasOdds) addToSlip(event, pick); }}
                      disabled={!hasOdds || event.status === "live" || event.status === "finished"}
                      className={inSlip ? "odds-chip in-slip" : "odds-chip"}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
                        padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
                        border: inSlip ? "1.5px solid #ff6b57" : "1px solid var(--border)",
                        background: inSlip ? "rgba(255, 107, 87, 0.12)" : "var(--bg-card)",
                        minWidth: "70px",
                        opacity: hasOdds ? 1 : 0.5,
                        cursor: hasOdds ? "pointer" : "not-allowed",
                      }}
                    >
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{pick}</span>
                      <b style={{ fontSize: "0.95rem" }}>{odd != null ? odd.toFixed(2) : "—"}</b>
                      {inSlip && <CheckCircle2 size={11} style={{ color: "#ff6b57" }} />}
                    </button>
                  );
                })}
              </div>
            </article>
          </Link>
          );
        })}
        {viewMode === "competicion" && groups && Object.entries(groups).map(([league, matches]) => (
          <div key={league} style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ padding: "0.75rem 1rem", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent)" }}>
              {league}
            </h3>
            {matches.map((event) => {
              const odds = event.odds;
              const hasOdds = !!odds;
              const picks = hasOdds ? [["1", odds[1]], ...(odds.X ? [["X", odds.X]] : []), ["2", odds[2]]] : [["1", null], ["2", null]];
              const betCount = betCountByEvent.get(event.id) || 0;
              return (
              <Link to={`/events/${event.id}`} key={event.id} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <article className="bet-event" style={{ cursor: "pointer" }}>
                  <div className="event-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 1rem 0.4rem" }}>
                    <small style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{new Date(event.date).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {betCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "999px", background: "rgba(255, 107, 87, 0.1)", color: "#ff6b57" }}>
                          <Flame size={11} /> {betCount}
                        </span>
                      )}
                      {event.status === "live" && <span style={{ fontSize: "0.7rem", color: "var(--green)", fontWeight: 700 }}>● EN DIRECTO</span>}
                    </div>
                  </div>
              <div className="event-teams">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Crest src={event.homeBadge} name={event.home} />
                      <strong style={{ fontSize: "0.9rem" }}>{event.home}</strong>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>vs</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end" }}>
                      <strong style={{ fontSize: "0.9rem", textAlign: "right" }}>{event.away}</strong>
                      <Crest src={event.awayBadge} name={event.away} />
                    </div>
                  </div>
                  <div className="event-markets" style={{ padding: "0.5rem 1rem 1rem", gap: "0.5rem" }} onClick={(e) => e.preventDefault()}>
                    {picks.map(([pick, odd]) => {
                      const inSlip = slip.some((item) => item.eventId === event.id && item.pick === pick);
                      return (
                        <button
                          key={pick}
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasOdds) addToSlip(event, pick); }}
                          disabled={!hasOdds || event.status === "live" || event.status === "finished"}
                          className={inSlip ? "odds-chip in-slip" : "odds-chip"}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
                            padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
                            border: inSlip ? "1.5px solid #ff6b57" : "1px solid var(--border)",
                            background: inSlip ? "rgba(255, 107, 87, 0.12)" : "var(--bg-card)",
                            minWidth: "70px",
                            opacity: hasOdds ? 1 : 0.5,
                            cursor: hasOdds ? "pointer" : "not-allowed",
                          }}
                        >
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{pick}</span>
                          <b style={{ fontSize: "0.95rem" }}>{odd != null ? odd.toFixed(2) : "—"}</b>
                          {inSlip && <CheckCircle2 size={11} style={{ color: "#ff6b57" }} />}
                        </button>
                      );
                    })}
                  </div>
                </article>
              </Link>
              );
            })}
          </div>
        ))}
      </div>
      </div>

      {slip.length > 0 && (
        <button
          type="button"
          className="apex-slip-fab"
          onClick={() => setSlipOpen((v) => !v)}
          aria-label={`Quiniela con ${slip.length} selección${slip.length > 1 ? "es" : ""}`}
        >
          <Trophy size={18} />
          <span>Quiniela · {slip.length}</span>
          <b>{slipTotalOdds.toFixed(2)}</b>
        </button>
      )}

      {slipOpen && slip.length > 0 && (
        <div className="apex-slip-panel" role="dialog" aria-label="Tu quiniela">
          <header>
            <strong>Tu quiniela ({slip.length})</strong>
            <button type="button" onClick={() => setSlipOpen(false)} aria-label="Cerrar"><X size={18} /></button>
          </header>
          <div className="apex-slip-picks">
            {slip.map((item) => (
              <div key={`${item.eventId}-${item.pick}`}>
                <div>
                  <small>{item.event.league || "Evento"}</small>
                  <strong>{item.event.home} vs {item.event.away}</strong>
                </div>
                <div className="apex-slip-pick">
                  <span>{item.pick === "1" ? item.event.home : item.pick === "2" ? item.event.away : "Empate"}</span>
                  <b>@{item.event.odds[item.pick]?.toFixed(2)}</b>
                  <button type="button" onClick={() => removeFromSlip(item.eventId)} aria-label="Quitar"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="apex-slip-amount">
            <div>
              <span>Importe por pick</span>
              <strong>{(slipAmount / Math.max(1, slip.length)).toFixed(0)} coins</strong>
            </div>
            <label>
              <span>Total a jugar</span>
              <input
                type="number"
                min={50 * slip.length}
                max={user?.points || 0}
                step="50"
                value={slipAmount}
                onChange={(e) => setSlipAmount(Math.max(50 * slip.length, Number(e.target.value) || 0))}
              />
            </label>
          </div>
          <div className="apex-slip-total">
            <div>
              <span>Cuota total</span>
              <b>{slipTotalOdds.toFixed(2)}</b>
            </div>
            <div>
              <span>Posible retorno</span>
              <b style={{ color: "#39d98a" }}>+{slipPotentialReturn.toLocaleString("es-ES")} coins</b>
            </div>
          </div>
          {(user?.points || 0) < slipAmount && (
            <div className="apex-slip-warn">
              Saldo insuficiente. <Link to="/earn" onClick={() => setSlipOpen(false)}>Ver anuncios para conseguir monedas</Link>
            </div>
          )}
          <div className="apex-slip-actions">
            <button type="button" onClick={() => setSlip([])} className="apex-slip-clear">Limpiar</button>
            <button
              type="button"
              onClick={confirmSlip}
              disabled={slipSubmitting || (user?.points || 0) < slipAmount}
              className="apex-slip-confirm"
            >
              {slipSubmitting ? "Validando..." : `Jugar ${slipAmount.toLocaleString("es-ES")} coins`}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`apex-toast ${toast.kind}`}>
          {toast.kind === "success" && <CheckCircle2 size={18} />}
          {toast.kind === "error" && <AlertCircle size={18} />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
