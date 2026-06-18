import { Link } from "react-router-dom";
import MatchCard from "../components/MatchCard";
import RankingTable from "../components/RankingTable";

export default function Dashboard({ store, matches, allUsers, onPredict, user }) {
  const upcoming = matches.filter((m) => m.status === "upcoming" && new Date(m.date) > new Date()).slice(0, 4);
  const finished = matches.filter((m) => m.status === "finished").slice(0, 3);

  const sortedUsers = [...allUsers].sort((a, b) => b.points - a.points).slice(0, 5).map((u, i) => ({ ...u, rank: i + 1 }));

  const userPredictions = store.predictions.filter((p) => p.userId === "current_user");
  const pendingCount = userPredictions.filter((p) => p.status === "pending").length;
  const wonCount = userPredictions.filter((p) => p.status === "won").length;

  return (
    <div className="page dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="text-muted">Bienvenido de nuevo, {user?.username}</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon">🪙</span>
          <div>
            <span className="stat-value-lg">{user?.points?.toLocaleString() || 0}</span>
            <span className="stat-label">puntos</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div>
            <span className="stat-value-lg">{wonCount}/{userPredictions.length}</span>
            <span className="stat-label">aciertos</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏳</span>
          <div>
            <span className="stat-value-lg">{pendingCount}</span>
            <span className="stat-label">pendientes</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🔥</span>
          <div>
            <span className="stat-value-lg">{user?.streak || 0}</span>
            <span className="stat-label">racha</span>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="section-header">
            <h2>Próximos partidos</h2>
            <Link to="/predictions" className="btn btn-outline btn-sm">Ver todos</Link>
          </div>
          <div className="matches-list">
            {upcoming.map((m) => {
              const existing = store.predictions.find((p) => p.matchId === m.id && p.userId === "current_user");
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  existingPrediction={existing}
                  onPredict={onPredict}
                />
              );
            })}
          </div>

          <div className="section-header" style={{ marginTop: 24 }}>
            <h2>Últimos resultados</h2>
          </div>
          <div className="matches-list">
            {finished.map((m) => {
              const existing = store.predictions.find((p) => p.matchId === m.id && p.userId === "current_user");
              return (
                <MatchCard
                  key={m.id}
                  match={m}
                  existingPrediction={existing}
                  onPredict={onPredict}
                />
              );
            })}
          </div>
        </div>

        <div className="dash-side">
          <div className="section-header">
            <h2>Top global</h2>
            <Link to="/ranking" className="btn btn-outline btn-sm">Ver más</Link>
          </div>
          <RankingTable rows={sortedUsers} compact />

          <div className="section-header" style={{ marginTop: 16 }}>
            <h2>Información</h2>
          </div>
          <div className="info-card">
            <p>
              Predice resultados y gana puntos. Cuantos más aciertes, más puntos acumulas
              para canjear por premios reales.
            </p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Sin apuestas con dinero real. Economía cerrada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
