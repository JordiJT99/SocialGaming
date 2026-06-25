import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CircleDot, Flame, Info, List, LoaderCircle, Search, ShieldCheck, Star, X } from "lucide-react";

const SPORT_FILTERS = [
  { key: "all", name: "Todos", icon: "🌐" },
  { key: "football", name: "Fútbol", icon: "⚽" },
  { key: "basketball", name: "Baloncesto", icon: "🏀" },
  { key: "tennis", name: "Tenis", icon: "🎾" },
  { key: "baseball", name: "Béisbol", icon: "⚾" },
  { key: "hockey", name: "Hockey", icon: "🏒" },
  { key: "motorsport", name: "Motor", icon: "🏎️" },
  { key: "esports", name: "e-Sports", icon: "🎮" },
];

function Crest({ src, name }) {
  return <span className="apex-match-crest"><b>{name?.slice(0, 3).toUpperCase() || "???"}</b>{src && <img src={src} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span>;
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

  const handlePick = (e, pick, odd) => {
    e.preventDefault();
    e.stopPropagation();
    if (isClosed) return;
    onAddToSlip?.(match, pick, odd);
  };

  return (
    <Link to={`/events/${match.id}`} className="apex-quiniela-row" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="apex-quiniela-row-league">
        <span className="apex-quiniela-row-league-icon">{SPORT_FILTERS.find((s) => s.key === (match.sportKey || "football"))?.icon || "🏆"}</span>
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
        <span className="apex-quiniela-row-time">{isFinished ? "FIN" : isLive ? `EN VIVO` : time}</span>
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

export default function Sportsbook({ sportsData, onSportSelect, onAddToSlip, slipItems = [] }) {
  const [sportFilter, setSportFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const normalize = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const matchesSearch = (match, query) => {
    if (!query) return true;
    const q = normalize(query);
    if (!q) return true;
    const haystack = [match.home, match.away, match.league, match.sportName].filter(Boolean).map(normalize).join(" ");
    return haystack.includes(q);
  };

  const allEvents = (sportsData.matches || []).filter((match) => {
    const sportOk = sportFilter === "all" || (match.sportKey || "football") === sportFilter;
    return sportOk && matchesSearch(match, searchQuery);
  });

  const liveEvents = allEvents.filter((m) => m.status === "live");
  const upcomingEvents = allEvents.filter((m) => m.status === "upcoming" || (!m.status || m.status === "scheduled"))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const finishedEvents = allEvents.filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const setSportFilterWithNav = (key) => {
    setSportFilter(key);
    onSportSelect?.(key);
  };

  return (
    <div className="product-page sportsbook-page">
      <div className="apex-sportsbook-content">
        <header className="apex-sportsbook-hero">
          <div>
            <span className="apex-sportsbook-eyebrow"><CircleDot size={14} /> Cuotas en tiempo real</span>
            <h1>Arma tu jugada</h1>
            <p>Personaliza tus apuestas combinando múltiples mercados en un solo boleto. Los equipos resaltados son los ganadores más probables.</p>
          </div>
          <div className="apex-sportsbook-hero-badge">
            <ShieldCheck size={18} />
            <div>
              <strong>Modo gratuito</strong>
              <span>Sin depósito · Sin retirada · 100% virtual</span>
            </div>
          </div>
        </header>

        <div className="apex-eventos-sport-filter">
          {SPORT_FILTERS.map((sport) => (
            <button
              key={sport.key}
              className={sportFilter === sport.key ? "active" : ""}
              onClick={() => setSportFilterWithNav(sport.key)}
            >
              <span className="apex-eventos-sport-icon">{sport.icon}</span>
              {sport.name}
            </button>
          ))}
        </div>

        <div className="apex-event-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar partidos, equipos o ligas…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="apex-event-search-input"
          />
          {searchQuery && (
            <button type="button" className="apex-event-search-clear" onClick={() => setSearchQuery("")} aria-label="Limpiar">
              <X size={16} />
            </button>
          )}
        </div>

        {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando cuotas</strong></div>}
        {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>Error al cargar eventos</strong><p>{sportsData.error}</p></div>}
        {!sportsData.loading && !sportsData.error && allEvents.length === 0 && (
          <div className="api-state">
            <Info size={24} />
            {searchQuery
              ? <><strong>No se encontraron resultados para "{searchQuery}"</strong><small>Prueba con otro término o cambia el filtro de deporte</small></>
              : <strong>No hay eventos disponibles</strong>}
          </div>
        )}

        {liveEvents.length > 0 && (
          <section className="apex-eventos-section">
            <div className="apex-section-title">
              <h2><span className="apex-live-dot" /> En Directo</h2>
              <span className="apex-section-count">{liveEvents.length} {liveEvents.length === 1 ? "partido" : "partidos"}</span>
            </div>
            <div className="apex-quiniela-list">
              {liveEvents.map((match) => (
                <QuinielaRow key={match.id} match={match} onAddToSlip={onAddToSlip} slipItems={slipItems} />
              ))}
            </div>
          </section>
        )}

        {upcomingEvents.length > 0 && (
          <section className="apex-eventos-section">
            <div className="apex-section-title">
              <h2>Próximos Eventos</h2>
              <span className="apex-section-count">{upcomingEvents.length} {upcomingEvents.length === 1 ? "partido" : "partidos"}</span>
            </div>
            <div className="apex-quiniela-list">
              {upcomingEvents.slice(0, 20).map((match) => (
                <QuinielaRow key={match.id} match={match} onAddToSlip={onAddToSlip} slipItems={slipItems} />
              ))}
            </div>
          </section>
        )}

        {finishedEvents.length > 0 && (
          <section className="apex-eventos-section">
            <div className="apex-section-title">
              <h2>Últimos Resultados</h2>
              <span className="apex-section-count">{finishedEvents.length} {finishedEvents.length === 1 ? "partido" : "partidos"}</span>
            </div>
            <div className="apex-quiniela-list">
              {finishedEvents.map((match) => (
                <QuinielaRow key={match.id} match={match} onAddToSlip={onAddToSlip} slipItems={slipItems} />
              ))}
            </div>
          </section>
        )}

        {slipItems.length === 0 && upcomingEvents.length > 0 && (
          <div className="apex-sportsbook-help">
            <Star size={18} />
            <div>
              <strong>Cómo armar tu jugada</strong>
              <p>Toca cualquier cuota para añadirla a tu cupón. Combina partidos para crear una apuesta múltiple con mayor ganancia potencial.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
