import { AlertCircle, LoaderCircle } from "lucide-react";

export default function Ranking({ standings, sportsData }) {
  return (
    <div className="page ranking-page">
      <div className="page-header">
        <div>
          <h1>Clasificación de LaLiga</h1>
          <p className="text-muted">Temporada 2025-2026 · Datos de API-Football</p>
        </div>
        {!sportsData.loading && !sportsData.error && <span className="data-source is-live">API-Football</span>}
      </div>

      {sportsData.loading && (
        <div className="api-state"><LoaderCircle className="spin" size={24} /><strong>Cargando clasificación</strong></div>
      )}

      {sportsData.error && (
        <div className="api-state error"><AlertCircle size={24} /><strong>No se pudo cargar la clasificación</strong><p>{sportsData.error}</p></div>
      )}

      {!sportsData.loading && !sportsData.error && (
        <div className="standings-table">
          <div className="standings-head">
            <span>Pos.</span><span>Equipo</span><span>PJ</span><span>G</span><span>E</span><span>P</span><span>DG</span><span>Pts</span>
          </div>
          {standings.map((row) => (
            <div className="standings-row" key={row.id}>
              <span className="standing-position">{row.rank}</span>
              <span className="standing-team"><img src={row.logo} alt="" /><strong>{row.name}</strong></span>
              <span>{row.played}</span><span>{row.won}</span><span>{row.draw}</span><span>{row.lost}</span>
              <span className={row.difference >= 0 ? "positive" : "negative"}>{row.difference > 0 ? `+${row.difference}` : row.difference}</span>
              <strong className="standing-points">{row.points}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
