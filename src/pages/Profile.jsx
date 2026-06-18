import { getUserHistory } from "../data/store";
import { MATCHES } from "../data/matches";

export default function Profile({ store, user }) {
  const history = getUserHistory(store, MATCHES);

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h1>Perfil</h1>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-large">
          {user?.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="profile-info">
          <h2>{user?.username || "Usuario"}</h2>
          <p className="text-muted">{user?.email || ""}</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value-lg">{user?.points?.toLocaleString() || 0}</span>
          <span className="stat-label">puntos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value-lg">{user?.predictionsCount || 0}</span>
          <span className="stat-label">predicciones</span>
        </div>
        <div className="stat-card">
          <span className="stat-value-lg">{user?.accuracy || 0}%</span>
          <span className="stat-label">precisión</span>
        </div>
        <div className="stat-card">
          <span className="stat-value-lg">🔥{user?.streak || 0}</span>
          <span className="stat-label">racha actual</span>
        </div>
      </div>

      <div className="section-header">
        <h2>Historial de predicciones</h2>
      </div>

      {history.length === 0 ? (
        <p className="empty-state">Aún no has hecho ninguna predicción.</p>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <div key={h.id} className={`history-item ${h.status}`}>
              <div className="history-match">
                {h.match ? (
                  <span>{h.match.home} vs {h.match.away}</span>
                ) : (
                  <span>Partido #{h.matchId}</span>
                )}
              </div>
              <div className="history-pick">
                Pick: <strong>{h.selection}</strong>
                {h.match?.result && <span> · Resultado: {h.match.result}</span>}
              </div>
              <div className="history-result">
                {h.status === "won" && <span className="badge badge-win">+{h.pointsWon}</span>}
                {h.status === "lost" && <span className="badge badge-lose">-{h.pointsBet}</span>}
                {h.status === "pending" && <span className="badge badge-pending">Pendiente</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
