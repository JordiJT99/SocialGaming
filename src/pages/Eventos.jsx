import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, CircleDot, Flame, Info, List, LoaderCircle, PlayCircle, Search, ShieldCheck, Star, Trophy, X } from "lucide-react";

const SPORTS = [
  { key: "all", name: "Todo", icon: "🌐" },
  { key: "football", name: "Fútbol", icon: "⚽" },
  { key: "basketball", name: "Baloncesto", icon: "🏀" },
  { key: "tennis", name: "Tenis", icon: "🎾" },
  { key: "baseball", name: "Béisbol", icon: "⚾" },
  { key: "hockey", name: "Hockey", icon: "🏒" },
  { key: "motorsport", name: "Motor", icon: "🏎️" },
];

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name?.slice(0, 3).toUpperCase() || "???"}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
}

function LiveMatchCard({ match, onAddToSlip, slipItems = [] }) {
  return (
    <Link to={`/events/${match.id}`} className="apex-live-card" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="apex-live-card-league">
        {match.elapsed && <span className="apex-live-badge-sm">LIVE</span>}
        <span className="apex-live-card-league-name">{match.league || "Evento"}</span>
      </div>
      <div className="apex-live-card-body">
        <div className="apex-live-card-team">
          <Crest src={match.homeBadge} name={match.home} />
          <span className="apex-live-card-team-name">{match.home}</span>
        </div>
        <div className="apex-live-card-score">{match.score || "0 - 0"}</div>
        <div className="apex-live-card-team">
          <Crest src={match.awayBadge} name={match.away} />
          <span className="apex-live-card-team-name">{match.away}</span>
        </div>
      </div>
      <span className="apex-live-card-closed">Cerrado</span>
    </Link>
  );
}

function UpcomingRow({ match, onAddToSlip, slipItems = [] }) {
  return null;
}

