import { Link } from "react-router-dom";

export default function LeagueCard({ league, memberCount, rank, points }) {
  return (
    <div className="league-card">
      <div className="league-card-header">
        <h3>{league.name}</h3>
        <span className="league-code">{league.code}</span>
      </div>
      <div className="league-card-stats">
        <div>
          <span className="stat-value">{memberCount}</span>
          <span className="stat-label">miembros</span>
        </div>
        {rank && (
          <div>
            <span className="stat-value">#{rank}</span>
            <span className="stat-label">tu puesto</span>
          </div>
        )}
        {points && (
          <div>
            <span className="stat-value">{points.toLocaleString()}</span>
            <span className="stat-label">pts</span>
          </div>
        )}
      </div>
      <Link to={`/leagues/${league.id}`} className="btn btn-outline btn-sm btn-full">Ver liga</Link>
    </div>
  );
}
