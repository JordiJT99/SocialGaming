export default function RankingTable({ rows, compact }) {
  if (!rows || rows.length === 0) {
    return <p className="empty-state">No hay datos para mostrar.</p>;
  }

  return (
    <div className={`ranking-table ${compact ? "compact" : ""}`}>
      {rows.map((row, i) => (
        <div key={row.id || i} className={`ranking-row ${row.id === "current_user" ? "is-me" : ""}`}>
          <span className="rank-number">#{row.rank}</span>
          <span className="rank-avatar">{row.username?.[0]?.toUpperCase() || "?"}</span>
          <span className="rank-name">{row.username}</span>
          <span className="rank-stats">
            <span className="rank-points">{row.points?.toLocaleString() || 0}</span>
            {!compact && row.accuracy !== undefined && (
              <span className="rank-acc">{row.accuracy}%</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
