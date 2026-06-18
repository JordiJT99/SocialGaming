import RankingTable from "../components/RankingTable";

export default function Ranking({ allUsers, currentUser }) {
  const sorted = [...allUsers]
    .sort((a, b) => b.points - a.points)
    .map((u, i) => ({ ...u, rank: i + 1 }));

  return (
    <div className="page ranking-page">
      <div className="page-header">
        <h1>Ranking global</h1>
        <p className="text-muted">Todos los usuarios ordenados por puntos</p>
      </div>

      {currentUser && (
        <div className="current-user-rank">
          <span>Tu posición: <b>#{sorted.findIndex((u) => u.id === "current_user") + 1}</b></span>
          <span>{currentUser.points?.toLocaleString() || 0} pts</span>
        </div>
      )}

      <RankingTable rows={sorted} />
    </div>
  );
}
