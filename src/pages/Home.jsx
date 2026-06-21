import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Flame, Gift, Plus, Trophy } from "lucide-react";

const SECTIONS = [
  { key: "live", label: "En Directo", filter: (m) => m.status === "live" },
  { key: "mundial", label: "Mundial 2026", filter: (m) => m.league === "Mundial 2026" && m.status !== "live" },
  { key: "football", label: "Fútbol", filter: (m) => m.sportKey === "football" && m.league !== "Mundial 2026" && m.status !== "live" },
  { key: "basketball", label: "Baloncesto", filter: (m) => m.sportKey === "basketball" && m.status !== "live" },
  { key: "tennis", label: "Tenis", filter: (m) => m.sportKey === "tennis" && m.status !== "live" },
  { key: "baseball", label: "Béisbol", filter: (m) => m.sportKey === "baseball" && m.status !== "live" },
  { key: "hockey", label: "Hockey", filter: (m) => m.sportKey === "hockey" && m.status !== "live" },
];

const sortMatches = (a, b) => {
  if (a.status === "live" && b.status !== "live") return -1;
  if (b.status === "live" && a.status !== "live") return 1;
  if (a.status === "upcoming" && b.status !== "upcoming") return -1;
  if (b.status === "upcoming" && a.status !== "upcoming") return 1;
  return new Date(a.date) - new Date(b.date);
};

function TeamBadge({ src, name }) {
  return (
    <span className="apex-team-badge">
      <b>{name.slice(0, 3).toUpperCase()}</b>
      {src && <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function HomeMatchCard({ match }) {
  const [selection, setSelection] = useState(null);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const options = match.odds
    ? [["1", "Local", match.odds[1]], ...(match.odds.X ? [["X", "Empate", match.odds.X]] : []), ["2", "Visita", match.odds[2]]]
    : [];

  return (
    <article className="apex-home-match">
      <div className="apex-home-match-meta">
        <span>{match.league}</span>
        {isLive ? <b>LIVE</b> : isFinished ? <time>FINAL</time> : <time>{new Date(match.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>}
      </div>
      <div className="apex-home-teams">
        <div><TeamBadge src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
        <span className={isLive || isFinished ? "live-score" : ""}>{isLive || isFinished ? match.score || "0 - 0" : "VS"}<small>{isLive ? match.statusLabel || "En directo" : isFinished ? "Resultado oficial" : ""}</small></span>
        <div><TeamBadge src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
      </div>
      {!isFinished && options.length ? (
        <div className="apex-home-odds">
          {options.map(([key, label, odd]) => (
            <button type="button" key={key} className={selection === key ? "selected" : ""} onClick={() => setSelection(key)}>
              <small>{label}</small><b>{odd?.toFixed(2)}</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="apex-no-odds">{isFinished ? "Partido finalizado" : isLive ? "Marcador actualizado en directo" : "Cuotas pendientes"}</div>
      )}
    </article>
  );
}

function MatchSection({ label, matches, limit = 6, linkTo }) {
  if (!matches.length) return null;
  const visible = matches.slice(0, limit);

  return (
    <section className="apex-section apex-sport-section">
      <div className="apex-section-title">
        <h2>{label}{matches.some((m) => m.status === "live") && <span className="apex-live-dot" />}</h2>
        {linkTo && matches.length > limit && <Link to={linkTo}>VER TODO</Link>}
      </div>
      <div className="apex-horizontal-matches">
        {visible.map((match) => <HomeMatchCard key={match.id} match={match} />)}
      </div>
    </section>
  );
}

export default function Home({ sportsData }) {
  const sections = useMemo(() =>
    SECTIONS.map((section) => ({
      ...section,
      matches: sportsData.matches.filter(section.filter).sort(sortMatches),
    })).filter((s) => s.matches.length > 0),
  [sportsData.matches]);

  const results = useMemo(() =>
    [...sportsData.matches]
      .filter((m) => m.status === "finished")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6),
  [sportsData.matches]);

  return (
    <div className="apex-page apex-home-page">
      <section className="apex-welcome">
        <h1>¡Hola, Jordi! <span>👋</span></h1>
        <p>¿Qué tal tu instinto hoy?</p>
      </section>

      <section className="apex-streak-card apex-card">
        <div><Flame size={27} /><h2>Racha de 5 días</h2><Gift size={24} /></div>
        <span className="apex-progress"><i style={{ width: "71%" }} /></span>
        <footer><small>DÍA 5</small><b>COFRE EN 2 DÍAS</b></footer>
      </section>

      <section className="apex-level-card apex-card">
        <div><span>PROGRESO DE NIVEL</span><strong>850 / 1000 XP</strong></div>
        <span className="apex-progress"><i style={{ width: "85%" }} /></span>
      </section>

      <section className="apex-section">
        <div className="apex-section-title"><h2>Resumen Semanal</h2><Link to="/dashboard">VER TODO</Link></div>
        <div className="apex-week-card apex-card">
          <div><strong>78%</strong><span>PRECISIÓN</span></div>
          <div className="apex-chart">{[32, 52, 70, 42, 58, 48, 56].map((height, index) => <i key={index} style={{ height: `${height}px` }} />)}</div>
        </div>
      </section>

      {sportsData.loading && (
        <section className="apex-section"><div className="apex-home-loading"><i /><i /><i /><span>Sincronizando partidos...</span></div></section>
      )}
      {!sportsData.loading && sportsData.error && (
        <section className="apex-section"><div className="apex-home-loading error"><span>No se pudieron cargar los eventos.</span><small>{sportsData.error}</small></div></section>
      )}

      {sections.map((section) => (
        <MatchSection
          key={section.key}
          label={section.label}
          matches={section.matches}
          limit={section.key === "live" ? 10 : 6}
          linkTo="/predictions"
        />
      ))}

      <section className="apex-master-card">
        <div><h2>Reto de Maestros</h2><p>Adivina 3 resultados exactos y gana 2,000 monedas.</p><Link to="/challenges">PARTICIPAR AHORA</Link></div>
        <Trophy size={118} />
        <button type="button" aria-label="Abrir reto"><Plus size={26} /></button>
      </section>

      {results.length > 0 && (
        <section className="apex-results-section">
          <div className="apex-section-title"><h2>Últimos Resultados</h2><Link to="/predictions?status=finished">VER TODO</Link></div>
          <div>{results.map((match) => <article key={match.id}><span>{match.league}</span><strong>{match.home}</strong><b>{match.score}</b><strong>{match.away}</strong></article>)}</div>
        </section>
      )}
    </div>
  );
}
