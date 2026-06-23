import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, PlayCircle, Plus, Trophy } from "lucide-react";
import BetConfirm from "../components/BetConfirm";
import { matchPriority } from "./predictionPriority";

function WatchVideoCta({ reward = 15, compact = false }) {
  return (
    <Link to="/earn" className="apex-watch-video-cta" style={{
      display: "inline-flex", alignItems: "center", gap: "0.6rem",
      padding: compact ? "0.4rem 0.85rem" : "0.6rem 1.1rem",
      borderRadius: "999px", textDecoration: "none",
      background: "linear-gradient(135deg, #ff6b57, #ff9a3c)",
      color: "#fff", fontSize: compact ? "0.78rem" : "0.85rem", fontWeight: 700,
      boxShadow: "0 4px 14px rgba(255, 107, 87, 0.35)",
      border: "none", flexShrink: 0,
    }}>
      <PlayCircle size={compact ? 16 : 18} fill="#fff" stroke="#ff6b57" />
      <span>Mira este video y gana <b style={{ color: "#fff23d" }}>{reward} coins</b></span>
    </Link>
  );
}

const SECTIONS = [
  { key: "live", label: "En Directo", filter: (m) => m.status === "live" },
  { key: "football", label: "Fútbol", filter: (m) => m.sportKey === "football" && m.status === "upcoming" && m.odds },
  { key: "tennis", label: "Tenis", filter: (m) => m.sportKey === "tennis" && m.status === "upcoming" && m.odds },
  { key: "basketball", label: "Baloncesto", filter: (m) => m.sportKey === "basketball" && m.status === "upcoming" && m.odds },
  { key: "baseball", label: "Béisbol", filter: (m) => m.sportKey === "baseball" && m.status === "upcoming" && m.odds },
  { key: "hockey", label: "Hockey", filter: (m) => m.sportKey === "hockey" && m.status === "upcoming" && m.odds },
];

const sortMatches = (a, b) => {
  if (a.status === "live" && b.status !== "live") return -1;
  if (b.status === "live" && a.status !== "live") return 1;
  const importance = matchPriority(b) - matchPriority(a);
  if (importance) return importance;
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

function HomeMatchCard({ match, onPredict, existingPrediction, balance }) {
  const [selection, setSelection] = useState(existingPrediction?.selection || null);
  const [submitting, setSubmitting] = useState(false);
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const options = match.odds
    ? [["1", "Local", match.odds[1]], ...(match.odds.X ? [["X", "Empate", match.odds.X]] : []), ["2", "Visita", match.odds[2]]]
    : [];

  const confirm = async (amount) => {
    if (!selection || submitting || existingPrediction) return;
    setSubmitting(true);
    try {
      await onPredict?.(match.id, selection, amount, match.oddsEventId, match.odds[selection], {
        home: match.home,
        away: match.away,
        homeBadge: match.homeBadge,
        awayBadge: match.awayBadge,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="apex-home-match">
      <div className="apex-home-match-meta">
        <span>{match.league}</span>
        {isLive ? <b>LIVE</b> : isFinished ? <time>FINAL</time> : <time>{new Date(match.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · {new Date(match.date).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time>}
      </div>
      <div className="apex-home-teams">
        <div><TeamBadge src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
        <span className={isLive || isFinished ? "live-score" : ""}>{isLive || isFinished ? match.score || "0 - 0" : "VS"}<small>{isLive ? match.statusLabel || "En directo" : isFinished ? "Resultado oficial" : ""}</small></span>
        <div><TeamBadge src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
      </div>
      {!isFinished && !isLive && options.length ? (
        <div className="apex-home-odds">
          {options.map(([key, label, odd]) => (
            <button type="button" disabled={submitting || Boolean(existingPrediction)} key={key} className={selection === key ? "selected" : ""} onClick={() => setSelection(key)}>
              <small>{label}</small><b>{odd?.toFixed(2)}</b>
            </button>
          ))}
        </div>
      ) : (
        <div className="apex-no-odds">{isFinished ? "Partido finalizado" : isLive ? "Marcador actualizado en directo" : "Sin cuotas publicadas"}</div>
      )}
      {!isFinished && !isLive && options.length > 0 && !match.bettingOpen && !existingPrediction && (
        <div className="apex-no-odds">Puedes apostar; la cuota se validara despues</div>
      )}
      {selection && !existingPrediction && (
        <BetConfirm
          label={selection === "1" ? match.home : selection === "2" ? match.away : "Empate"}
          odds={match.odds[selection]}
          balance={balance}
          submitting={submitting}
          onCancel={() => setSelection(null)}
          onConfirm={confirm}
        />
      )}
    </article>
  );
}

function MatchSection({ label, matches, limit = 6, linkTo, store, onPredict }) {
  if (!matches.length) return null;
  const visible = matches.slice(0, limit);

  return (
    <section className="apex-section apex-sport-section">
      <div className="apex-section-title">
        <h2>{label}{matches.some((m) => m.status === "live") && <span className="apex-live-dot" />}</h2>
        {linkTo && matches.length > limit && <Link to={linkTo}>VER TODO</Link>}
      </div>
      <div className="apex-horizontal-matches">
        {visible.map((match) => <HomeMatchCard
          key={match.id}
          match={match}
          onPredict={onPredict}
          existingPrediction={store?.predictions?.find((item) => item.userId === "current_user" && item.matchId === match.id)}
          balance={store?.users?.find((user) => user.id === "current_user")?.points || 0}
        />)}
      </div>
    </section>
  );
}

export default function Home({ sportsData, store, onPredict }) {
  const sections = useMemo(() =>
    SECTIONS.map((section) => ({
      ...section,
      matches: sportsData.matches.filter(section.filter).sort(sortMatches),
    })).filter((s) => s.matches.length > 0),
  [sportsData.matches]);

  const results = useMemo(() => {
    const now = new Date();
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(now.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);

    return [...sportsData.matches]
      .filter((m) => m.status === "finished" && new Date(m.endsAt || m.date) >= startOfYesterday)
      .sort((a, b) => new Date(b.endsAt || b.date) - new Date(a.endsAt || a.date))
      .slice(0, 10);
  }, [sportsData.matches]);

  return (
    <div className="apex-page apex-home-page">
      <section className="apex-welcome" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1>¡Hola, Jordi! <span>👋</span></h1>
          <p>¿Qué tal tu instinto hoy?</p>
        </div>
        <WatchVideoCta />
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
          store={store}
          onPredict={onPredict}
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
          <div>
            {results.map((match) => (
              <article key={match.id}>
                <span>{match.league}</span>
                <div><TeamBadge src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
                <b>{match.score}</b>
                <div><TeamBadge src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
