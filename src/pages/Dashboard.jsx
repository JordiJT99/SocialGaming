import { Link } from "react-router-dom";
import { ChartNoAxesCombined, Clock3, Coins, Flame } from "lucide-react";
import MatchCard from "../components/MatchCard";

export default function Dashboard({ store, matches, standings, onPredict, user, sportsData }) {
  const upcoming = matches.filter((match) => match.status === "upcoming" && new Date(match.date) > new Date()).slice(0, 4);
  const finished = matches.filter((match) => match.status === "finished").slice(0, 3);
  const userPredictions = store.predictions.filter((prediction) => prediction.userId === "current_user");
  const pendingCount = userPredictions.filter((prediction) => prediction.status === "pending").length;
  const wonCount = userPredictions.filter((prediction) => prediction.status === "won").length;

  const stats = [
    { icon: Coins, value: user?.points?.toLocaleString() || 0, label: "puntos" },
    { icon: ChartNoAxesCombined, value: `${wonCount}/${userPredictions.length}`, label: "aciertos" },
    { icon: Clock3, value: pendingCount, label: "pendientes" },
    { icon: Flame, value: user?.streak || 0, label: "racha" },
  ];

  return (
    <div className="page dashboard">
      <div className="page-header">
        <div>
          <h1>Mi panel</h1>
          <p className="text-muted">Tu actividad, tus picks y el pulso de la jornada.</p>
        </div>
        <span className={`data-source ${!sportsData?.error ? "is-live" : ""}`}>
          {sportsData?.loading ? "Actualizando datos" : sportsData?.error ? "Sin conexión" : sportsData?.source}
        </span>
      </div>

      <div className="stats-row">
        {stats.map(({ icon: Icon, value, label }) => (
          <div className="stat-card" key={label}>
            <span className="stat-icon"><Icon size={20} /></span>
            <div><span className="stat-value-lg">{value}</span><span className="stat-label">{label}</span></div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="section-header">
            <h2>Próximos partidos</h2>
            <Link to="/predictions" className="btn btn-outline btn-sm">Ver todos</Link>
          </div>
          <div className="matches-list">
            {upcoming.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                existingPrediction={store.predictions.find((prediction) => prediction.matchId === match.id && prediction.userId === "current_user")}
                onPredict={onPredict}
              />
            ))}
          </div>

          <div className="section-header" style={{ marginTop: 24 }}><h2>Últimos resultados</h2></div>
          <div className="matches-list">
            {finished.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                existingPrediction={store.predictions.find((prediction) => prediction.matchId === match.id && prediction.userId === "current_user")}
                onPredict={onPredict}
              />
            ))}
          </div>
        </div>

        <div className="dash-side">
          <div className="section-header"><h2>Clasificación</h2><Link to="/ranking" className="btn btn-outline btn-sm">Ver completa</Link></div>
          <div className="mini-standings">
            {standings.slice(0, 5).map((team) => (
              <div key={team.id}><span>{team.rank}</span><img src={team.logo} alt="" /><strong>{team.name}</strong><b>{team.points}</b></div>
            ))}
          </div>
          <div className="section-header" style={{ marginTop: 16 }}><h2>Cómo funciona</h2></div>
          <div className="info-card">
            <p>Pronostica resultados y suma monedas según tu acierto. Úsalas en torneos, retos y recompensas.</p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>Juego gratuito con economía virtual cerrada.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
