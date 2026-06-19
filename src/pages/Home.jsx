import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Check, ChevronRight, CircleDot, Clock3, Gift, LoaderCircle, Star, Trophy, Users } from "lucide-react";

function MatchRow({ match }) {
  const [selection, setSelection] = useState(null);
  const options = match.odds ? [["1", match.odds[1]], ["X", match.odds.X], ["2", match.odds[2]]] : [];

  return (
    <article className="classic-match">
      <div className="match-meta">
        <span>{match.league}</span>
        <span><Clock3 size={13} /> {new Date(match.date).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className="classic-match-body">
        <div className="classic-teams">
          <div className="classic-team">
            <span className="team-badge api-badge">{match.homeBadge ? <img src={match.homeBadge} alt="" /> : match.home.slice(0, 3).toUpperCase()}</span>
            <strong>{match.home}</strong>
          </div>
          <span className="versus">{match.status === "finished" ? match.score : "VS"}</span>
          <div className="classic-team away">
            <span className="team-badge api-badge">{match.awayBadge ? <img src={match.awayBadge} alt="" /> : match.away.slice(0, 3).toUpperCase()}</span>
            <strong>{match.away}</strong>
          </div>
        </div>
        {options.length > 0 ? (
          <div className="classic-picks">
            {options.map(([pick, odd]) => (
              <button key={pick} type="button" className={selection === pick ? "selected" : ""} onClick={() => setSelection(pick)}>
                <span>{pick}</span><b>{odd.toFixed(2)}</b>{selection === pick && <Check size={14} />}
              </button>
            ))}
          </div>
        ) : (
          <div className="odds-unavailable">Cuotas no disponibles</div>
        )}
      </div>
    </article>
  );
}

export default function Home({ sportsData }) {
  const featured = sportsData.matches.filter((match) => match.status !== "finished").slice(0, 3);
  const topTeams = sportsData.standings.slice(0, 4);

  return (
    <div className="classic-home">
      <section className="welcome-panel">
        <div>
          <span className="welcome-kicker"><CircleDot size={15} /> LaLiga · Datos conectados</span>
          <h1>Buenas, Jordi. Consulta la jornada real.</h1>
          <p>Partidos, resultados y clasificación cargados desde {sportsData.source}.</p>
        </div>
        <div className="welcome-stats">
          <div><strong>{sportsData.matches.filter((match) => match.status === "upcoming").length}</strong><span>próximos</span></div>
          <div><strong>{sportsData.matches.filter((match) => match.status === "live").length}</strong><span>en directo</span></div>
          <div><strong>{sportsData.standings.length}</strong><span>equipos</span></div>
        </div>
      </section>

      <div className="classic-layout">
        <main className="classic-main-column">
          <div className="content-heading">
            <div><span className="tiny-label">Próximos encuentros</span><h2>Partidos de LaLiga</h2></div>
            <Link to="/predictions">Ver todos <ArrowRight size={15} /></Link>
          </div>

          {sportsData.loading && <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Consultando proveedores deportivos</strong></div>}
          {sportsData.error && <div className="api-state error"><AlertCircle size={24} /><strong>No se pudieron cargar los datos</strong><p>{sportsData.error}</p></div>}
          {!sportsData.loading && !sportsData.error && featured.length === 0 && <div className="api-state"><CalendarEmpty /><strong>No hay próximos partidos publicados</strong><p>La competición puede estar fuera de temporada.</p></div>}

          <div className="classic-match-list">
            {featured.map((match) => <MatchRow key={match.id} match={match} />)}
          </div>

          <section className="league-banner">
            <div className="league-illustration"><span><Users size={26} /></span><span><Trophy size={30} /></span><span><Star size={23} /></span></div>
            <div><span className="tiny-label">Ligas privadas</span><h2>El grupo habla. La tabla decide.</h2><p>Compite con tus amigos usando los resultados reales.</p></div>
            <Link to="/leagues" className="classic-button">Crear una liga <ChevronRight size={16} /></Link>
          </section>
        </main>

        <aside className="classic-rail">
          <section className="rail-card ranking-widget">
            <div className="rail-heading"><div><Trophy size={17} /><h3>Clasificación</h3></div><Link to="/ranking">Completa</Link></div>
            <div className="leader-list">
              {topTeams.map((team) => (
                <div className="leader-row" key={team.id}>
                  <span className="leader-position">{team.rank}</span>
                  <span className="leader-avatar team-logo-small"><img src={team.logo} alt="" /></span>
                  <strong>{team.name}</strong><b>{team.points} pts</b>
                </div>
              ))}
            </div>
          </section>
          <section className="rail-card daily-card">
            <div className="daily-icon"><Gift size={28} /></div><span className="tiny-label">{sportsData.source}</span><h3>Información actualizada</h3>
            <p>Los datos se guardan durante 10 minutos para respetar el límite gratuito.</p>
            <Link to="/dashboard" className="classic-button full">Abrir panel</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function CalendarEmpty() {
  return <Clock3 size={24} />;
}
