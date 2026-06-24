import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Flame, Newspaper, PlayCircle, Target as TargetIcon, Trophy, Tv } from "lucide-react";
import { fetchSportsNews } from "../services/newsApi";
import { matchPriority } from "./predictionPriority";

function TeamBadge({ src, name }) {
  return (
    <span className="apex-team-badge">
      <b>{name.slice(0, 3).toUpperCase()}</b>
      {src && <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

const sortMatches = (a, b) => {
  if (a.status === "live" && b.status !== "live") return -1;
  if (b.status === "live" && a.status !== "live") return 1;
  const importance = matchPriority(b) - matchPriority(a);
  if (importance) return importance;
  return new Date(a.date) - new Date(b.date);
};

function CompactMatchCard({ match, onAddToSlip, slipItems = [], existingPrediction }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const options = match.odds
    ? [["1", "Local", match.odds[1]], ...(match.odds.X ? [["X", "Empate", match.odds.X]] : []), ["2", "Visita", match.odds[2]]]
    : [];
  const inSlip = slipItems.find((item) => item.eventId === match.id);

  return (
    <Link to={`/events/${match.id}`} className="apex-compact-match" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="apex-compact-match-meta">
        <span className="apex-compact-match-league">{match.league || "Evento"}</span>
        {isLive ? <b className="apex-compact-live">● LIVE</b> : <time>{new Date(match.date).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>}
      </div>
      <div className="apex-compact-match-teams">
        <div className="apex-compact-match-team">
          <TeamBadge src={match.homeBadge} name={match.home} />
          <strong>{match.home}</strong>
        </div>
        <span className="apex-compact-match-vs">
          {isLive || isFinished ? <b>{match.score || "0 - 0"}</b> : <>VS<br /><small>{isLive ? "En directo" : "Próximo"}</small></>}
        </span>
        <div className="apex-compact-match-team">
          <TeamBadge src={match.awayBadge} name={match.away} />
          <strong>{match.away}</strong>
        </div>
      </div>
      {!isFinished && !isLive && options.length ? (
        <div className="apex-compact-match-odds" onClick={(e) => e.preventDefault()}>
          {options.map(([key, label, odd]) => {
            const selected = inSlip?.selection === key;
            return (
              <button type="button" disabled={Boolean(existingPrediction)} key={key} className={selected ? "selected" : ""} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToSlip?.(match, key, odd); }}>
                <small>{label}</small>
                <b>{odd?.toFixed(2)}</b>
              </button>
            );
          })}
        </div>
      ) : isLive && options.length ? (
        <div className="apex-compact-match-odds" onClick={(e) => e.preventDefault()}>
          {options.slice(0, 2).map(([key, label, odd]) => (
            <button type="button" disabled key={key}>
              <small>{label}</small>
              <b>{odd?.toFixed(2)}</b>
            </button>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default function Home({ sportsData, store, onAddToSlip, slipItems = [], user }) {
  const [news, setNews] = useState({ articles: [], loading: true, error: null, source: "ESPN" });
  const [activeTab, setActiveTab] = useState("live");

  useEffect(() => {
    let active = true;
    fetchSportsNews()
      .then((payload) => {
        if (!active) return;
        setNews({ articles: payload.articles, loading: false, error: null, source: payload.source });
      })
      .catch((error) => {
        if (!active) return;
        setNews((previous) => ({ ...previous, loading: false, error: error.error || error.message }));
      });
    return () => { active = false; };
  }, []);

  const liveMatches = useMemo(
    () => sportsData.matches.filter((m) => m.status === "live" && m.odds).sort(sortMatches).slice(0, 2),
    [sportsData.matches],
  );

  const upcomingMatches = useMemo(
    () => sportsData.matches.filter((m) => m.status === "upcoming" && m.odds).sort(sortMatches).slice(0, 4),
    [sportsData.matches],
  );

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

  const myPredictions = useMemo(
    () => (store?.predictions || []).filter((p) => p.userId === "current_user"),
    [store?.predictions],
  );
  const settled = myPredictions.filter((p) => p.status === "won" || p.status === "lost");
  const wins = settled.filter((p) => p.status === "won").length;
  const accuracy = settled.length > 0 ? Math.round((wins / settled.length) * 100) : 0;
  const userRank = useMemo(() => {
    const users = (store?.users || []).slice().sort((a, b) => (b.points || 0) - (a.points || 0));
    const idx = users.findIndex((u) => u.id === "current_user");
    return idx >= 0 ? idx + 1 : users.length + 1;
  }, [store?.users]);

  const groupedUpcoming = useMemo(() => {
    const groups = {};
    for (const m of upcomingMatches) {
      const d = new Date(m.date);
      const key = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return Object.entries(groups);
  }, [upcomingMatches]);

  return (
    <div className="apex-page apex-home-page">
      <div className="apex-home-columns">
        <div className="apex-home-main">
          {/* Tab bar */}
          <div className="apex-home-tabs">
            <button type="button" className={activeTab === "live" ? "active" : ""} onClick={() => setActiveTab("live")}>
              <Tv size={16} /> En Vivo
            </button>
            <button type="button" className={activeTab === "proximos" ? "active" : ""} onClick={() => setActiveTab("proximos")}>
              Próximos
            </button>
            <button type="button" className={activeTab === "resultados" ? "active" : ""} onClick={() => setActiveTab("resultados")}>
              <Trophy size={16} /> Resultados
            </button>
          </div>

          {/* Stats row */}
          <div className="apex-home-stats-row">
            <div className="apex-home-stat">
              <div className="apex-home-stat-icon streak"><Flame size={18} /></div>
              <div>
                <span>RACHA</span>
                <strong>{user?.streak || 0}</strong>
              </div>
            </div>
            <div className="apex-home-stat">
              <div className="apex-home-stat-icon upcoming"><Clock size={18} /></div>
              <div>
                <span>PRÓXIMOS</span>
                <strong>{upcomingMatches.length}</strong>
              </div>
            </div>
            <div className="apex-home-stat">
              <div className="apex-home-stat-icon accuracy"><TargetIcon size={18} /></div>
              <div>
                <span>ACIERTOS</span>
                <strong>{accuracy}%</strong>
              </div>
            </div>
            <div className="apex-home-stat">
              <div className="apex-home-stat-icon rank"><Trophy size={18} /></div>
              <div>
                <span>RANKING</span>
                <strong>#{userRank}</strong>
              </div>
            </div>
          </div>

          {/* Featured Mira y Gana banner */}
          <Link to="/earn" className="apex-mira-y-gana">
            <div className="apex-mira-y-gana-text">
              <span className="apex-mira-y-gana-badge">● DESTACADO</span>
              <h2>Mira y Gana</h2>
              <p>Gana 15 coins tournament. Viendo el mundial del 2026 en directo y apostando al ganador.</p>
              <span className="apex-mira-y-gana-cta"><PlayCircle size={16} /> Ver ahora</span>
            </div>
            <div className="apex-mira-y-gana-art" aria-hidden="true">
              <Trophy size={80} />
            </div>
          </Link>

          {/* En Directo section */}
          {liveMatches.length > 0 && (
            <section className="apex-home-section">
              <div className="apex-section-title">
                <h2><span className="apex-live-dot" /> En Directo</h2>
                <Link to="/events">Ver todo</Link>
              </div>
              <div className="apex-compact-matches-grid">
                {liveMatches.map((match) => (
                  <CompactMatchCard
                    key={match.id}
                    match={match}
                    onAddToSlip={onAddToSlip}
                    slipItems={slipItems}
                    existingPrediction={store?.predictions?.find((p) => p.userId === "current_user" && p.matchId === match.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Próximos Partidos section */}
          {groupedUpcoming.length > 0 && (
            <section className="apex-home-section">
              <div className="apex-section-title">
                <h2>Próxima Partido: Mundial 2026</h2>
                <Link to="/events">Ver todo</Link>
              </div>
              {groupedUpcoming.map(([dateLabel, matches]) => (
                <div key={dateLabel} className="apex-home-date-group">
                  <div className="apex-home-date-label">{dateLabel}</div>
                  <div className="apex-compact-matches-grid">
                    {matches.slice(0, 2).map((match) => (
                      <CompactMatchCard
                        key={match.id}
                        match={match}
                        onAddToSlip={onAddToSlip}
                        slipItems={slipItems}
                        existingPrediction={store?.predictions?.find((p) => p.userId === "current_user" && p.matchId === match.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Noticias Deportivas section */}
          <section className="apex-home-section">
            <div className="apex-section-title">
              <h2><Newspaper size={18} /> Noticias Deportivas</h2>
              <small className="apex-news-source">{news.loading ? "Cargando..." : news.source}</small>
            </div>
            {news.loading && <div className="apex-news-loading"><i /><i /><i /><span>Cargando noticias...</span></div>}
            {!news.loading && news.error && <div className="apex-news-error"><span>No se pudieron cargar las noticias.</span><small>{news.error}</small></div>}
            {!news.loading && !news.error && (
              <div className="apex-home-news-grid">
                {news.articles.slice(0, 8).map((article) => (
                  <a key={article.id} href={article.url || "#"} target="_blank" rel="noopener noreferrer" className="apex-home-news-card">
                    {article.image ? (
                      <img src={article.image} alt="" loading="lazy" onError={(e) => { const s = document.createElement("span"); s.className = "apex-news-fallback"; s.textContent = article.sport?.slice(0, 2).toUpperCase() || "ES"; e.currentTarget.replaceWith(s); }} />
                    ) : (
                      <span className="apex-news-fallback">{article.sport?.slice(0, 2).toUpperCase() || "ES"}</span>
                    )}
                    <div className="apex-home-news-body">
                      <span className="apex-home-news-meta">{article.sport} · {(() => { const d = new Date(article.publishedAt); return !isNaN(d.getTime()) ? d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""; })()}</span>
                      <strong>{article.title}</strong>
                      {article.summary && <p>{article.summary}</p>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="apex-home-sidebar">
          {results.length > 0 && (
            <section className="apex-panel apex-results-panel">
              <div className="apex-section-title"><h2>Últimos Resultados</h2><Link to="/predictions?status=finished">VER TODO</Link></div>
              <div className="apex-results-list">
                {results.map((match) => (
                  <article key={match.id}>
                    <span className="apex-result-league">{match.league}</span>
                    <div className="apex-result-teams">
                      <div><TeamBadge src={match.homeBadge} name={match.home} /><strong>{match.home}</strong></div>
                      <b className="apex-result-score">{match.score}</b>
                      <div><TeamBadge src={match.awayBadge} name={match.away} /><strong>{match.away}</strong></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="apex-panel apex-news-panel">
            <div className="apex-section-title">
              <h2><Newspaper size={18} /> Noticias</h2>
              <small className="apex-news-source">{news.loading ? "Cargando..." : news.source}</small>
            </div>
            {!news.loading && !news.error && (
              <div className="apex-news-list">
                {news.articles.slice(0, 8).map((article) => (
                  <a key={article.id} href={article.url || "#"} target="_blank" rel="noopener noreferrer" className="apex-news-card">
                    {article.image ? <img src={article.image} alt="" loading="lazy" onError={(e) => { const s = document.createElement("span"); s.className = "apex-news-icon"; s.textContent = article.sport?.slice(0, 2).toUpperCase() || "ES"; e.currentTarget.replaceWith(s); }} /> : <span className="apex-news-icon">{article.sport?.slice(0, 2).toUpperCase() || "ES"}</span>}
                    <div>
                      <span className="apex-news-meta">{article.sport} · {(() => { const d = new Date(article.publishedAt); return !isNaN(d.getTime()) ? d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""; })()}</span>
                      <strong>{article.title}</strong>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