function QuinielaRow({ match, onAddToSlip, slipItems = [] }) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isClosed = isFinished || isLive;
  const options = match.odds
    ? [["1", match.odds[1]], ...(match.odds.X ? [["X", match.odds.X]] : []), ["2", match.odds[2]]]
    : [];
  const d = new Date(match.date);
  const dayName = d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
  const day = d.getDate();
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const finalScore = match.score || (match.homeScore != null && match.awayScore != null ? `${match.homeScore} - ${match.awayScore}` : null);

  const handlePick = (e, pick, odd) => {
    e.preventDefault();
    e.stopPropagation();
    if (isClosed) return;
    onAddToSlip?.(match, pick, odd);
  };

  return (
    <Link to={`/events/${match.id}`} className="apex-quiniela-row" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="apex-quiniela-row-league">
        <span className="apex-quiniela-row-league-icon">{SPORTS.find((s) => s.key === (match.sportKey || "football"))?.icon || "🏆"}</span>
        <div>
          <strong>{match.league || "Evento"}</strong>
          <small>{match.sportName || "Deporte"}</small>
        </div>
      </div>
      <div className="apex-quiniela-row-when">
        <div className="apex-quiniela-row-date">
          <span>{dayName}</span>
          <strong>{day}</strong>
          <small>{month}</small>
        </div>
        <span className="apex-quiniela-row-time">{isFinished ? "FIN" : isLive ? "EN VIVO" : time}</span>
      </div>
      <div className="apex-quiniela-row-match">
        <div className="apex-quiniela-row-team">
          <Crest src={match.homeBadge} name={match.home} />
          <span>{match.home}</span>
        </div>
        <span className="apex-quiniela-row-vs">vs</span>
        <div className="apex-quiniela-row-team away">
          <Crest src={match.awayBadge} name={match.away} />
          <span>{match.away}</span>
        </div>
        {isFinished && finalScore && (
          <div className="apex-quiniela-row-final-inline">
            <strong>{finalScore}</strong>
          </div>
        )}
      </div>
      <div className="apex-quiniela-row-market" onClick={(e) => e.preventDefault()}>
        {isClosed ? (
          <div className="apex-quiniela-row-closed">
            {isLive ? "Mercado cerrado · en directo" : "Finalizado"}
          </div>
        ) : (
          <div className="apex-quiniela-row-odds">
            {options.map(([pick, odd]) => {
              const inSlip = slipItems.find((item) => item.eventId === match.id && item.selection === pick);
              return (
                <button
                  key={pick}
                  type="button"
                  className={inSlip ? "selected" : ""}
                  onClick={(e) => handlePick(e, pick, odd)}
                >
                  <small>{pick}</small>
                  <b>{odd?.toFixed(2) ?? "—"}</b>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Eventos({ sportsData, onSportSelect, store, onAddToSlip, slipItems = [], user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sportFilter = searchParams.get("sport") || "all";
  const [viewMode, setViewMode] = useState(searchParams.get("tab") || "live");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const matchesSearch = (match, query) => {
    if (!query) return true;
    const q = normalize(query);
    if (!q) return true;
    const haystack = [match.home, match.away, match.league, match.sportName].filter(Boolean).map(normalize).join(" ");
    return haystack.includes(q);
  };

  const allMatches = sportsData.matches.filter((match) => {
    const sportOk = sportFilter === "all" || (match.sportKey || "football") === sportFilter;
    const hasOdds = match.odds && Object.keys(match.odds).length > 0;
    const now = Date.now();
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
    const withinWindow = match.status === "live" || (match.status !== "finished" && new Date(match.date).getTime() <= now + FIFTEEN_DAYS);
    return sportOk && matchesSearch(match, searchQuery) && withinWindow && hasOdds;
  });

  const liveMatches = allMatches.filter((match) => match.status === "live");
  const upcomingMatches = allMatches.filter((match) => match.status !== "finished" && match.status !== "live")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const finishedMatches = allMatches.filter((match) => match.status === "finished")
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  const betCountByEvent = useMemo(() => {
    const counts = new Map();
    for (const pred of store?.predictions || []) {
      counts.set(pred.matchId, (counts.get(pred.matchId) || 0) + 1);
    }
    return counts;
  }, [store?.predictions]);

  const popularMatches = useMemo(() => {
    return [...upcomingMatches]
      .sort((a, b) => {
        const aBets = betCountByEvent.get(a.id) || 0;
        const bBets = betCountByEvent.get(b.id) || 0;
        if (aBets !== bBets) return bBets - aBets;
        return new Date(a.date) - new Date(b.date);
      })
      .slice(0, 10);
  }, [upcomingMatches, betCountByEvent]);

  const displayedMatches = viewMode === "populares" ? popularMatches : viewMode === "finished" ? finishedMatches : upcomingMatches;

  const setViewModeWithUrl = (mode) => {
    setViewMode(mode);
    const next = new URLSearchParams(searchParams);
    if (mode === "live" || mode === "all") next.delete("tab"); else next.set("tab", mode);
    setSearchParams(next, { replace: true });
  };

  const isFinishedView = viewMode === "finished";

  const activeLeague = upcomingMatches.find((m) => m.league)?.league || "Fútbol Europeas";

  return (
    <div className="product-page sportsbook-page">
      <div className="eventos-content">
        {/* Sport filter */}
        <div className="apex-eventos-sport-filter">
          {SPORTS.map((sport) => (
            <button
              key={sport.key}
              className={sportFilter === sport.key ? "active" : ""}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (sport.key === "all") next.delete("sport"); else next.set("sport", sport.key);
                setSearchParams(next, { replace: true });
                onSportSelect?.(sport.key);
              }}
            >
              <span className="apex-eventos-sport-icon">{sport.icon}</span>
              {sport.name}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="apex-event-search">
          <Search size={18} className="apex-event-search-icon" />
          <input
            type="text"
            placeholder="Buscar eventos, ligas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              const next = new URLSearchParams(searchParams);
              if (e.target.value) next.set("q", e.target.value);
              else next.delete("q");
              setSearchParams(next, { replace: true });
            }}
            className="apex-event-search-input"
          />
          {searchQuery && (
            <button type="button" className="apex-event-search-clear" onClick={() => { setSearchQuery(""); const next = new URLSearchParams(searchParams); next.delete("q"); setSearchParams(next, { replace: true }); }} aria-label="Limpiar">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Live section */}
        {liveMatches.length > 0 && (
          <section className="apex-eventos-section">
            <div className="apex-section-title">
              <h2><span className="apex-live-dot" /> Eventos En Directo</h2>
              <Link to={`/events?sport=${sportFilter}&tab=live`}>Ver todos ({liveMatches.length})</Link>
            </div>
            <div className="apex-live-cards-grid">
              {liveMatches.map((match) => (
                <LiveMatchCard
                  key={match.id}
                  match={match}
                  onAddToSlip={onAddToSlip}
                  slipItems={slipItems}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming section */}
        <section className="apex-eventos-section">
          <div className="apex-section-title">
            <h2>{isFinishedView ? "Últimos Resultados" : viewMode === "populares" ? "Eventos Populares" : viewMode === "all" ? "Todos los Eventos" : "Próximos Eventos"}</h2>
            {!isFinishedView ? (
              <div className="apex-eventos-view-tabs">
                <button type="button" className={viewMode === "all" ? "active" : ""} onClick={() => setViewModeWithUrl("all")}>
                  <List size={14} /> Todo
                </button>
                <button type="button" className={viewMode === "proximos" ? "active" : ""} onClick={() => setViewModeWithUrl("proximos")}>
                  <CircleDot size={14} /> Liga
                </button>
                <button type="button" className={viewMode === "populares" ? "active" : ""} onClick={() => setViewModeWithUrl("populares")}>
                  <Flame size={14} /> Populares
                </button>
              </div>
            ) : (
              <span className="apex-section-count">{finishedMatches.length} {finishedMatches.length === 1 ? "partido" : "partidos"}</span>
            )}
          </div>
          {!isFinishedView && viewMode === "proximos" && (
            <div className="apex-eventos-filter-info">
              <span>Filtrado por: <strong>{activeLeague}</strong></span>
            </div>
          )}

          {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando eventos</strong></div>}
          {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error al cargar eventos</strong><p>{sportsData.error}</p></div>}
          {!sportsData.loading && !sportsData.error && allMatches.length === 0 && (
            <div className="api-state">
              <Info size={24} />
              {searchQuery
                ? <><strong>No se encontraron resultados para "{searchQuery}"</strong><small>Prueba con otro término o cambia el filtro de deporte</small></>
                : <strong>No hay eventos disponibles</strong>}
            </div>
          )}

          {displayedMatches.length > 0 && (
            <div className="apex-quiniela-list">
              {displayedMatches.slice(0, 8).map((match) => (
                <QuinielaRow
                  key={match.id}
                  match={match}
                  onAddToSlip={onAddToSlip}
                  slipItems={slipItems}
                />
              ))}
            </div>
          )}

          {displayedMatches.length > 8 && (
            <div className="apex-eventos-load-more">
              <button type="button">Cargar más eventos ↓</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
