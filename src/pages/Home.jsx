import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";

const matches = [
  {
    competition: "LaLiga",
    time: "Hoy, 21:00",
    home: "FC Barcelona",
    away: "Real Madrid",
    homeCode: "BAR",
    awayCode: "RMA",
    colors: ["#a50044", "#f7c800"],
    odds: ["1.82", "3.40", "2.15"],
  },
  {
    competition: "Champions League",
    time: "Manana, 20:45",
    home: "Manchester City",
    away: "Inter",
    homeCode: "MCI",
    awayCode: "INT",
    colors: ["#79bcec", "#111827"],
    odds: ["1.58", "3.85", "3.20"],
  },
  {
    competition: "LaLiga",
    time: "Sabado, 18:30",
    home: "Atletico de Madrid",
    away: "Sevilla FC",
    homeCode: "ATM",
    awayCode: "SEV",
    colors: ["#d71920", "#ffffff"],
    odds: ["1.70", "3.10", "2.80"],
  },
];

const leaders = [
  { name: "TikiTaka10", score: "24.890", color: "#ef6a5b" },
  { name: "MisterGol", score: "23.440", color: "#43a4c3" },
  { name: "LaPizarra", score: "21.975", color: "#7b73c7" },
  { name: "Jordi", score: "18.230", color: "#35b999", me: true },
];

function MatchRow({ match, index }) {
  const [selection, setSelection] = useState(null);

  return (
    <article className="classic-match">
      <div className="match-meta">
        <span>{match.competition}</span>
        <span><Clock3 size={13} /> {match.time}</span>
      </div>
      <div className="classic-match-body">
        <div className="classic-teams">
          <div className="classic-team">
            <span className="team-badge" style={{ background: match.colors[0] }}>{match.homeCode}</span>
            <strong>{match.home}</strong>
          </div>
          <span className="versus">VS</span>
          <div className="classic-team away">
            <span className="team-badge" style={{ background: match.colors[1], color: index === 2 ? "#122c38" : "#fff" }}>
              {match.awayCode}
            </span>
            <strong>{match.away}</strong>
          </div>
        </div>
        <div className="classic-picks" aria-label={`Pronostico ${match.home} contra ${match.away}`}>
          {["1", "X", "2"].map((pick, pickIndex) => (
            <button
              key={pick}
              type="button"
              className={selection === pick ? "selected" : ""}
              onClick={() => setSelection(pick)}
            >
              <span>{pick}</span>
              <b>{match.odds[pickIndex]}</b>
              {selection === pick && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <div className="classic-home">
      <section className="welcome-panel">
        <div>
          <span className="welcome-kicker"><Sparkles size={15} /> Jornada 24 en juego</span>
          <h1>Hola, Jordi. ¿Listo para jugar?</h1>
          <p>Haz tus pronosticos, suma monedas y compite con tus amigos por premios.</p>
        </div>
        <div className="welcome-stats">
          <div><strong>7</strong><span>racha actual</span></div>
          <div><strong>#42</strong><span>ranking semanal</span></div>
          <div><strong>68%</strong><span>aciertos</span></div>
        </div>
      </section>

      <div className="classic-layout">
        <main className="classic-main-column">
          <div className="content-heading">
            <div>
              <span className="tiny-label">Partidos destacados</span>
              <h2>Haz tu pronostico</h2>
            </div>
            <Link to="/predictions">Ver todos <ArrowRight size={15} /></Link>
          </div>

          <div className="classic-match-list">
            {matches.map((match, index) => (
              <MatchRow key={`${match.home}-${match.away}`} match={match} index={index} />
            ))}
          </div>

          <section className="league-banner">
            <div className="league-illustration">
              <span><Users size={26} /></span>
              <span><Trophy size={30} /></span>
              <span><Star size={23} /></span>
            </div>
            <div>
              <span className="tiny-label">Ligas privadas</span>
              <h2>¿Quien sabe mas de futbol?</h2>
              <p>Crea una liga, invita a tus amigos y demuestralo cada jornada.</p>
            </div>
            <Link to="/leagues" className="classic-button">Crear una liga <ChevronRight size={16} /></Link>
          </section>
        </main>

        <aside className="classic-rail">
          <section className="rail-card ranking-widget">
            <div className="rail-heading">
              <div><Trophy size={17} /><h3>Top semanal</h3></div>
              <Link to="/ranking">Ranking</Link>
            </div>
            <div className="leader-list">
              {leaders.map((leader, index) => (
                <div className={`leader-row ${leader.me ? "is-me" : ""}`} key={leader.name}>
                  <span className="leader-position">{index + 1}</span>
                  <span className="leader-avatar" style={{ background: leader.color }}>{leader.name[0]}</span>
                  <strong>{leader.name}</strong>
                  <b>{leader.score}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="rail-card daily-card">
            <div className="daily-icon"><Gift size={28} /></div>
            <span className="tiny-label">Recompensa diaria</span>
            <h3>Vuelve cada dia</h3>
            <p>Completa una prediccion para mantener tu racha y conseguir monedas extra.</p>
            <div className="day-track">
              {[20, 30, 40, 50, 75].map((points, index) => (
                <div className={index < 2 ? "done" : ""} key={points}>
                  <span>{index < 2 ? <Check size={13} /> : index + 1}</span>
                  <small>+{points}</small>
                </div>
              ))}
            </div>
            <Link to="/predictions" className="classic-button full">Jugar ahora</Link>
          </section>

          <section className="responsible-note">
            <span>100% gratis</span>
            <p>Juega con monedas virtuales. Sin depositos ni dinero real.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
