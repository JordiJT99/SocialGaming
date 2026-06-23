import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CircleDot, Flame, Info, LoaderCircle, PlayCircle, ShieldCheck, Trophy } from "lucide-react";

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

export default function Eventos({ sportsData, onSportSelect, store }) {
  const [sportFilter, setSportFilter] = useState("all");
  const [viewMode, setViewMode] = useState("proximos");

  const allMatches = sportsData.matches.filter((match) =>
    sportFilter === "all" || (match.sportKey || "football") === sportFilter,
  );

  const filtered = allMatches.filter((match) => match.status !== "finished");

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
              <div className="event-markets" style={{ padding: "0.5rem 1rem 1rem", gap: "0.5rem" }}>
                {picks.map(([pick, odd]) => (
                  <span key={pick} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
                    padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
                    border: "1px solid var(--border)", background: "var(--bg-card)",
                    minWidth: "70px",
                    opacity: hasOdds ? 1 : 0.5,
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{pick}</span>
                    <b style={{ fontSize: "0.95rem" }}>{odd != null ? odd.toFixed(2) : "—"}</b>
                  </span>
                ))}
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
                  <div className="event-markets" style={{ padding: "0.5rem 1rem 1rem", gap: "0.5rem" }}>
                    {picks.map(([pick, odd]) => (
                      <span key={pick} style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem",
                        padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
                        border: "1px solid var(--border)", background: "var(--bg-card)",
                        minWidth: "70px",
                        opacity: hasOdds ? 1 : 0.5,
                      }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{pick}</span>
                        <b style={{ fontSize: "0.95rem" }}>{odd != null ? odd.toFixed(2) : "—"}</b>
                      </span>
                    ))}
                  </div>
                </article>
              </Link>
              );
            })}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
